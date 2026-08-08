import { randomUUID } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compareProducts } from "../lib/comparison/compare";
import { DerivedChunksFileSchema, type ChunkRecord } from "../lib/ingestion/types";
import {
  ProductCatalogSchema,
  SyntheticCaseSchema,
  type ProductDefinition,
  type SyntheticCase,
} from "../lib/schemas";
import { computeWorkflowRouting } from "../lib/guardrails/rules";
import { buildReviewChecklist } from "../lib/reviews/checklist";
import { hashReviewSnapshot, type ReviewSnapshot } from "../lib/reviews/snapshot";
import { CreateReviewInputSchema, createReview } from "../lib/reviews/create-review";
import { checkTransition } from "../lib/reviews/state-machine";
import { ReviewDecisionSchema } from "../lib/reviews/types";
import { createServiceClient } from "../lib/supabase/server";
import {
  decideReviewItem,
  deleteTestReviewData,
  getReviewItemById,
  listReviewEvents,
} from "../lib/supabase/reviews-repository";
import type { ReviewFlag } from "../lib/comparison/types";
import {
  HARD_GATES,
  WorkflowCaseFileSchema,
  type CaseResult,
  type HardGate,
  type WorkflowCase,
  type WorkflowRun,
} from "./workflow-schema";

// M5 workflow evaluator.
//
// STRUCTURED FIRST. Every judgement below reads a persisted field, an event
// list, a routing value or a schema outcome. Free text is inspected in exactly
// one place -- whether the human's own words were stored as written -- because
// that is the only place a human typed anything.
//
// Destructive scenarios run against real persistence using rev_test_ /
// evt_test_ rows and test_ source keys, so they exercise the real triggers,
// the real advisory locks and the real compare-and-set. Non-test review
// history is never read for judgement and never touched.
//
//   npm run eval:workflow -- --out=evals/results/m5-final.json

const ROOT = process.cwd();
const CASE_FILE = join(ROOT, "evals/workflow-cases.json");
const APPROVAL_RANK = [
  "not_required_for_internal_view",
  "standard_approval",
  "enhanced_review",
  "licensed_agent_required",
  "blocked",
];

type Gates = Record<HardGate, number>;

// Read directly rather than through lib/comparison/loader: that module is
// `server-only`, which is correct for the app and unimportable from a script.
interface Catalog {
  products: ProductDefinition[];
  chunksByDocumentId: Record<string, ChunkRecord[]>;
  cases: SyntheticCase[];
}

async function loadCatalog(): Promise<Catalog> {
  const catalog = ProductCatalogSchema.parse(
    JSON.parse(await readFile(join(ROOT, "data/fictional-products/products.json"), "utf8")),
  );
  const chunksByDocumentId: Record<string, ChunkRecord[]> = {};
  for (const product of catalog.products) {
    chunksByDocumentId[product.documentId] = DerivedChunksFileSchema.parse(
      JSON.parse(
        await readFile(join(ROOT, `data/derived/chunks/${product.documentId}.chunks.json`), "utf8"),
      ),
    ).chunks;
  }
  const caseDir = join(ROOT, "data/synthetic-cases");
  const cases: SyntheticCase[] = [];
  for (const file of (await readdir(caseDir)).sort()) {
    if (file.endsWith(".json")) {
      cases.push(SyntheticCaseSchema.parse(JSON.parse(await readFile(join(caseDir, file), "utf8"))));
    }
  }
  return { products: catalog.products, chunksByDocumentId, cases };
}

interface Ctx {
  db: SupabaseClient;
  catalog: Catalog;
  gates: Gates;
  /** Every test review this run created, for cleanup. */
  created: Set<string>;
}

function fail(result: CaseResult, gate: HardGate | "case_expectation", detail: string, ctx: Ctx) {
  result.passed = false;
  result.failures.push({ gate, detail });
  if (gate !== "case_expectation") ctx.gates[gate] += 1;
}

// ---------------------------------------------------------------------------
// Shared helpers

function buildDraft(ctx: Ctx, a: string, b: string, clientCaseId: string | null) {
  const productA = ctx.catalog.products.find((p) => p.documentId === a)!;
  const productB = ctx.catalog.products.find((p) => p.documentId === b)!;
  const syntheticCase = clientCaseId
    ? (ctx.catalog.cases.find((c) => c.caseId === clientCaseId) ?? null)
    : null;
  return compareProducts({
    productA,
    productB,
    chunksByDocumentId: ctx.catalog.chunksByDocumentId,
    syntheticCase,
    comparisonIdFactory: () => "cmp_eval",
    now: () => 0,
  });
}

