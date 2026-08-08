import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReviewItemById, listReviewEvents } from "../supabase/reviews-repository";
import { computeAutomationPlan } from "./eligibility";
import { buildAutomationPayload } from "./payload";
import { dispatchAutomation, type Dispatcher } from "./dispatcher";
import {
  getRunByIdempotencyKey,
  insertOrGetRun,
  listRunsForReview,
  recordAttempt,
} from "./repository";
import { MAX_ATTEMPTS, buildIdempotencyKey, type AutomationPayload, type AutomationRunRecord } from "./types";
import type { AutomationPlan } from "./eligibility";

// Running post-review automation.
//
// The caller supplies a reviewId and nothing else. The task type, the payload,
// the destination and the idempotency key are all rebuilt here from the stored
// review and its audit events, so a browser cannot choose what gets sent or
// where. Re-running is the retry: there is no queue, no worker and no backoff
// policy, because a demo with one button does not need a scheduler.

export interface RunAutomationDeps {
  db: SupabaseClient;
  dispatcher?: Dispatcher;
  automationIdFactory?: () => string;
  now?: () => string;
}

export type RunAutomationResult =
  | { status: "not_eligible"; plan: Extract<AutomationPlan, { eligible: false }> }
  | { status: "ok"; run: AutomationRunRecord; payload: AutomationPayload; dispatched: boolean };

export async function runAutomation(
  deps: RunAutomationDeps,
  reviewId: string,
): Promise<RunAutomationResult> {
  const { plan, item, events } = await loadPlan(deps.db, reviewId);
  if (!plan.eligible) return { status: "not_eligible", plan };

  const now = deps.now ?? (() => new Date().toISOString());
  const payload = buildAutomationPayload({
    item,
    taskType: plan.taskType,
    triggerEvent: plan.triggerEvent,
    now: now(),
  });

  const { run } = await insertOrGetRun(deps.db, {
    automationId: (deps.automationIdFactory ?? (() => `aut_${randomUUID()}`))(),
    reviewId: item.reviewId,
    triggerEventId: plan.triggerEvent.eventId,
    taskType: plan.taskType,
    idempotencyKey: buildIdempotencyKey(item.reviewId, plan.triggerEvent.eventId),
  });

  // Already delivered: hand back the record untouched. Sending again would
  // create a second task in n8n for one human decision, which is the exact
  // thing the idempotency key exists to prevent.
  if (run.status === "delivered") {
    return { status: "ok", run, payload, dispatched: false };
  }
  if (run.attemptCount >= MAX_ATTEMPTS) {
    return { status: "ok", run, payload, dispatched: false };
  }

  const result = await (deps.dispatcher ?? dispatchAutomation)(payload);
  const attemptCount = run.attemptCount + 1;

  // Note what is NOT here: no path writes to review_items. A webhook that
  // fails cannot un-approve a review.
  const updated = await recordAttempt(deps.db, {
    automationId: run.automationId,
    status: result.outcome === "delivered" ? "delivered" : result.outcome === "mocked" ? "mocked" : "failed",
    attemptCount,
    responseCode: result.outcome === "delivered" || result.outcome === "failed" ? result.responseCode : null,
    externalTaskId: result.outcome === "delivered" ? result.ack.taskId : null,
    errorCode: result.outcome === "failed" ? result.errorCode : null,
  });

  return { status: "ok", run: updated, payload, dispatched: true };
}

/**
 * What the review page needs to render the panel without sending anything:
 * the eligibility verdict, the payload that would go out, and any run so far.
 */
export async function describeAutomation(
  db: SupabaseClient,
  reviewId: string,
): Promise<{
  plan: AutomationPlan;
  payload: AutomationPayload | null;
  runs: AutomationRunRecord[];
}> {
  const { plan, item } = await loadPlan(db, reviewId);
  const runs = await listRunsForReview(db, reviewId);
  if (!plan.eligible) return { plan, payload: null, runs };
  return {
    plan,
    payload: buildAutomationPayload({
      item,
      taskType: plan.taskType,
      triggerEvent: plan.triggerEvent,
      // A preview is not a delivery, so it carries no invented send time.
      now: item.updatedAt,
    }),
    runs,
  };
}

async function loadPlan(db: SupabaseClient, reviewId: string) {
  const item = await getReviewItemById(db, reviewId);
  if (!item) throw new Error(`REVIEW_NOT_FOUND: ${reviewId}`);
  const events = await listReviewEvents(db, reviewId);
  return { plan: computeAutomationPlan(item, events), item, events };
}

export { getRunByIdempotencyKey };
