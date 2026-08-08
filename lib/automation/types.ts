import { z } from "zod";

// Post-review automation contracts.
//
// There is exactly ONE kind of artifact: an internal follow-up task. The enum
// below has no client-facing member and the payload has no recipient field, so
// "this can never be sent to a client by mistake" is not a rule someone has to
// remember -- it is a value the system cannot express. Case C therefore needs
// no special branch, which is the point.
//
// No model participates anywhere in this module or the ones beside it. Whether
// automation fires, which task it is, and where it goes are all decided by
// deterministic code from data the server already stored.

export const TASK_TYPES = ["internal_followup", "internal_revision"] as const;
export const TaskTypeSchema = z.enum(TASK_TYPES);
export type TaskType = z.infer<typeof TaskTypeSchema>;

/** Why automation is not available. Shown to the reviewer, never inferred. */
export const ELIGIBILITY_REASONS = [
  "REVIEW_NOT_TERMINAL",
  "REJECTED_NO_AUTOMATION",
  "FACTS_UNVERIFIED",
  "MISSING_TERMINAL_EVENT",
] as const;
export const EligibilityReasonSchema = z.enum(ELIGIBILITY_REASONS);
export type EligibilityReason = z.infer<typeof EligibilityReasonSchema>;

/**
 * `mocked` is deliberately not a flavour of `delivered`. Nothing left the
 * process, and a demo that blurs the two is claiming an integration it does
 * not have.
 */
export const AUTOMATION_STATUSES = ["pending", "delivered", "failed", "mocked"] as const;
export const AutomationStatusSchema = z.enum(AUTOMATION_STATUSES);
export type AutomationStatus = z.infer<typeof AutomationStatusSchema>;

export const AUTOMATION_SCHEMA_VERSION = 1;
export const MAX_ATTEMPTS = 3;

export const AutomationIdSchema = z.string().regex(/^aut_[a-z0-9_-]+$/i);

// ---------------------------------------------------------------------------
// The outbound payload
//
// Allowlist serialization: fields are named here one at a time. Nothing is
// spread in from a review record, so a field added to the review contract
// later cannot silently start leaving the building.

export const AutomationPayloadSchema = z
  .object({
    schemaVersion: z.literal(AUTOMATION_SCHEMA_VERSION),
    /** reviewId:terminalEventId — stable, and n8n can dedupe on it too. */
    idempotencyKey: z.string().min(1),
    reviewId: z.string().min(1),
    taskType: TaskTypeSchema,

    // Carried so a human reading the task sees the same four axes the review
    // page shows, rather than re-deriving them from a title.
    reviewState: z.enum(["approved", "revision_requested"]),
    workflowDecision: z.enum([
      "allow_internal_draft",
      "allow_checklist_only",
      "block_client_draft",
    ]),
    requiredApprovalLevel: z.enum([
      "not_required_for_internal_view",
      "standard_approval",
      "enhanced_review",
      "licensed_agent_required",
      "blocked",
    ]),

    /** Synthetic demo client. Null for a product-only comparison. */
    clientDisplayName: z.string().min(1).nullable(),
    products: z.tuple([z.string().min(1), z.string().min(1)]),

    title: z.string().min(1),
    actionItems: z.array(z.string().min(1)),
    /** The reviewer's own words. Present only on a revision task. */
    reviewerInstructions: z.string().min(1).nullable(),
    reviewUrl: z.string().min(1),
    createdAt: z.string().min(1),
  })
  .strict();
export type AutomationPayload = z.infer<typeof AutomationPayloadSchema>;

// ---------------------------------------------------------------------------
// What n8n must say back
//
// Strict on purpose: a 200 with an empty body, an HTML error page, or a shape
// we do not recognise is NOT a delivery. Recording it as one would make the
// delivery history worse than having none.

export const AutomationAckSchema = z
  .object({
    accepted: z.literal(true),
    taskId: z.string().min(1),
  })
  .strict();
export type AutomationAck = z.infer<typeof AutomationAckSchema>;

// ---------------------------------------------------------------------------
// The persisted delivery record

export const AutomationRunRecordSchema = z
  .object({
    automationId: AutomationIdSchema,
    reviewId: z.string().min(1),
    triggerEventId: z.string().min(1),
    taskType: TaskTypeSchema,
    idempotencyKey: z.string().min(1),
    status: AutomationStatusSchema,
    attemptCount: z.number().int().min(0),
    responseCode: z.number().int().nullable(),
    externalTaskId: z.string().nullable(),
    /** A code, never a response body: bodies carry things we did not choose. */
    errorCode: z.string().nullable(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();
export type AutomationRunRecord = z.infer<typeof AutomationRunRecordSchema>;

export function buildIdempotencyKey(reviewId: string, terminalEventId: string): string {
  // The terminal event id comes from an append-only log, so it is stable and
  // unique for this decision. A timestamp would be neither.
  return `${reviewId}:${terminalEventId}`;
}
