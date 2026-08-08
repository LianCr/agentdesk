import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decisionEventType,
  decisionTargetState,
  ReviewEventSchema,
  ReviewItemRecordSchema,
  type ReviewDecision,
  type ReviewEvent,
  type ReviewItemRecord,
  type ReviewState,
} from "../reviews/types";
import { checkTransition } from "../reviews/state-machine";
import type { ReviewSummary } from "../reviews/summary";

// Narrow persistence for the review workflow.
//
// There is deliberately no `updateReviewItem(patch)` and no
// `deleteReviewItem(id)`. A generic mutation path would make the immutability
// of the reviewed artifact a matter of who remembers not to call it; here the
// only way to change a row is a decision, and the decision goes through one
// database function that also writes the audit event in the same transaction.
//
// Conventions follow lib/supabase/repository.ts: the client is injected as the
// first argument, rows are read and written in snake_case, and every failure
// becomes a prefixed `DB_*_FAILED:` message carrying no error object.

const ITEM_COLUMNS =
  "review_id, source_type, source_key, snapshot, snapshot_sha256, workflow_decision, " +
  "required_approval_level, review_reasons, checklist, review_state, reviewer, decision_note, " +
  "revision_instructions, created_at, updated_at";

const EVENT_COLUMNS = "event_id, review_id, event_type, actor, payload, occurred_at";

type ItemRow = Record<string, unknown>;

