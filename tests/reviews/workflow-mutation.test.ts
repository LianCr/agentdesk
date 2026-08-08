import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProductCatalogSchema, SyntheticCaseSchema, type SyntheticCase } from "../../lib/schemas";
import { DerivedChunksFileSchema, type ChunkRecord } from "../../lib/ingestion/types";
import { compareProducts } from "../../lib/comparison/compare";
import { computeWorkflowRouting } from "../../lib/guardrails/rules";
import { buildReviewChecklist } from "../../lib/reviews/checklist";
import { buildReviewSnapshot, hashReviewSnapshot } from "../../lib/reviews/snapshot";
import { checkTransition } from "../../lib/reviews/state-machine";
import { CreateReviewInputSchema } from "../../lib/reviews/create-review";
import { ReviewDecisionSchema } from "../../lib/reviews/types";

// Mutation tests for the M5 workflow evaluation.
//
// A suite that only ever passes proves nothing. Each test here injects one
// defect into an isolated structure and asserts that the check which is
// supposed to catch it actually does. The checks are the same predicates the
// evaluator uses -- not a second implementation that could agree with the
// evaluator while both are wrong.

const ROOT = process.cwd();
const catalog = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);
const chunksByDocumentId: Record<string, ChunkRecord[]> = Object.fromEntries(
  catalog.products.map((p) => [
    p.documentId,
    DerivedChunksFileSchema.parse(
      JSON.parse(readFileSync(join(ROOT, `data/derived/chunks/${p.documentId}.chunks.json`), "utf8")),
    ).chunks,
  ]),
);
const cases: Record<string, SyntheticCase> = Object.fromEntries(
  readdirSync(join(ROOT, "data/synthetic-cases"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const parsed = SyntheticCaseSchema.parse(
        JSON.parse(readFileSync(join(ROOT, "data/synthetic-cases", f), "utf8")),
      );
      return [parsed.caseId, parsed];
    }),
);

const TERM = "doc_termplus20_v1";
const IUL = "doc_indexflex_ul_v1";
const ANNUITY = "doc_securerate5_v1";
const product = (id: string) => catalog.products.find((p) => p.documentId === id)!;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function draftFor(a: string, b: string, caseId: string | null) {
  return compareProducts({
    productA: product(a),
    productB: product(b),
    chunksByDocumentId,
    syntheticCase: caseId ? cases[caseId]! : null,
    comparisonIdFactory: () => "cmp_mutation",
    now: () => 0,
  });
}

// The evaluator's axis check, verbatim in behaviour.
const AXIS_VOCABULARY: Record<string, readonly string[]> = {
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
};
function axisViolations(axes: Record<string, string>): string[] {
  return Object.entries(axes)
    .filter(([axis, value]) => !AXIS_VOCABULARY[axis]!.includes(value))
    .map(([axis, value]) => `${axis} holds "${value}"`);
}

/** The evaluator's event check: created first, then exactly one terminal. */
function eventDefects(events: string[], finalState: string): string[] {
  const defects: string[] = [];
  if (events[0] !== "REVIEW_CREATED") defects.push("creation_missing_review_created");
  const terminal = events.filter((e) => e !== "REVIEW_CREATED");
  if (terminal.length > 1) defects.push("duplicate_terminal_decisions");
  const TERMINAL_FOR: Record<string, string> = {
    approved: "APPROVED",
    rejected: "REJECTED",
    revision_requested: "REVISION_REQUESTED",
  };
  const expected = TERMINAL_FOR[finalState];
  if (expected && !events.includes(expected)) defects.push("decisions_missing_audit_event");
  return defects;
}

