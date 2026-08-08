import { z } from "zod";
import { WorkflowDecisionSchema } from "../schemas";
import { ReviewFlagSchema } from "../comparison/types";

// M5-A review-workflow contracts.
//
// CLAUDE.md §4 opens with the rule this module exists to honour: risk level,
// "may this become an internal draft" and "may this go to a client" must never
// share a field. M5 keeps FOUR axes distinct, and nothing in the codebase may
// alias one to another:
//
//   comparisonStatus       complete | partial | blocked
//                          Owned by M4. Are the FACTS trustworthy?
//   workflowDecision       allow_internal_draft | allow_checklist_only
//                          | block_client_draft
//                          Owned by deterministic M5 routing. How far may this
//                          travel?
//   requiredApprovalLevel  not_required_for_internal_view | standard_approval
//                          | enhanced_review | licensed_agent_required
//                          | blocked
//                          Owned by deterministic M5 routing. How much human
//                          authority is needed?
//   reviewState            pending_review | approved | rejected
//                          | revision_requested
//                          Owned by a HUMAN. How far has the work got?
//
// A comparison whose facts are perfect can still be blocked from client use and
// still be waiting for a licensed agent — that combination must stay
// expressible.

export { WorkflowDecisionSchema };
export type { WorkflowDecision } from "../schemas";

// CLAUDE.md §4.3 names this enum "ReviewStatus", but it answers "how much
// approval authority is required", not "what has happened so far". The name
// here says which one it is; the values are unchanged.
export const REQUIRED_APPROVAL_LEVELS = [
  "not_required_for_internal_view",
  "standard_approval",
  "enhanced_review",
  "licensed_agent_required",
  "blocked",
] as const;
export const RequiredApprovalLevelSchema = z.enum(REQUIRED_APPROVAL_LEVELS);
export type RequiredApprovalLevel = z.infer<typeof RequiredApprovalLevelSchema>;

// Workflow progress. Terminal states are terminal in v1: there is no reopen and
// no superseded, because there is no regeneration flow for them to describe.
export const REVIEW_STATES = [
  "pending_review",
  "approved",
  "rejected",
  "revision_requested",
] as const;
export const ReviewStateSchema = z.enum(REVIEW_STATES);
export type ReviewState = z.infer<typeof ReviewStateSchema>;

export const TERMINAL_REVIEW_STATES: readonly ReviewState[] = [
  "approved",
  "rejected",
  "revision_requested",
];

// v1 reviews comparison drafts only. The field exists so adding grounded
// answers later needs no schema change.
export const ReviewSourceTypeSchema = z.enum(["comparison_draft"]);
export type ReviewSourceType = z.infer<typeof ReviewSourceTypeSchema>;

export const REVIEW_EVENT_TYPES = [
  "REVIEW_CREATED",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUESTED",
] as const;
export const ReviewEventTypeSchema = z.enum(REVIEW_EVENT_TYPES);
export type ReviewEventType = z.infer<typeof ReviewEventTypeSchema>;

// ---------------------------------------------------------------------------
// Human decisions
//
// A model never produces any of these. Reject and request-revision demand a
// written reason precisely because they are the outcomes someone will have to
// justify later.

export const ReviewDecisionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("approve"), note: z.string().min(1).max(2000).optional() }).strict(),
  z.object({ type: z.literal("reject"), reason: z.string().min(1).max(2000) }).strict(),
  z
    .object({ type: z.literal("request_revision"), instructions: z.string().min(1).max(2000) })
    .strict(),
]);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export function decisionTargetState(decision: ReviewDecision): ReviewState {
  switch (decision.type) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "request_revision":
      return "revision_requested";
  }
}

export function decisionEventType(decision: ReviewDecision): ReviewEventType {
  switch (decision.type) {
    case "approve":
      return "APPROVED";
    case "reject":
      return "REJECTED";
    case "request_revision":
      return "REVISION_REQUESTED";
  }
}

// ---------------------------------------------------------------------------
// Persisted shapes

export const ReviewIdSchema = z.string().regex(/^rev_[A-Za-z0-9_-]+$/);
export const ReviewEventIdSchema = z.string().regex(/^evt_[A-Za-z0-9_-]+$/);
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

// Deterministic checklist entries are produced in M5-B; M5-A only needs to
// persist and return them faithfully.
export const ReviewChecklistItemSchema = z
  .object({
    key: z.string().min(1),
    labelZh: z.string().min(1),
    labelEn: z.string().min(1),
    sourceKind: z.enum(["fixture_checklist", "missing_client_info", "review_flag"]),
  })
  .strict();
export type ReviewChecklistItem = z.infer<typeof ReviewChecklistItemSchema>;

// Fields fixed when the item is created. Naming them together is the point:
// the decision path may not touch any of them, and the repository exposes no
// operation that could.
export const ReviewArtifactSchema = z.object({
  reviewId: ReviewIdSchema,
  sourceType: ReviewSourceTypeSchema,
  sourceKey: z.string().min(1),
  snapshot: z.unknown(), // a full ComparisonDraft; validated by its own schema in M5-B
  snapshotSha256: Sha256Schema,
  workflowDecision: WorkflowDecisionSchema,
  requiredApprovalLevel: RequiredApprovalLevelSchema,
  reviewReasons: z.array(ReviewFlagSchema),
  checklist: z.array(ReviewChecklistItemSchema),
});

export const ReviewItemRecordSchema = ReviewArtifactSchema.extend({
  reviewState: ReviewStateSchema,
  reviewer: z.string().min(1).nullable(),
  decisionNote: z.string().nullable(),
  revisionInstructions: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}).strict();
export type ReviewItemRecord = z.infer<typeof ReviewItemRecordSchema>;

export const ReviewEventSchema = z
  .object({
    eventId: ReviewEventIdSchema,
    reviewId: ReviewIdSchema,
    eventType: ReviewEventTypeSchema,
    actor: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
    occurredAt: z.string().min(1),
  })
  .strict();
export type ReviewEvent = z.infer<typeof ReviewEventSchema>;

// No authentication exists in this demo. `reviewer` is a placeholder label, not
// an identity assurance, and the UI and docs must say so.
export const DEMO_REVIEWER = "Demo Reviewer";

export const REVIEW_SCHEMA_VERSION = 1;

/**
 * Canonical JSON for hashing. Postgres `jsonb` does not preserve key order, so
 * a snapshot hashed on the way in and re-hashed after a round trip would not
 * match unless keys are ordered deterministically first. Without this,
 * "prove the reviewed artifact never changed" is unverifiable.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}
