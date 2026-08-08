import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AutomationRunRecordSchema,
  type AutomationRunRecord,
  type AutomationStatus,
  type TaskType,
} from "./types";

// Persistence for delivery attempts.
//
// There is no path from this module to review_items. That is what makes "a
// failed webhook cannot change a human decision" structural rather than a
// promise: the code to do it does not exist.
//
// Conventions follow lib/supabase/reviews-repository.ts: the client is injected
// first, rows are snake_case, and failures become prefixed `DB_*_FAILED:`
// messages carrying no error object.

const COLUMNS =
  "automation_id, review_id, trigger_event_id, task_type, idempotency_key, status, " +
  "attempt_count, response_code, external_task_id, error_code, created_at, updated_at";

function toRecord(row: Record<string, unknown>): AutomationRunRecord {
  return AutomationRunRecordSchema.parse({
    automationId: row.automation_id,
    reviewId: row.review_id,
    triggerEventId: row.trigger_event_id,
    taskType: row.task_type,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    attemptCount: row.attempt_count,
    responseCode: row.response_code ?? null,
    externalTaskId: row.external_task_id ?? null,
    errorCode: row.error_code ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export interface NewAutomationRun {
  automationId: string;
  reviewId: string;
  triggerEventId: string;
  taskType: TaskType;
  idempotencyKey: string;
}

/**
 * Claims the delivery for a decision, or hands back the one that already
 * exists. The unique index on idempotency_key is the lock -- no advisory lock
 * is needed, because the constraint is the same serialization point and the
 * database enforces it whether or not the caller remembers to.
 */
export async function insertOrGetRun(
  db: SupabaseClient,
  run: NewAutomationRun,
): Promise<{ created: boolean; run: AutomationRunRecord }> {
  const { data, error } = await db
    .from("automation_runs")
    .insert({
      automation_id: run.automationId,
      review_id: run.reviewId,
      trigger_event_id: run.triggerEventId,
      task_type: run.taskType,
      idempotency_key: run.idempotencyKey,
      status: "pending",
      attempt_count: 0,
    })
    .select(COLUMNS)
    .maybeSingle();

  if (!error && data) {
    return { created: true, run: toRecord(data as unknown as Record<string, unknown>) };
  }
  // 23505 = unique_violation: someone already claimed this decision.
  if (error && error.code !== "23505") {
    throw new Error(`DB_AUTOMATION_CREATE_FAILED: ${error.message}`);
  }

  const existing = await getRunByIdempotencyKey(db, run.idempotencyKey);
  if (!existing) {
    throw new Error(`DB_AUTOMATION_CREATE_FAILED: no run for ${run.idempotencyKey}`);
  }
  return { created: false, run: existing };
}

export async function getRunByIdempotencyKey(
  db: SupabaseClient,
  idempotencyKey: string,
): Promise<AutomationRunRecord | null> {
  const { data, error } = await db
    .from("automation_runs")
    .select(COLUMNS)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error(`DB_AUTOMATION_READ_FAILED: ${error.message}`);
  return data ? toRecord(data as unknown as Record<string, unknown>) : null;
}

export async function listRunsForReview(
  db: SupabaseClient,
  reviewId: string,
): Promise<AutomationRunRecord[]> {
  const { data, error } = await db
    .from("automation_runs")
    .select(COLUMNS)
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`DB_AUTOMATION_READ_FAILED: ${error.message}`);
  return (data ?? []).map((row) => toRecord(row as unknown as Record<string, unknown>));
}

/** Records what the attempt did. The only mutable fields are the outcome. */
export async function recordAttempt(
  db: SupabaseClient,
  args: {
    automationId: string;
    status: AutomationStatus;
    attemptCount: number;
    responseCode: number | null;
    externalTaskId: string | null;
    errorCode: string | null;
  },
): Promise<AutomationRunRecord> {
  const { data, error } = await db
    .from("automation_runs")
    .update({
      status: args.status,
      attempt_count: args.attemptCount,
      response_code: args.responseCode,
      external_task_id: args.externalTaskId,
      error_code: args.errorCode,
      updated_at: new Date().toISOString(),
    })
    .eq("automation_id", args.automationId)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`DB_AUTOMATION_UPDATE_FAILED: ${error.message}`);
  return toRecord(data as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Test-data cleanup. Mirrors assertTestReviewId: destructive helpers refuse
// anything that is not explicitly test data.

export const TEST_AUTOMATION_PREFIX = "aut_test_";

export function assertTestAutomationId(automationId: string): void {
  if (!automationId.startsWith(TEST_AUTOMATION_PREFIX)) {
    throw new Error(
      `refusing destructive operation on non-test automation id "${automationId}" ` +
        `(must start with "${TEST_AUTOMATION_PREFIX}")`,
    );
  }
}

export async function deleteTestAutomationRun(
  db: SupabaseClient,
  automationId: string,
): Promise<void> {
  assertTestAutomationId(automationId);
  const { error } = await db.from("automation_runs").delete().eq("automation_id", automationId);
  if (error) throw new Error(`automation cleanup failed for ${automationId}: ${error.message}`);
}
