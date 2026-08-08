import { z } from "zod";

// Frozen M5 workflow evaluation contracts.
//
// Expectations are STRUCTURED. The M3 lesson was that free-text regexes over
// model prose produce false failures and hide real ones; here the primary truth
// is the persisted review item, its events, and the four routing/state fields.
// Free text is inspected only where a human actually typed something.
//
// Cases are frozen BEFORE the evaluator runs and are grounded in the synthetic
// fixtures, the M4 comparison semantics, the M5 routing table and the M5 state
// machine -- never in whatever the code happens to output today.

export const WORKFLOW_DECISIONS = [
  "allow_internal_draft",
  "allow_checklist_only",
  "block_client_draft",
] as const;

export const APPROVAL_LEVELS = [
  "not_required_for_internal_view",
  "standard_approval",
  "enhanced_review",
  "licensed_agent_required",
  "blocked",
] as const;

export const REVIEW_STATES = [
  "pending_review",
  "approved",
  "rejected",
  "revision_requested",
] as const;

const ProductId = z.string().regex(/^doc_[a-z0-9_]+$/);

/** Routing only: no persistence, no HTTP. Proves the rule, not the plumbing. */
const RoutingCase = z.object({
  id: z.string().min(1),
  kind: z.literal("routing"),
  note: z.string().min(1),
  /**
   * `fixture_flags` routes the case's OWN declared ground-truth risk flags --
   * the client baseline. `product_pair` routes a real comparison, which also
   * carries the flags of whichever products were selected.
   */
  source: z.enum(["fixture_flags", "product_pair", "synthetic_flags"]),
  productAId: ProductId.optional(),
  productBId: ProductId.optional(),
  clientCaseId: z.string().nullable(),
  syntheticReviewReasons: z.array(z.string()).optional(),
  syntheticComparisonStatus: z.enum(["complete", "partial", "blocked"]).optional(),
  expectedComparisonStatus: z.enum(["complete", "partial", "blocked"]).optional(),
  expectedWorkflowDecision: z.enum(WORKFLOW_DECISIONS),
  expectedApprovalLevel: z.enum(APPROVAL_LEVELS),
  /** Flags that must be present. Not an exhaustive list unless exact is true. */
  expectedReviewReasons: z.array(z.string()).default([]),
  exactReviewReasons: z.boolean().default(false),
  expectedChecklistKeys: z.array(z.string()).default([]),
  expectedChecklistEmpty: z.boolean().default(false),
  /** Runtime must land at or above the client baseline, never below it. */
  neverBelowBaseline: z.boolean().default(false),
});

/** Creation against the real database, using test-prefixed rows. */
const CreationCase = z.object({
  id: z.string().min(1),
  kind: z.literal("creation"),
  note: z.string().min(1),
  productAId: ProductId,
  productBId: ProductId,
  clientCaseId: z.string().nullable(),
  scenario: z.enum([
    "fresh",
    "duplicate_pending",
    "reverse_order_duplicate",
    "terminal_then_recreate",
    "concurrent",
  ]),
  expectedFirstAction: z.enum(["created", "existing_pending"]),
  expectedSecondAction: z.enum(["created", "existing_pending"]).optional(),
  expectedSameReviewId: z.boolean().optional(),
  expectedPendingItemCount: z.number().int().min(0),
  expectedCreatedEventCount: z.number().int().min(0),
  expectedInitialReviewState: z.enum(REVIEW_STATES).default("pending_review"),
});