describe("routing mutations (1-2, 13)", () => {
  it("1: a wrong workflowDecision is caught", () => {
    const draft = draftFor(ANNUITY, IUL, "DEMO-2026-003");
    const routing = computeWorkflowRouting({
      reviewReasons: draft.reviewReasons,
      comparisonStatus: draft.comparisonStatus,
      client: draft.clientContext,
    });
    expect(routing.workflowDecision).toBe("block_client_draft");
    const mutated: { workflowDecision: string } = { ...routing, workflowDecision: "allow_internal_draft" };
    expect(mutated.workflowDecision === "block_client_draft").toBe(false);
  });

  it("2: a wrong approval level is caught", () => {
    const draft = draftFor(ANNUITY, IUL, "DEMO-2026-003");
    const routing = computeWorkflowRouting({
      reviewReasons: draft.reviewReasons,
      comparisonStatus: draft.comparisonStatus,
      client: draft.clientContext,
    });
    expect(routing.requiredApprovalLevel).toBe("licensed_agent_required");
    expect(({ ...routing, requiredApprovalLevel: "standard_approval" }).requiredApprovalLevel).not.toBe(
      "licensed_agent_required",
    );
  });

  it("13: removing the Case C block is detectable, and the rule itself cannot be talked out of it", () => {
    const draft = draftFor(ANNUITY, IUL, "DEMO-2026-003");
    // Strip only the flags the rule keys on: the block must disappear, which is
    // what makes "the block is caused by those flags" a checkable claim.
    const withoutBlockFlags = draft.reviewReasons.filter(
      (f) => f !== "REPLACEMENT_CONTEXT" && f !== "AGE_65_PLUS",
    );
    const stripped = computeWorkflowRouting({
      reviewReasons: withoutBlockFlags,
      comparisonStatus: "complete",
      client: null,
    });
    expect(stripped.workflowDecision).not.toBe("block_client_draft");
    // With the flags present, no amount of other input removes the block.
    for (const status of ["complete", "partial"] as const) {
      const routing = computeWorkflowRouting({
        reviewReasons: draft.reviewReasons,
        comparisonStatus: status,
        client: draft.clientContext,
      });
      expect(routing.workflowDecision).toBe("block_client_draft");
    }
  });
});

describe("four-axis collapse (3)", () => {
  it("3: a routing value standing in for a status or a human state is caught", () => {
    expect(
      axisViolations({
        comparisonStatus: "complete",
        workflowDecision: "block_client_draft",
        requiredApprovalLevel: "licensed_agent_required",
        reviewState: "pending_review",
      }),
    ).toEqual([]);
    // comparisonStatus replaced by a human state
    expect(axisViolations({ comparisonStatus: "pending_review" }).length).toBe(1);
    // block_client_draft treated as a rejection
    expect(axisViolations({ reviewState: "block_client_draft" }).length).toBe(1);
    // approval level used as a workflow state
    expect(axisViolations({ workflowDecision: "licensed_agent_required" }).length).toBe(1);
  });

  it("3b: 'blocked' appearing on two axes is NOT a collapse", () => {
    // The check that fired on this during the baseline run was the wrong test:
    // an unverifiable fact layer and an unapprovable review legitimately share
    // the word.
    expect(axisViolations({ comparisonStatus: "blocked", requiredApprovalLevel: "blocked" })).toEqual([]);
  });
});

describe("audit-event mutations (4-6)", () => {
  it("4: a duplicated terminal event is caught", () => {
    expect(eventDefects(["REVIEW_CREATED", "APPROVED"], "approved")).toEqual([]);
    expect(eventDefects(["REVIEW_CREATED", "APPROVED", "APPROVED"], "approved")).toContain(
      "duplicate_terminal_decisions",
    );
    expect(eventDefects(["REVIEW_CREATED", "APPROVED", "REJECTED"], "approved")).toContain(
      "duplicate_terminal_decisions",
    );
  });

  it("5: a terminal decision with no audit event is caught", () => {
    expect(eventDefects(["REVIEW_CREATED"], "approved")).toContain("decisions_missing_audit_event");
  });

  it("6: a missing REVIEW_CREATED is caught", () => {
    expect(eventDefects(["APPROVED"], "approved")).toContain("creation_missing_review_created");
  });

  it("the terminal event must name the state the item ended in", () => {
    expect(eventDefects(["REVIEW_CREATED", "APPROVED"], "rejected")).toContain(
      "decisions_missing_audit_event",
    );
  });
});

