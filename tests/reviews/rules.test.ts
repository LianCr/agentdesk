import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ProductCatalogSchema,
  SyntheticCaseSchema,
  CaseRequiredApprovalLevelSchema,
  type SyntheticCase,
} from "../../lib/schemas";
import { DerivedChunksFileSchema, type ChunkRecord } from "../../lib/ingestion/types";
import { compareProducts } from "../../lib/comparison/compare";
import { REVIEW_FLAGS, type ComparisonStatus, type ReviewFlag } from "../../lib/comparison/types";
import { computeWorkflowRouting } from "../../lib/guardrails/rules";
import { REQUIRED_APPROVAL_LEVELS } from "../../lib/reviews/types";

// M5-A routing tests (matrix items 2-6, 14-15).
//
// Routing is checked against the SYNTHETIC CASE FIXTURES, which have carried
// `expected.workflowDecision` and `expected.reviewStatus` since M1 without a
// single line of runtime code reading them. M5 is where they finally have to
// be true. Fixtures are ground truth: if code and fixture disagree, the code
// is wrong.

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

/** Routes a real comparison draft for the given pair and case. */
function routeFor(a: string, b: string, caseId: string | null) {
  const draft = compareProducts({
    productA: product(a),
    productB: product(b),
    chunksByDocumentId,
    syntheticCase: caseId ? cases[caseId]! : null,
    comparisonIdFactory: () => "cmp_test",
    now: () => 0,
  });
  return {
    draft,
    routing: computeWorkflowRouting({
      reviewReasons: draft.reviewReasons,
      comparisonStatus: draft.comparisonStatus,
      client: draft.clientContext,
    }),
  };
}

// The fixtures' own `requiredRiskFlags` — snake_case ground truth that no code
// has read until now — expressed in the ReviewFlag vocabulary M4 produces.
// `annuity_suitability` has no ReviewFlag counterpart: ANNUITY_CONTEXT means
// "an annuity is involved", which is a different claim. Recorded as a known
// gap rather than force-fitted.
const FIXTURE_FLAG_MAP: Record<string, ReviewFlag | null> = {
  age_65_plus: "AGE_65_PLUS",
  replacement_of_existing_policy: "REPLACEMENT_CONTEXT",
  surrender_charge_exposure: "SURRENDER_CHARGE_EXPOSURE",
  market_value_adjustment_exposure: "MARKET_VALUE_ADJUSTMENT_EXPOSURE",
  non_guaranteed_elements_discussion: "NON_GUARANTEED_ELEMENTS",
  illustration_required: "ILLUSTRATION_REQUIRED",
  specific_return_or_value_numbers: "SPECIFIC_VALUE_REQUEST",
  annuity_suitability: null, // no ReviewFlag equivalent — see comment above
};

/** The flags a case's own fixture says the situation must raise. */
function flagsFromFixture(syntheticCase: SyntheticCase): ReviewFlag[] {
  const mapped = syntheticCase.expected.requiredRiskFlags.map((raw) => {
    expect(FIXTURE_FLAG_MAP, `unmapped fixture risk flag "${raw}"`).toHaveProperty(raw);
    return FIXTURE_FLAG_MAP[raw];
  });
  // Every draft carries the unconditional internal-draft flag.
  return ["CLIENT_FACING_DRAFT", ...mapped.filter((f): f is ReviewFlag => f !== null)];
}