/** The client baseline: what the case's OWN declared risk flags demand. */
function baselineFor(ctx: Ctx, clientCaseId: string | null) {
  if (!clientCaseId) return null;
  const fixture = ctx.catalog.cases.find((c) => c.caseId === clientCaseId);
  if (!fixture) return null;
  const declared = (fixture.expected.requiredRiskFlags ?? []) as string[];
  const mapped: ReviewFlag[] = ["CLIENT_FACING_DRAFT"];
  // The fixtures predate the ReviewFlag vocabulary and use their own snake_case
  // names. This is a transcription, not a second set of semantics: each entry
  // maps one fixture term onto the flag M4 already computes for the same fact.
  const MAP: Record<string, ReviewFlag> = {
    non_guaranteed_elements_discussion: "NON_GUARANTEED_ELEMENTS",
    illustration_required: "ILLUSTRATION_REQUIRED",
    specific_return_or_value_numbers: "SPECIFIC_VALUE_REQUEST",
    replacement_of_existing_policy: "REPLACEMENT_CONTEXT",
    age_65_plus: "AGE_65_PLUS",
    surrender_charge_exposure: "SURRENDER_CHARGE_EXPOSURE",
    market_value_adjustment_exposure: "MARKET_VALUE_ADJUSTMENT_EXPOSURE",
  };
  const unmapped: string[] = [];
  for (const flag of declared) {
    const hit = MAP[flag];
    if (hit) mapped.push(hit);
    // annuity_suitability has no ReviewFlag counterpart. Recorded as a gap
    // rather than force-mapped onto a flag that means something else.
    else unmapped.push(flag);
  }
  const routing = computeWorkflowRouting({
    reviewReasons: mapped,
    comparisonStatus: "complete",
    client: null,
  });
  return { routing, mapped, unmapped, fixtureLevel: fixture.expected.reviewStatus };
}

const AXIS_VOCABULARY = {
  comparisonStatus: ["complete", "partial", "blocked"],
  workflowDecision: ["allow_internal_draft", "allow_checklist_only", "block_client_draft"],
  requiredApprovalLevel: [
    "not_required_for_internal_view",
    "standard_approval",
    "enhanced_review",
    "licensed_agent_required",
    "blocked",
  ],
  reviewState: ["pending_review", "approved", "rejected", "revision_requested"],
} as const;

/**
 * Each axis is a separate question with its own answers. A field holding a
 * value from another axis's vocabulary means the two have been collapsed --
 * "client-facing use is blocked" quietly becoming "a human rejected it", or an
 * approval level standing in for a workflow state.
 */