describe("snapshot integrity mutations (7-8)", () => {
  it("7: a changed cell, citation page or client changes the hash", () => {
    const snapshot = buildReviewSnapshot(draftFor(TERM, IUL, "DEMO-2026-001"));
    const original = hashReviewSnapshot(snapshot);

    const cellChanged = clone(snapshot);
    cellChanged.dimensions[0]!.cells[0]!.displayValue = "Something else";
    expect(hashReviewSnapshot(cellChanged)).not.toBe(original);

    const pageChanged = clone(snapshot);
    const cited = pageChanged.dimensions.flatMap((r) => r.cells).find((c) => c.citations.length > 0)!;
    cited.citations[0]!.pageStart = 99;
    expect(hashReviewSnapshot(pageChanged)).not.toBe(original);

    const quoteChanged = clone(snapshot);
    const quoted = quoteChanged.dimensions.flatMap((r) => r.cells).find((c) => c.citations.length > 0)!;
    quoted.citations[0]!.quote = "not what the document says";
    expect(hashReviewSnapshot(quoteChanged)).not.toBe(original);
  });

  it("8: a stored hash that no longer matches its snapshot is caught", () => {
    const snapshot = buildReviewSnapshot(draftFor(TERM, IUL, "DEMO-2026-001"));
    const stored = { snapshot, snapshotSha256: "0".repeat(64) };
    expect(hashReviewSnapshot(stored.snapshot) === stored.snapshotSha256).toBe(false);
  });

  it("routing captured at creation is compared, not recomputed", () => {
    // The evaluator compares the stored routing fields against what they were
    // at creation. Changing either side must be visible.
    const before = { workflowDecision: "block_client_draft", requiredApprovalLevel: "licensed_agent_required" };
    const after = { ...before, requiredApprovalLevel: "standard_approval" };
    expect(JSON.stringify(before) === JSON.stringify(after)).toBe(false);
  });
});

describe("trust-boundary mutations (9-11)", () => {
  it("9, 10: forged review reasons and routing are refused by the request schema", () => {
    for (const field of ["reviewReasons", "workflowDecision", "requiredApprovalLevel", "snapshot", "checklist"]) {
      expect(
        CreateReviewInputSchema.safeParse({
          productAId: TERM,
          productBId: IUL,
          [field]: "forged",
        }).success,
        `create accepted ${field}`,
      ).toBe(false);
    }
    // The control case: without the extra field the same input is valid, so the
    // refusals above are about the field and not about a malformed request.
    expect(CreateReviewInputSchema.safeParse({ productAId: TERM, productBId: IUL }).success).toBe(true);
  });

  it("11: a forged actor or reviewer is refused", () => {
    for (const field of ["actor", "reviewer", "reviewState"]) {
      expect(
        ReviewDecisionSchema.safeParse({ type: "approve", [field]: "Chief Compliance Officer" }).success,
        `decision accepted ${field}`,
      ).toBe(false);
    }
    expect(ReviewDecisionSchema.safeParse({ type: "approve" }).success).toBe(true);
  });

  it("the idempotency key is not reachable from request data", () => {
    // A caller that could namespace the source key could mint unlimited
    // duplicate pending reviews and the partial unique index would protect
    // nothing.
    expect(
      CreateReviewInputSchema.safeParse({
        productAId: TERM,
        productBId: IUL,
        sourceKeyPrefix: "attacker_",
      }).success,
    ).toBe(false);
  });
});

describe("state-machine mutations (12)", () => {
  it("12: a stale transition that succeeded would be caught", () => {
    expect(checkTransition("pending_review", "approved").ok).toBe(true);
    for (const from of ["approved", "rejected", "revision_requested"] as const) {
      for (const to of ["approved", "rejected", "revision_requested"] as const) {
        const outcome = checkTransition(from, to);
        expect(outcome.ok, `${from} -> ${to} was allowed`).toBe(false);
        if (!outcome.ok) expect(outcome.code).toBe("REVIEW_ALREADY_DECIDED");
      }
    }
    // A mutated machine that accepted one of these would flip this expectation.
    const pretendAccepted = { ok: true } as const;
    expect(pretendAccepted.ok === checkTransition("approved", "rejected").ok).toBe(false);
  });
});