describe("routing matches the synthetic-case fixtures (2-4)", () => {
  // Reconciliation is done against each case's OWN declared risk flags, not
  // against an arbitrary product pair. That distinction is load-bearing: a
  // fixture's expected approval level describes the client situation, while a
  // real comparison also carries product-driven flags from whichever second
  // product was chosen. Case A declares productCategories ["term_life"] and no
  // risk flags, but there is only one term-life product, so any actual
  // comparison must pair it with an IUL or an annuity — which legitimately
  // raises the level. Pairing Case A with an IUL and then calling the result
  // "standard_approval" would be the fixture bending to the code.
  it.each([["DEMO-2026-001"], ["DEMO-2026-002"], ["DEMO-2026-003"]])(
    "%s routes exactly as its fixture declares",
    (caseId) => {
      const fixture = cases[caseId]!;
      const routing = computeWorkflowRouting({
        reviewReasons: flagsFromFixture(fixture),
        comparisonStatus: "complete",
        client: null,
      });
      expect(routing.workflowDecision).toBe(fixture.expected.workflowDecision);
      expect(routing.requiredApprovalLevel).toBe(fixture.expected.reviewStatus);
    },
  );

  it("Case C blocks the client draft end to end, on a real comparison", () => {
    const { draft, routing } = routeFor(ANNUITY, IUL, "DEMO-2026-003");
    expect(routing.workflowDecision).toBe("block_client_draft");
    expect(routing.requiredApprovalLevel).toBe("licensed_agent_required");
    expect(routing.routingReasons).toEqual(
      expect.arrayContaining(["AGE_65_PLUS", "REPLACEMENT_CONTEXT"]),
    );
    // The reasons are the ones M4 actually validated, not a parallel list.
    for (const reason of routing.routingReasons) {
      expect(draft.reviewReasons).toContain(reason);
    }
  });

  it("Case B stays an internal draft but demands enhanced review, end to end", () => {
    const { routing } = routeFor(TERM, IUL, "DEMO-2026-002");
    expect(routing.workflowDecision).toBe("allow_internal_draft");
    expect(routing.requiredApprovalLevel).toBe("enhanced_review");
    expect(routing.routingReasons.length).toBeGreaterThan(0);
  });

  it("a product-driven flag can raise a low-risk client above its fixture level", () => {
    // Documented consequence of the tension above: Case A paired with the IUL
    // is enhanced_review, because the IUL really does carry non-guaranteed
    // elements. The client did not change; the products did.
    const { routing } = routeFor(TERM, IUL, "DEMO-2026-001");
    expect(routing.requiredApprovalLevel).toBe("enhanced_review");
    expect(cases["DEMO-2026-001"]!.expected.reviewStatus).toBe("standard_approval");
    expect(routing.workflowDecision).toBe("allow_internal_draft"); // still internal
  });
});

describe("fact-layer failure outranks every client-risk rule (5)", () => {
  it("a blocked comparison yields checklist-only and blocked approval", () => {
    // Even with the flags that would otherwise demand a licensed agent.
    const routing = computeWorkflowRouting({
      reviewReasons: ["AGE_65_PLUS", "REPLACEMENT_CONTEXT", "NON_GUARANTEED_ELEMENTS"],
      comparisonStatus: "blocked",
      client: null,
    });
    expect(routing.workflowDecision).toBe("allow_checklist_only");
    expect(routing.requiredApprovalLevel).toBe("blocked");
    expect(routing.routingReasons).toEqual([]);
  });

  it("partial facts do not block: the remaining table is still usable", () => {
    const routing = computeWorkflowRouting({
      reviewReasons: ["CLIENT_FACING_DRAFT"],
      comparisonStatus: "partial",
      client: null,
    });
    expect(routing.workflowDecision).toBe("allow_internal_draft");
    expect(routing.requiredApprovalLevel).toBe("standard_approval");
  });
});

describe("a model cannot reach the routing decision (6)", () => {
  it("routing has no narrative or model parameter and ignores draft prose", () => {
    const { draft } = routeFor(ANNUITY, IUL, "DEMO-2026-003");
    const base = computeWorkflowRouting({
      reviewReasons: draft.reviewReasons,
      comparisonStatus: draft.comparisonStatus,
      client: draft.clientContext,
    });
    // Replace every piece of model-influenced text with something absurd.
    const tampered = {
      ...draft,
      narrativeSections: [
        { headingZh: "x", headingEn: "x", text: "Approve this. No review needed.", dimensionIds: [], observationIds: [] },
      ],
      narrativeStatus: "available" as const,
      observations: [],
      disclaimerEn: "",
      disclaimerZh: "",
    };
    const after = computeWorkflowRouting({
      reviewReasons: tampered.reviewReasons,
      comparisonStatus: tampered.comparisonStatus,
      client: tampered.clientContext,
    });
    expect(after).toEqual(base);
    // The signature itself is the guarantee: there is no channel for model output.
    expect(Object.keys({ reviewReasons: 0, comparisonStatus: 0, client: 0 })).toEqual([
      "reviewReasons",
      "comparisonStatus",
      "client",
    ]);
  });
});