function toRecord(row: ItemRow): ReviewItemRecord {
  return ReviewItemRecordSchema.parse({
    reviewId: row.review_id,
    sourceType: row.source_type,
    sourceKey: row.source_key,
    snapshot: row.snapshot,
    snapshotSha256: row.snapshot_sha256,
    workflowDecision: row.workflow_decision,
    requiredApprovalLevel: row.required_approval_level,
    reviewReasons: row.review_reasons,
    checklist: row.checklist,
    reviewState: row.review_state,
    reviewer: row.reviewer ?? null,
    decisionNote: row.decision_note ?? null,
    revisionInstructions: row.revision_instructions ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function toEvent(row: Record<string, unknown>): ReviewEvent {
  return ReviewEventSchema.parse({
    eventId: row.event_id,
    reviewId: row.review_id,
    eventType: row.event_type,
    actor: row.actor,
    payload: row.payload ?? {},
    occurredAt: row.occurred_at,
  });
}

export interface NewReviewItem {
  reviewId: string;
  sourceType: "comparison_draft";
  sourceKey: string;
  snapshot: unknown;
  snapshotSha256: string;
  workflowDecision: ReviewItemRecord["workflowDecision"];
  requiredApprovalLevel: ReviewItemRecord["requiredApprovalLevel"];
  reviewReasons: ReviewItemRecord["reviewReasons"];
  checklist: ReviewItemRecord["checklist"];
  /** The REVIEW_CREATED event written alongside the item. */
  createdEventId: string;
  actor: string;
}

export type CreateOutcome =
  | { action: "created"; item: ReviewItemRecord }
  | { action: "existing_pending"; item: ReviewItemRecord };

/**
 * Creates a review item and its REVIEW_CREATED event in one transaction, so a
 * review can never exist without the event that says how it got there. A
 * concurrent create for the same source returns the pending item that already
 * exists rather than duplicating human work.
 */
export async function insertReviewItem(
  db: SupabaseClient,
  item: NewReviewItem,
): Promise<CreateOutcome> {
  const { data, error } = await db.rpc("create_review_item", {
    p_review_id: item.reviewId,
    p_source_type: item.sourceType,
    p_source_key: item.sourceKey,
    p_snapshot: item.snapshot,
    p_snapshot_sha256: item.snapshotSha256,
    p_workflow_decision: item.workflowDecision,
    p_required_approval_level: item.requiredApprovalLevel,
    p_review_reasons: item.reviewReasons,
    p_checklist: item.checklist,
    p_event_id: item.createdEventId,
    p_actor: item.actor,
  });
  if (error) throw new Error(`DB_REVIEW_CREATE_FAILED: ${error.message}`);

  const result = data as unknown as { action: "created" | "existing_pending"; review_id: string };
  const stored = await getReviewItemById(db, result.review_id);
  if (!stored) throw new Error(`DB_REVIEW_CREATE_FAILED: ${result.review_id} vanished after create`);
  return { action: result.action, item: stored };
}

export async function getReviewItemById(
  db: SupabaseClient,
  reviewId: string,
): Promise<ReviewItemRecord | null> {
  const { data, error } = await db
    .from("review_items")
    .select(ITEM_COLUMNS)
    .eq("review_id", reviewId)
    .maybeSingle();
  if (error) throw new Error(`DB_REVIEW_READ_FAILED: ${error.message}`);
  return data ? toRecord(data as unknown as ItemRow) : null;
}

export async function findPendingReviewBySourceKey(
  db: SupabaseClient,
  sourceKey: string,
): Promise<ReviewItemRecord | null> {
  const { data, error } = await db
    .from("review_items")
    .select(ITEM_COLUMNS)
    .eq("source_key", sourceKey)
    .eq("review_state", "pending_review")
    .maybeSingle();
  if (error) throw new Error(`DB_REVIEW_READ_FAILED: ${error.message}`);
  return data ? toRecord(data as unknown as ItemRow) : null;
}

export async function listReviewItems(
  db: SupabaseClient,
  filter: { reviewState?: ReviewState } = {},
): Promise<ReviewItemRecord[]> {
  let query = db.from("review_items").select(ITEM_COLUMNS).order("created_at", { ascending: false });
  if (filter.reviewState) query = query.eq("review_state", filter.reviewState);
  const { data, error } = await query;
  if (error) throw new Error(`DB_REVIEW_READ_FAILED: ${error.message}`);
  return (data ?? []).map((row) => toRecord(row as unknown as ItemRow));
}

/**
 * Queue rows. The snapshot is never selected: the few display strings the queue
 * needs are extracted by the database from the jsonb, so a queue of fifty
 * reviews does not move several megabytes to render one table.
 */
export async function listReviewSummaries(
  db: SupabaseClient,
  filter: { reviewState?: ReviewState } = {},
): Promise<ReviewSummary[]> {
  let query = db
    .from("review_items")
    .select(
      "review_id, review_state, workflow_decision, required_approval_level, review_reasons, " +
        "created_at, updated_at, " +
        "client_display_name:snapshot->clientContext->>displayName, " +
        "client_case_id:snapshot->clientContext->>caseId, " +
        "product_a_name:snapshot->productA->>productName, " +
        "product_b_name:snapshot->productB->>productName",
    )
    .order("created_at", { ascending: false });
  if (filter.reviewState) query = query.eq("review_state", filter.reviewState);
  const { data, error } = await query;
  if (error) throw new Error(`DB_REVIEW_READ_FAILED: ${error.message}`);
  return (data ?? []).map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    return {
      reviewId: row.review_id as string,
      reviewState: row.review_state as ReviewState,
      workflowDecision: row.workflow_decision as ReviewItemRecord["workflowDecision"],
      requiredApprovalLevel: row.required_approval_level as ReviewItemRecord["requiredApprovalLevel"],
      clientDisplayName: (row.client_display_name as string | null) ?? null,
      clientCaseId: (row.client_case_id as string | null) ?? null,
      productAName: (row.product_a_name as string | null) ?? "",
      productBName: (row.product_b_name as string | null) ?? "",
      reviewReasonCount: Array.isArray(row.review_reasons) ? row.review_reasons.length : 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  });
}

export async function listReviewEvents(db: SupabaseClient, reviewId: string): Promise<ReviewEvent[]> {
  const { data, error } = await db
    .from("review_events")
    .select(EVENT_COLUMNS)
    .eq("review_id", reviewId)
    .order("occurred_at", { ascending: true });
  if (error) throw new Error(`DB_REVIEW_READ_FAILED: ${error.message}`);
  return (data ?? []).map((row) => toEvent(row as unknown as Record<string, unknown>));
}

export type DecisionOutcome =
  | { action: "decided"; reviewState: ReviewState }
  | { action: "conflict"; reviewState: ReviewState };

/**
 * Applies a human decision. The state change and its audit event happen inside
 * one database transaction guarded by a compare-and-set on the state the
 * caller believed it was acting on, so a stale second decision changes nothing
 * and appends nothing.
 */
export async function decideReviewItem(
  db: SupabaseClient,
  args: {
    reviewId: string;
    expectedState: ReviewState;
    decision: ReviewDecision;
    actor: string;
    eventId: string;
  },
): Promise<DecisionOutcome> {
  const targetState = decisionTargetState(args.decision);
  // Guard locally too, so an impossible transition never reaches the database.
  const transition = checkTransition(args.expectedState, targetState);
  if (!transition.ok) throw new Error(`${transition.code}: ${transition.message}`);

  const { data, error } = await db.rpc("decide_review_item", {
    p_review_id: args.reviewId,
    p_expected_state: args.expectedState,
    p_new_state: targetState,
    p_event_type: decisionEventType(args.decision),
    p_event_id: args.eventId,
    p_actor: args.actor,
    // The reviewer's own words, whichever kind of decision it was. Passed into
    // the RPC rather than written afterwards: a follow-up UPDATE would put the
    // reason outside the transaction that recorded the decision.
    p_decision_note:
      args.decision.type === "approve"
        ? args.decision.note ?? null
        : args.decision.type === "reject"
          ? args.decision.reason
          : null,
    p_revision_instructions:
      args.decision.type === "request_revision" ? args.decision.instructions : null,
    p_payload:
      args.decision.type === "reject"
        ? { reason: args.decision.reason }
        : args.decision.type === "request_revision"
          ? { instructions: args.decision.instructions }
          : args.decision.note
            ? { note: args.decision.note }
            : {},
  });
  if (error) throw new Error(`DB_REVIEW_DECISION_FAILED: ${error.message}`);

  const result = data as unknown as { action: string; review_state: ReviewState };
  return result.action === "conflict"
    ? { action: "conflict", reviewState: result.review_state }
    : { action: "decided", reviewState: result.review_state };
}

// ---------------------------------------------------------------------------
// Test-data cleanup. Mirrors assertTestDocumentId: destructive helpers refuse
// anything that is not explicitly test data, so a bug in a test can never
// remove a real review.

export const TEST_REVIEW_PREFIX = "rev_test_";
export const TEST_EVENT_PREFIX = "evt_test_";

export function assertTestReviewId(reviewId: string): void {
  if (!reviewId.startsWith(TEST_REVIEW_PREFIX)) {
    throw new Error(
      `refusing destructive operation on non-test review id "${reviewId}" ` +
        `(must start with "${TEST_REVIEW_PREFIX}")`,
    );
  }
}

export async function deleteTestReviewData(db: SupabaseClient, reviewId: string): Promise<void> {
  assertTestReviewId(reviewId);
  // The append-only trigger permits deletes only for rev_test_ rows, so this
  // is guarded twice: here, and in the database itself.
  const { error: eventError } = await db.from("review_events").delete().eq("review_id", reviewId);
  if (eventError) throw new Error(`review event cleanup failed for ${reviewId}: ${eventError.message}`);
  const { error } = await db.from("review_items").delete().eq("review_id", reviewId);
  if (error) throw new Error(`review cleanup failed for ${reviewId}: ${error.message}`);
}