function axisVocabularyViolations(axes: Partial<Record<keyof typeof AXIS_VOCABULARY, string>>): string[] {
  const violations: string[] = [];
  for (const [axis, value] of Object.entries(axes)) {
    if (value === undefined) continue;
    const own = AXIS_VOCABULARY[axis as keyof typeof AXIS_VOCABULARY] as readonly string[];
    if (!own.includes(value)) {
      violations.push(`${axis} holds "${value}", which is not one of its values`);
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Routing cases

function evaluateRouting(ctx: Ctx, c: Extract<WorkflowCase, { kind: "routing" }>): CaseResult {
  const result: CaseResult = { id: c.id, kind: c.kind, passed: true, failures: [], observed: {} };

  let reviewReasons: ReviewFlag[];
  let comparisonStatus: "complete" | "partial" | "blocked";
  let checklistKeys: string[] = [];

  if (c.source === "synthetic_flags") {
    reviewReasons = (c.syntheticReviewReasons ?? []) as ReviewFlag[];
    comparisonStatus = c.syntheticComparisonStatus ?? "complete";
  } else if (c.source === "fixture_flags") {
    const baseline = baselineFor(ctx, c.clientCaseId);
    if (!baseline) {
      fail(result, "case_expectation", `no fixture for ${c.clientCaseId}`, ctx);
      return result;
    }
    reviewReasons = baseline.mapped;
    comparisonStatus = "complete";
    result.observed.unmappedFixtureFlags = baseline.unmapped;
    result.observed.fixtureDeclaredLevel = baseline.fixtureLevel;
    // The baseline must reconcile against the level the fixture itself
    // declares. This is the assertion the runtime-pair cases are NOT allowed
    // to make, and keeping them apart is the whole Case A lesson.
    if (baseline.routing.requiredApprovalLevel !== baseline.fixtureLevel) {
      fail(
        result,
        "wrong_approval_level",
        `baseline ${baseline.routing.requiredApprovalLevel} != fixture-declared ${baseline.fixtureLevel}`,
        ctx,
      );
    }
  } else {
    const draft = buildDraft(ctx, c.productAId!, c.productBId!, c.clientCaseId);
    reviewReasons = [...draft.reviewReasons];
    comparisonStatus = draft.comparisonStatus;
    const routing = computeWorkflowRouting({
      reviewReasons: draft.reviewReasons,
      comparisonStatus: draft.comparisonStatus,
      client: draft.clientContext,
    });
    checklistKeys = buildReviewChecklist({
      draft,
      workflowDecision: routing.workflowDecision,
    }).map((item) => item.key);
  }

  const routing = computeWorkflowRouting({
    reviewReasons,
    comparisonStatus,
    client: null,
  });
  result.observed.workflowDecision = routing.workflowDecision;
  result.observed.requiredApprovalLevel = routing.requiredApprovalLevel;
  result.observed.comparisonStatus = comparisonStatus;
  result.observed.reviewReasons = reviewReasons;

  if (routing.workflowDecision !== c.expectedWorkflowDecision) {
    fail(
      result,
      "wrong_workflow_routing",
      `expected ${c.expectedWorkflowDecision}, got ${routing.workflowDecision}`,
      ctx,
    );
  }
  if (routing.requiredApprovalLevel !== c.expectedApprovalLevel) {
    fail(
      result,
      "wrong_approval_level",
      `expected ${c.expectedApprovalLevel}, got ${routing.requiredApprovalLevel}`,
      ctx,
    );
  }
  if (c.expectedComparisonStatus && comparisonStatus !== c.expectedComparisonStatus) {
    fail(
      result,
      "case_expectation",
      `comparisonStatus expected ${c.expectedComparisonStatus}, got ${comparisonStatus}`,
      ctx,
    );
  }

  // Four axes must not collapse into one another. Distinct STRINGS is the
  // wrong test -- comparisonStatus "blocked" and approval level "blocked"
  // legitimately coincide. The property is that each field only ever holds a
  // value from its own vocabulary, so a routing value can never end up
  // standing in for a status or a human state.
  for (const violation of axisVocabularyViolations({
    comparisonStatus,
    workflowDecision: routing.workflowDecision,
    requiredApprovalLevel: routing.requiredApprovalLevel,
  })) {
    fail(result, "four_axis_collapse", violation, ctx);
  }

  for (const flag of c.expectedReviewReasons) {
    if (!reviewReasons.includes(flag as ReviewFlag)) {
      fail(result, "case_expectation", `missing review reason ${flag}`, ctx);
    }
  }
  if (c.exactReviewReasons) {
    const extra = reviewReasons.filter((f: ReviewFlag) => !c.expectedReviewReasons.includes(f));
    if (extra.length > 0) {
      fail(result, "case_expectation", `unexpected review reasons ${extra.join(",")}`, ctx);
    }
  }

  if (c.neverBelowBaseline) {
    const baseline = baselineFor(ctx, c.clientCaseId);
    if (baseline) {
      const observedRank = APPROVAL_RANK.indexOf(routing.requiredApprovalLevel);
      const baselineRank = APPROVAL_RANK.indexOf(baseline.routing.requiredApprovalLevel);
      result.observed.baselineApprovalLevel = baseline.routing.requiredApprovalLevel;
      if (observedRank < baselineRank) {
        fail(
          result,
          "wrong_approval_level",
          `runtime ${routing.requiredApprovalLevel} is below baseline ${baseline.routing.requiredApprovalLevel}`,
          ctx,
        );
      }
      // The flags the products raise must actually be consumed: removing them
      // has to lower the level, otherwise "it escalated" is unfalsifiable.
      if (c.source === "product_pair" && observedRank > baselineRank) {
        const withoutProductFlags = computeWorkflowRouting({
          reviewReasons: baseline.mapped,
          comparisonStatus,
          client: null,
        });
        if (withoutProductFlags.requiredApprovalLevel === routing.requiredApprovalLevel) {
          fail(
            result,
            "case_expectation",
            "escalation is not attributable to product flags: removing them changes nothing",
            ctx,
          );
        }
      }
    }
  }

  result.observed.checklistKeys = checklistKeys;
  if (c.expectedChecklistEmpty && checklistKeys.length > 0) {
    fail(result, "case_expectation", `expected no checklist, got ${checklistKeys.length}`, ctx);
  }
  for (const key of c.expectedChecklistKeys) {
    if (!checklistKeys.includes(key)) {
      fail(result, "case_expectation", `missing required checklist item "${key}"`, ctx);
    }
  }
  if (c.expectedChecklistKeys.length > 0) {
    // Deduplication holds, and nothing regulatory was invented: every item must
    // come from the fixture, the missing-information list or a raised flag.
    if (new Set(checklistKeys).size !== checklistKeys.length) {
      fail(result, "case_expectation", "checklist contains duplicate keys", ctx);
    }
    const draft = buildDraft(ctx, c.productAId!, c.productBId!, c.clientCaseId);
    const routingForList = computeWorkflowRouting({
      reviewReasons: draft.reviewReasons,
      comparisonStatus: draft.comparisonStatus,
      client: draft.clientContext,
    });
    const allowed = new Set<string>([
      ...c.expectedChecklistKeys,
      ...draft.missingClientInformation.map((m) => m.field),
    ]);
    const invented = buildReviewChecklist({ draft, workflowDecision: routingForList.workflowDecision })
      .filter((item) => !allowed.has(item.key))
      .map((item) => item.key);
    if (invented.length > 0) {
      fail(
        result,
        "invented_checklist_requirement",
        `checklist items traceable to nothing: ${invented.join(", ")}`,
        ctx,
      );
    }
  }

  if (c.expectedWorkflowDecision === "block_client_draft" && routing.workflowDecision !== "block_client_draft") {
    fail(result, "case_c_client_facing_block_bypass", "client-facing block was not applied", ctx);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Persistence-backed cases

let counter = 0;
function testIds(caseId: string) {
  counter += 1;
  return {
    reviewId: () => `rev_test_${caseId}_${counter}_${randomUUID().slice(0, 8)}`,
    eventId: () => `evt_test_${caseId}_${counter}_${randomUUID().slice(0, 8)}`,
  };
}

async function createTestReview(
  ctx: Ctx,
  caseId: string,
  input: { productAId: string; productBId: string; clientCaseId: string | null },
) {
  const ids = testIds(caseId);
  const outcome = await createReview(
    {
      db: ctx.db,
      products: ctx.catalog.products,
      chunksByDocumentId: ctx.catalog.chunksByDocumentId,
      cases: ctx.catalog.cases,
      // Namespaced so evaluation can never collide with, or be answered by,
      // the real development review history.
      sourceKeyPrefix: `test_eval_${caseId}_`,
      reviewIdFactory: ids.reviewId,
      eventIdFactory: ids.eventId,
    },
    input,
  );
  ctx.created.add(outcome.reviewItem.reviewId);
  return outcome;
}

async function evaluateCreation(
  ctx: Ctx,
  c: Extract<WorkflowCase, { kind: "creation" }>,
): Promise<CaseResult> {
  const result: CaseResult = { id: c.id, kind: c.kind, passed: true, failures: [], observed: {} };
  const input = { productAId: c.productAId, productBId: c.productBId, clientCaseId: c.clientCaseId };

  let first: Awaited<ReturnType<typeof createTestReview>>;
  let second: Awaited<ReturnType<typeof createTestReview>> | null = null;

  if (c.scenario === "concurrent") {
    const [a, b] = await Promise.all([
      createTestReview(ctx, c.id, input),
      createTestReview(ctx, c.id, input),
    ]);
    // Whichever won, one created and one was handed the open item.
    [first, second] = a.action === "created" ? [a, b] : [b, a];
  } else {
    first = await createTestReview(ctx, c.id, input);
    if (c.scenario === "duplicate_pending") {
      second = await createTestReview(ctx, c.id, input);
    } else if (c.scenario === "reverse_order_duplicate") {
      second = await createTestReview(ctx, c.id, {
        productAId: c.productBId,
        productBId: c.productAId,
        clientCaseId: c.clientCaseId,
      });
    } else if (c.scenario === "terminal_then_recreate") {
      const ids = testIds(c.id);
      await decideReviewItem(ctx.db, {
        reviewId: first.reviewItem.reviewId,
        expectedState: "pending_review",
        decision: { type: "approve", note: "Closing so the source can be reviewed again." },
        actor: "Demo Reviewer",
        eventId: ids.eventId(),
      });
      second = await createTestReview(ctx, c.id, input);
    }
  }

  result.observed.firstAction = first.action;
  result.observed.secondAction = second?.action ?? null;
  result.observed.firstReviewId = first.reviewItem.reviewId;

  if (first.action !== c.expectedFirstAction) {
    fail(result, "case_expectation", `first action ${first.action} != ${c.expectedFirstAction}`, ctx);
  }
  if (c.expectedSecondAction && second?.action !== c.expectedSecondAction) {
    fail(
      result,
      c.expectedSecondAction === "existing_pending"
        ? c.scenario === "reverse_order_duplicate"
          ? "reverse_order_duplicate_pending_items"
          : "duplicate_pending_review_items"
        : "case_expectation",
      `second action ${second?.action} != ${c.expectedSecondAction}`,
      ctx,
    );
  }
  if (c.expectedSameReviewId !== undefined && second) {
    const same = second.reviewItem.reviewId === first.reviewItem.reviewId;
    if (same !== c.expectedSameReviewId) {
      fail(
        result,
        c.scenario === "reverse_order_duplicate"
          ? "reverse_order_duplicate_pending_items"
          : "duplicate_pending_review_items",
        `sameReviewId ${same} != ${c.expectedSameReviewId}`,
        ctx,
      );
    }
  }

  // The item exists and its creation event exists with it.
  const stored = await getReviewItemById(ctx.db, first.reviewItem.reviewId);
  if (!stored) {
    fail(result, "creation_missing_review_created", "review item vanished after create", ctx);
    return result;
  }
  const events = await listReviewEvents(ctx.db, stored.reviewId);
  const createdEvents = events.filter((e) => e.eventType === "REVIEW_CREATED");
  result.observed.createdEventCount = createdEvents.length;
  if (createdEvents.length !== c.expectedCreatedEventCount) {
    fail(
      result,
      "creation_missing_review_created",
      `REVIEW_CREATED count ${createdEvents.length} != ${c.expectedCreatedEventCount}`,
      ctx,
    );
  }

  // Snapshot hash matches what the stored snapshot canonically hashes to.
  const rehashed = hashReviewSnapshot(stored.snapshot as ReviewSnapshot);
  result.observed.snapshotSha256 = stored.snapshotSha256;
  if (rehashed !== stored.snapshotSha256) {
    fail(result, "snapshot_hash_mismatch", `stored hash does not match its snapshot`, ctx);
  }

  // Exactly one pending item for this source key.
  const { data, error } = await ctx.db
    .from("review_items")
    .select("review_id")
    .eq("source_key", stored.sourceKey)
    .eq("review_state", "pending_review");
  if (error) throw new Error(`DB_REVIEW_READ_FAILED: ${error.message}`);
  result.observed.pendingItemsForSource = (data ?? []).length;
  if ((data ?? []).length !== c.expectedPendingItemCount) {
    fail(
      result,
      "duplicate_pending_review_items",
      `pending items for source ${(data ?? []).length} != ${c.expectedPendingItemCount}`,
      ctx,
    );
  }

  if (c.scenario !== "terminal_then_recreate" && stored.reviewState !== c.expectedInitialReviewState) {
    fail(
      result,
      "case_expectation",
      `initial state ${stored.reviewState} != ${c.expectedInitialReviewState}`,
      ctx,
    );
  }
  return result;
}

async function evaluateDecision(
  ctx: Ctx,
  c: Extract<WorkflowCase, { kind: "decision" }>,
): Promise<CaseResult> {
  const result: CaseResult = { id: c.id, kind: c.kind, passed: true, failures: [], observed: {} };
  const created = await createTestReview(ctx, c.id, {
    productAId: c.productAId,
    productBId: c.productBId,
    clientCaseId: c.clientCaseId,
  });
  const reviewId = created.reviewItem.reviewId;
  const snapshotBefore = created.reviewItem.snapshotSha256;
  const routingBefore = {
    workflowDecision: created.reviewItem.workflowDecision,
    requiredApprovalLevel: created.reviewItem.requiredApprovalLevel,
    reviewReasons: [...created.reviewItem.reviewReasons],
  };

  const ids = testIds(c.id);
  await decideReviewItem(ctx.db, {
    reviewId,
    expectedState: "pending_review",
    decision: ReviewDecisionSchema.parse(c.decision),
    actor: "Demo Reviewer",
    eventId: ids.eventId(),
  });

  if (c.staleFollowUp) {
    // A second writer that still believes the review is pending.
    const outcome = await decideReviewItem(ctx.db, {
      reviewId,
      expectedState: "pending_review",
      decision: ReviewDecisionSchema.parse(c.staleFollowUp),
      actor: "Demo Reviewer",
      eventId: ids.eventId(),
    });
    result.observed.staleOutcome = outcome.action;
    if (outcome.action !== "conflict") {
      fail(result, "stale_concurrent_decisions_accepted", `stale write returned ${outcome.action}`, ctx);
    }
  }

  const after = await getReviewItemById(ctx.db, reviewId);
  if (!after) {
    fail(result, "case_expectation", "review vanished after decision", ctx);
    return result;
  }
  const events = await listReviewEvents(ctx.db, reviewId);
  const types = events.map((e) => e.eventType);
  result.observed.finalReviewState = after.reviewState;
  result.observed.events = types;
  result.observed.reviewer = after.reviewer;

  if (after.reviewState !== c.expectedFinalReviewState) {
    fail(
      result,
      "case_expectation",
      `final state ${after.reviewState} != ${c.expectedFinalReviewState}`,
      ctx,
    );
  }
  if (JSON.stringify(types) !== JSON.stringify(c.expectedEvents)) {
    const terminal = types.filter((t) => t !== "REVIEW_CREATED");
    fail(
      result,
      terminal.length > 1 ? "duplicate_terminal_decisions" : "decisions_missing_audit_event",
      `events [${types.join(",")}] != [${c.expectedEvents.join(",")}]`,
      ctx,
    );
  }
  // The terminal event must name the state the item ended in.
  const TERMINAL_FOR: Record<string, string> = {
    approved: "APPROVED",
    rejected: "REJECTED",
    revision_requested: "REVISION_REQUESTED",
  };
  const expectedTerminal = TERMINAL_FOR[after.reviewState];
  if (expectedTerminal && !(types as string[]).includes(expectedTerminal)) {
    fail(
      result,
      "decisions_missing_audit_event",
      `state ${after.reviewState} has no ${expectedTerminal} event`,
      ctx,
    );
  }
  if (after.reviewer !== "Demo Reviewer") {
    fail(result, "client_forged_reviewer_or_actor_accepted", `reviewer is ${after.reviewer}`, ctx);
  }
  for (const event of events) {
    if (event.actor !== "Demo Reviewer") {
      fail(result, "client_forged_reviewer_or_actor_accepted", `event actor ${event.actor}`, ctx);
    }
  }

  // The reviewer's own words. The only free-text check in the evaluator.
  const storedText = after.revisionInstructions ?? after.decisionNote;
  result.observed.storedText = storedText;
  if (c.expectedStoredText !== null && storedText !== c.expectedStoredText) {
    fail(result, "case_expectation", `stored text ${JSON.stringify(storedText)}`, ctx);
  }

  // A decision changes state; it must not touch the artifact or its routing.
  if (after.snapshotSha256 !== snapshotBefore) {
    fail(result, "snapshot_mutation", "snapshot hash changed across a decision", ctx);
  }
  if (hashReviewSnapshot(after.snapshot as ReviewSnapshot) !== after.snapshotSha256) {
    fail(result, "snapshot_hash_mismatch", "stored hash no longer matches its snapshot", ctx);
  }
  if (
    after.workflowDecision !== routingBefore.workflowDecision ||
    after.requiredApprovalLevel !== routingBefore.requiredApprovalLevel ||
    JSON.stringify(after.reviewReasons) !== JSON.stringify(routingBefore.reviewReasons)
  ) {
    fail(result, "snapshot_mutation", "routing basis changed after creation", ctx);
  }
  // reviewState is human progress; it must never stand in for a routing axis.
  for (const violation of axisVocabularyViolations({
    comparisonStatus: (after.snapshot as ReviewSnapshot).comparisonStatus,
    workflowDecision: after.workflowDecision,
    requiredApprovalLevel: after.requiredApprovalLevel,
    reviewState: after.reviewState,
  })) {
    fail(result, "four_axis_collapse", violation, ctx);
  }
  return result;
}

function evaluateTransition(ctx: Ctx, c: Extract<WorkflowCase, { kind: "transition" }>): CaseResult {
  const result: CaseResult = { id: c.id, kind: c.kind, passed: true, failures: [], observed: {} };
  const outcome = checkTransition(c.from, c.to);
  result.observed.ok = outcome.ok;
  result.observed.code = outcome.ok ? null : outcome.code;
  if (outcome.ok !== c.expectedLegal) {
    fail(
      result,
      "invalid_state_transitions_accepted",
      `${c.from} -> ${c.to} ok=${outcome.ok}, expected ${c.expectedLegal}`,
      ctx,
    );
  }
  if (!outcome.ok && c.expectedCode && outcome.code !== c.expectedCode) {
    fail(result, "case_expectation", `code ${outcome.code} != ${c.expectedCode}`, ctx);
  }
  return result;
}

function evaluateTrustBoundary(
  ctx: Ctx,
  c: Extract<WorkflowCase, { kind: "trust_boundary" }>,
): CaseResult {
  const result: CaseResult = { id: c.id, kind: c.kind, passed: true, failures: [], observed: {} };
  const parsed =
    c.target === "create"
      ? CreateReviewInputSchema.safeParse({
          productAId: "doc_termplus20_v1",
          productBId: "doc_indexflex_ul_v1",
          [c.field]: c.value,
        })
      : ReviewDecisionSchema.safeParse({ type: "approve", [c.field]: c.value });
  result.observed.accepted = parsed.success;
  if (parsed.success) {
    const gate: HardGate =
      c.field === "reviewer" || c.field === "actor"
        ? "client_forged_reviewer_or_actor_accepted"
        : c.field === "workflowDecision" || c.field === "requiredApprovalLevel"
          ? "client_forged_routing_accepted"
          : "client_forged_verified_data_accepted";
    fail(result, gate, `the schema accepted a caller-supplied ${c.field}`, ctx);
  }
  return result;
}

function evaluateInputValidation(
  ctx: Ctx,
  c: Extract<WorkflowCase, { kind: "input_validation" }>,
): CaseResult {
  const result: CaseResult = { id: c.id, kind: c.kind, passed: true, failures: [], observed: {} };
  const body =
    c.decisionType === "reject"
      ? { type: "reject", reason: c.value }
      : { type: "request_revision", instructions: c.value };
  const parsed = ReviewDecisionSchema.safeParse(body);
  result.observed.accepted = parsed.success;
  if (parsed.success !== c.expectedAccepted) {
    fail(
      result,
      c.expectedAccepted ? "case_expectation" : "blank_decision_reasons_accepted",
      `accepted=${parsed.success}, expected ${c.expectedAccepted} for ${JSON.stringify(c.value)}`,
      ctx,
    );
  }
  if (parsed.success && c.expectedStoredValue !== undefined) {
    const data = parsed.data as { reason?: string; instructions?: string };
    const stored = data.reason ?? data.instructions;
    result.observed.storedValue = stored;
    if (stored !== c.expectedStoredValue) {
      fail(result, "case_expectation", `stored ${JSON.stringify(stored)}`, ctx);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------

async function cleanup(ctx: Ctx): Promise<number> {
  let removed = 0;
  for (const reviewId of ctx.created) {
    // deleteTestReviewData refuses anything without the rev_test_ prefix, and
    // the append-only trigger refuses it again in the database.
    await deleteTestReviewData(ctx.db, reviewId);
    removed += 1;
  }
  return removed;
}

async function main(): Promise<number> {
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const outPath = outArg ? outArg.slice(6) : "evals/results/m5-run.json";

  const caseFile = WorkflowCaseFileSchema.parse(JSON.parse(await readFile(CASE_FILE, "utf8")));
  const ctx: Ctx = {
    db: createServiceClient(),
    catalog: await loadCatalog(),
    gates: Object.fromEntries(HARD_GATES.map((g) => [g, 0])) as Gates,
    created: new Set(),
  };

  const kbBefore = await knowledgeBaseCounts(ctx.db);
  const results: CaseResult[] = [];
  try {
    for (const c of caseFile.cases) {
      switch (c.kind) {
        case "routing":
          results.push(evaluateRouting(ctx, c));
          break;
        case "creation":
          results.push(await evaluateCreation(ctx, c));
          break;
        case "decision":
          results.push(await evaluateDecision(ctx, c));
          break;
        case "transition":
          results.push(evaluateTransition(ctx, c));
          break;
        case "trust_boundary":
          results.push(evaluateTrustBoundary(ctx, c));
          break;
        case "input_validation":
          results.push(evaluateInputValidation(ctx, c));
          break;
      }
    }
  } finally {
    var removed = await cleanup(ctx);
  }

  const kbAfter = await knowledgeBaseCounts(ctx.db);
  if (JSON.stringify(kbBefore) !== JSON.stringify(kbAfter)) {
    ctx.gates.knowledge_base_mutation += 1;
  }

  const residue = await testResidue(ctx.db);
  const history = await nonTestHistory(ctx.db);

  const run: WorkflowRun = {
    schemaVersion: 1,
    caseFileFrozenAt: caseFile.frozenAt,
    totalCases: results.length,
    passedCases: results.filter((r) => r.passed).length,
    hardGates: ctx.gates,
    observations: {
      knowledgeBase: kbAfter,
      testRowsCreated: ctx.created.size,
      testRowsRemoved: removed,
      testResidue: residue,
      nonTestReviewHistory: history,
      byKind: countBy(results.map((r) => r.kind)),
      failuresByKind: countBy(results.filter((r) => !r.passed).map((r) => r.kind)),
    },
    results,
  };

  await mkdir(dirname(join(ROOT, outPath)), { recursive: true });
  await writeFile(join(ROOT, outPath), JSON.stringify(run, null, 2) + "\n");

  const failedGates = Object.entries(ctx.gates).filter(([, n]) => n > 0);
  console.log(`\nM5 workflow evaluation — frozen ${caseFile.frozenAt}`);
  console.log(`cases: ${run.passedCases}/${run.totalCases} passed`);
  console.log(
    `knowledge base: ${kbAfter.documents}/${kbAfter.document_pages}/${kbAfter.chunks}` +
      `  test rows created/removed: ${ctx.created.size}/${removed}` +
      `  residue: ${residue.reviewItems}/${residue.reviewEvents}`,
  );
  console.log(
    `non-test review history: ${history.total} (${Object.entries(history.byState)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")})`,
  );
  console.log(`hard gates: ${failedGates.length === 0 ? "all zero" : "FAILED"}`);
  for (const [gate, n] of failedGates) console.log(`  ${gate}: ${n}`);
  for (const result of results.filter((r) => !r.passed)) {
    console.log(`  FAIL ${result.id}`);
    for (const f of result.failures) console.log(`    ${f.gate}: ${f.detail}`);
  }
  console.log(`\nwrote ${outPath}`);

  const residueClean = residue.reviewItems === 0 && residue.reviewEvents === 0;
  return failedGates.length === 0 && run.passedCases === run.totalCases && residueClean ? 0 : 1;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});
}

async function knowledgeBaseCounts(db: SupabaseClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of ["documents", "document_pages", "chunks"]) {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true })
      .not("id", "is", null);
    if (error) throw new Error(`DB_READ_FAILED: ${error.message}`);
    counts[table] = count ?? -1;
  }
  return counts;
}

async function testResidue(db: SupabaseClient) {
  const item = await db
    .from("review_items")
    .select("*", { count: "exact", head: true })
    .like("review_id", "rev_test_%");
  const event = await db
    .from("review_events")
    .select("*", { count: "exact", head: true })
    .like("event_id", "evt_test_%");
  return { reviewItems: item.count ?? -1, reviewEvents: event.count ?? -1 };
}

/** Observation only. Real review history is never a pass/fail condition. */
async function nonTestHistory(db: SupabaseClient) {
  const { data, error } = await db
    .from("review_items")
    .select("review_state")
    .not("review_id", "like", "rev_test_%");
  if (error) throw new Error(`DB_REVIEW_READ_FAILED: ${error.message}`);
  return {
    total: (data ?? []).length,
    byState: countBy((data ?? []).map((r) => (r as { review_state: string }).review_state)),
  };
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