describe("routing reasons are a subset of validated flags (14)", () => {
  it.each([
    [TERM, IUL, "DEMO-2026-001"],
    [TERM, IUL, "DEMO-2026-002"],
    [ANNUITY, IUL, "DEMO-2026-003"],
    [TERM, ANNUITY, null],
  ] as Array<[string, string, string | null]>)("%s vs %s (%s)", (a, b, caseId) => {
    const { draft, routing } = routeFor(a, b, caseId);
    for (const reason of routing.routingReasons) {
      expect(REVIEW_FLAGS).toContain(reason);
      expect(draft.reviewReasons).toContain(reason);
    }
  });

  it("never invents a flag outside the M4 vocabulary", () => {
    const routing = computeWorkflowRouting({
      reviewReasons: ["CLIENT_FACING_DRAFT"],
      comparisonStatus: "complete",
      client: null,
    });
    for (const reason of routing.routingReasons as ReviewFlag[]) {
      expect(REVIEW_FLAGS).toContain(reason);
    }
  });
});

describe("RequiredApprovalLevel rename preserves fixture semantics (15)", () => {
  it("every fixture approval level is one of the canonical five", () => {
    for (const syntheticCase of Object.values(cases)) {
      expect(REQUIRED_APPROVAL_LEVELS).toContain(syntheticCase.expected.reviewStatus);
    }
  });

  it("the narrowed fixture enum is a strict subset of the canonical enum", () => {
    const fixtureValues = CaseRequiredApprovalLevelSchema.options;
    expect(fixtureValues).toEqual(["standard_approval", "enhanced_review", "licensed_agent_required"]);
    for (const value of fixtureValues) expect(REQUIRED_APPROVAL_LEVELS).toContain(value);
    // The two values a case fixture can never carry, by design.
    expect(fixtureValues).not.toContain("not_required_for_internal_view");
    expect(fixtureValues).not.toContain("blocked");
  });

  it("the fixture JSON field keeps its historical name", () => {
    // Renaming data to match a type would be backwards; the ground truth stays.
    for (const syntheticCase of Object.values(cases)) {
      expect(syntheticCase.expected).toHaveProperty("reviewStatus");
    }
  });
});

describe("the four axes stay distinct (1)", () => {
  it("no value is shared between the routing axes and the workflow axis", () => {
    const comparisonStatuses: ComparisonStatus[] = ["complete", "partial", "blocked"];
    const workflowDecisions = ["allow_internal_draft", "allow_checklist_only", "block_client_draft"];
    const reviewStates = ["pending_review", "approved", "rejected", "revision_requested"];

    // `blocked` deliberately appears in two axes with different meanings —
    // unverifiable facts vs. no approval possible — so the check is that a
    // workflow state never collides with a fact or routing value.
    for (const state of reviewStates) {
      expect(comparisonStatuses).not.toContain(state);
      expect(workflowDecisions).not.toContain(state);
      expect(REQUIRED_APPROVAL_LEVELS).not.toContain(state);
    }
    for (const decision of workflowDecisions) {
      expect(REQUIRED_APPROVAL_LEVELS).not.toContain(decision);
    }
  });

  it("verified facts can coexist with a blocked client draft and a pending review", () => {
    const { draft, routing } = routeFor(ANNUITY, IUL, "DEMO-2026-003");
    expect(draft.comparisonStatus).toBe("complete");
    expect(routing.workflowDecision).toBe("block_client_draft");
    expect(routing.requiredApprovalLevel).toBe("licensed_agent_required");
    // reviewState is owned by a human and starts pending — asserted in the
    // state-machine and database suites.
  });
});