/** One human decision, end to end, including stale second writers. */
const DecisionCase = z.object({
  id: z.string().min(1),
  kind: z.literal("decision"),
  note: z.string().min(1),
  productAId: ProductId,
  productBId: ProductId,
  clientCaseId: z.string().nullable(),
  decision: z.discriminatedUnion("type", [
    z.object({ type: z.literal("approve"), note: z.string().optional() }),
    z.object({ type: z.literal("reject"), reason: z.string() }),
    z.object({ type: z.literal("request_revision"), instructions: z.string() }),
  ]),
  /** A second decision attempted from a tab that still believed it was pending. */
  staleFollowUp: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("approve"), note: z.string().optional() }),
      z.object({ type: z.literal("reject"), reason: z.string() }),
      z.object({ type: z.literal("request_revision"), instructions: z.string() }),
    ])
    .optional(),
  expectedFinalReviewState: z.enum(REVIEW_STATES),
  expectedEvents: z.array(z.enum(["REVIEW_CREATED", "APPROVED", "REJECTED", "REVISION_REQUESTED"])),
  expectedStoredText: z.string().nullable().default(null),
  expectedStaleOutcome: z.enum(["conflict", "rejected_by_state_machine"]).optional(),
});

/** Transitions out of a terminal state, which the v1 machine has none of. */
const TransitionCase = z.object({
  id: z.string().min(1),
  kind: z.literal("transition"),
  note: z.string().min(1),
  from: z.enum(REVIEW_STATES),
  to: z.enum(REVIEW_STATES),
  expectedLegal: z.boolean(),
  expectedCode: z.string().nullable(),
});

/** What the browser is allowed to say. The schema IS the boundary. */
const TrustBoundaryCase = z.object({
  id: z.string().min(1),
  kind: z.literal("trust_boundary"),
  note: z.string().min(1),
  target: z.enum(["create", "decision"]),
  field: z.string().min(1),
  value: z.unknown(),
  expectedAccepted: z.literal(false),
});

/** Required human text. Trim before length, so whitespace is not a reason. */
const InputValidationCase = z.object({
  id: z.string().min(1),
  kind: z.literal("input_validation"),
  note: z.string().min(1),
  decisionType: z.enum(["reject", "request_revision"]),
  value: z.string(),
  expectedAccepted: z.boolean(),
  expectedStoredValue: z.string().optional(),
});

export const WorkflowCaseSchema = z.discriminatedUnion("kind", [
  RoutingCase,
  CreationCase,
  DecisionCase,
  TransitionCase,
  TrustBoundaryCase,
  InputValidationCase,
]);
export type WorkflowCase = z.infer<typeof WorkflowCaseSchema>;

export const WorkflowCaseFileSchema = z.object({
  schemaVersion: z.literal(1),
  frozenAt: z.string().min(1),
  note: z.string().min(1),
  cases: z.array(WorkflowCaseSchema).min(15),
});

// ---------------------------------------------------------------------------
// Results

export const CaseResultSchema = z.object({
  id: z.string(),
  kind: z.string(),
  passed: z.boolean(),
  failures: z.array(z.object({ gate: z.string(), detail: z.string() })),
  observed: z.record(z.string(), z.unknown()),
});
export type CaseResult = z.infer<typeof CaseResultSchema>;

/**
 * Every gate is deterministic and must be zero. There is no model in this
 * evaluation, so there is no tolerance band to argue about.
 */
export const HARD_GATES = [
  "wrong_workflow_routing",
  "wrong_approval_level",
  "invalid_state_transitions_accepted",
  "duplicate_terminal_decisions",
  "decisions_missing_audit_event",
  "creation_missing_review_created",
  "duplicate_pending_review_items",
  "reverse_order_duplicate_pending_items",
  "snapshot_mutation",
  "snapshot_hash_mismatch",
  "client_forged_verified_data_accepted",
  "client_forged_routing_accepted",
  "client_forged_reviewer_or_actor_accepted",
  "stale_concurrent_decisions_accepted",
  "case_c_client_facing_block_bypass",
  "blank_decision_reasons_accepted",
  "knowledge_base_mutation",
  "four_axis_collapse",
  "invented_checklist_requirement",
] as const;
export type HardGate = (typeof HARD_GATES)[number];

export const WorkflowRunSchema = z.object({
  schemaVersion: z.literal(1),
  caseFileFrozenAt: z.string(),
  totalCases: z.number().int(),
  passedCases: z.number().int(),
  hardGates: z.record(z.string(), z.number().int()),
  observations: z.record(z.string(), z.unknown()),
  results: z.array(CaseResultSchema),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