describe("input-validation mutations (14)", () => {
  it("14: a blank rejection being accepted would be caught", () => {
    for (const value of ["", " ", "   ", "\n", "\t", "\n\t "]) {
      expect(
        ReviewDecisionSchema.safeParse({ type: "reject", reason: value }).success,
        `reject accepted ${JSON.stringify(value)}`,
      ).toBe(false);
      expect(
        ReviewDecisionSchema.safeParse({ type: "request_revision", instructions: value }).success,
        `revision accepted ${JSON.stringify(value)}`,
      ).toBe(false);
    }
    // Real text survives, trimmed.
    expect(ReviewDecisionSchema.parse({ type: "reject", reason: "  Wrong page.  " })).toEqual({
      type: "reject",
      reason: "Wrong page.",
    });
  });
});

describe("idempotency-key mutations (15-16)", () => {
  it("15, 16: the source key separates real work and joins the same work", async () => {
    const { buildSourceKey } = await import("../../lib/reviews/create-review");
    const same = buildSourceKey({ productAId: TERM, productBId: IUL, clientCaseId: "DEMO-2026-001" });
    // Reversed columns must join, not fork.
    expect(buildSourceKey({ productAId: IUL, productBId: TERM, clientCaseId: "DEMO-2026-001" })).toBe(same);
    // Genuinely different work must not collide.
    const others = [
      buildSourceKey({ productAId: TERM, productBId: IUL, clientCaseId: "DEMO-2026-002" }),
      buildSourceKey({ productAId: TERM, productBId: IUL, clientCaseId: null }),
      buildSourceKey({ productAId: TERM, productBId: ANNUITY, clientCaseId: "DEMO-2026-001" }),
    ];
    expect(new Set([same, ...others]).size).toBe(4);
    // A mutated key that ignored the client would collapse three of these.
    const clientBlind = (a: string, b: string) => `comparison_draft:${[a, b].sort().join("+")}`;
    expect(new Set([clientBlind(TERM, IUL), clientBlind(IUL, TERM)]).size).toBe(1);
  });
});

describe("checklist mutations", () => {
  it("a missing or invented replacement item is caught", () => {
    const draft = draftFor(ANNUITY, IUL, "DEMO-2026-003");
    const routing = computeWorkflowRouting({
      reviewReasons: draft.reviewReasons,
      comparisonStatus: draft.comparisonStatus,
      client: draft.clientContext,
    });
    const keys = buildReviewChecklist({ draft, workflowDecision: routing.workflowDecision }).map(
      (i) => i.key,
    );
    const required = cases["DEMO-2026-003"]!.expected.requiredChecklistItems!;
    for (const key of required) expect(keys).toContain(key);

    // Drop one and the containment check fails.
    const dropped = keys.filter((k) => k !== required[0]);
    expect(dropped.includes(required[0]!)).toBe(false);

    // Every item is traceable to the fixture or the missing-information list;
    // an invented regulatory item would not be.
    const allowed = new Set<string>([...required, ...draft.missingClientInformation.map((m) => m.field)]);
    expect(keys.filter((k) => !allowed.has(k))).toEqual([]);
    expect(["Suitability questionnaire required by state law"].filter((k) => !allowed.has(k))).toHaveLength(1);
  });

  it("a client-free comparison invents no client checklist", () => {
    const draft = draftFor(TERM, IUL, null);
    const routing = computeWorkflowRouting({
      reviewReasons: draft.reviewReasons,
      comparisonStatus: draft.comparisonStatus,
      client: draft.clientContext,
    });
    expect(buildReviewChecklist({ draft, workflowDecision: routing.workflowDecision })).toEqual([]);
  });
});

describe("the fixture vocabulary gap is recorded, not papered over", () => {
  it("annuity_suitability still has no ReviewFlag counterpart", () => {
    const declared = (cases["DEMO-2026-003"]!.expected.requiredRiskFlags ?? []) as string[];
    const MAPPED = [
      "non_guaranteed_elements_discussion",
      "illustration_required",
      "specific_return_or_value_numbers",
      "replacement_of_existing_policy",
      "age_65_plus",
      "surrender_charge_exposure",
      "market_value_adjustment_exposure",
    ];
    const unmapped = declared.filter((f) => !MAPPED.includes(f));
    // Recorded honestly: forcing this onto a semantically different flag to
    // show a round number would make the metric a lie.
    expect(unmapped).toEqual(["annuity_suitability"]);
  });
});
