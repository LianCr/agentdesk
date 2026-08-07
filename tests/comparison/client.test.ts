import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SyntheticCaseSchema, type SyntheticCase } from "../../lib/schemas";
import { detectReplacementContext, normalizeClientContext } from "../../lib/comparison/client-context";
import { computeMissingClientInformation } from "../../lib/comparison/missing-info";
import { compareProducts } from "../../lib/comparison/compare";
import { UNKNOWN, type MissingInfoField } from "../../lib/comparison/types";
import { ALL_IDS, ANNUITY_ID, IUL_ID, TERM_ID, chunksFor, product } from "./fixtures";

// M4-B acceptance items 13-18 and 27.

const chunksByDocumentId = Object.fromEntries(ALL_IDS.map((id) => [id, chunksFor(id)]));

const CASES: Record<string, SyntheticCase> = Object.fromEntries(
  readdirSync(join(process.cwd(), "data/synthetic-cases"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const parsed = SyntheticCaseSchema.parse(
        JSON.parse(readFileSync(join(process.cwd(), "data/synthetic-cases", f), "utf8")),
      );
      return [parsed.caseId, parsed];
    }),
);

const A = CASES["DEMO-2026-001"]!;
const B = CASES["DEMO-2026-002"]!;
const C = CASES["DEMO-2026-003"]!;

function compare(a: string, b: string, syntheticCase: SyntheticCase | null) {
  return compareProducts({
    productA: product(a),
    productB: product(b),
    chunksByDocumentId,
    syntheticCase,
    comparisonIdFactory: () => "cmp_test",
    now: () => 0,
  });
}

// Every fixture expectation, mapped to the canonical field the engine emits.
// The fixtures phrase the same gap differently across cases ("desired coverage
// amount" vs "desired death benefit"), so the contract is semantic coverage,
// not string equality.
const FIXTURE_FIELD_MAP: Record<string, MissingInfoField> = {
  "desired coverage amount": "desiredCoverageAmount",
  "desired death benefit": "desiredCoverageAmount",
  "tobacco usage": "tobaccoUse",
  "employer group coverage": "employerGroupCoverage",
  "underwriting class": "underwritingClass",
  "existing individual coverage": "existingIndividualCoverage",
  "planned premium duration": "plannedPremiumDuration",
  "cash accumulation time horizon": "cashValueTimeHorizon",
  "access or withdrawal expectations": "withdrawalExpectations",
  "personalized illustration": "personalizedIllustration",
  "current contract surrender charge": "currentSurrenderCharge",
  "current market value adjustment": "currentMarketValueAdjustment",
  "existing guaranteed rate end date": "existingGuaranteedRateEndDate",
  "current account value": "currentAccountValue",
  "benefits or guarantees that may be lost": "benefitsThatMayBeLost",
};

describe("client normalization (13-14)", () => {
  it("reads the fields the fixtures state", () => {
    const a = normalizeClientContext(A);
    expect(a.caseId).toBe("DEMO-2026-001");
    expect(a.displayName).toBe("Demo Client A");
    expect(a.language).toBe("zh");
    expect(a.age).toBe(38);
    expect(a.dependents).toBe(2);
    expect(a.budgetMonthly).toBe(250);
    expect(a.coverageHorizon).toBe("20-25");
    expect(a.primaryGoal).toBe("income_replacement");

    const b = normalizeClientContext(B);
    expect(b.language).toBe("en");
    expect(b.age).toBe(52);
    expect(b.clientQuestions).toHaveLength(2);
  });

  it("leaves fields the fixtures never state as unknown", () => {
    for (const syntheticCase of [A, B, C]) {
      const ctx = normalizeClientContext(syntheticCase);
      expect(ctx.tobaccoUse).toBe(UNKNOWN);
      expect(ctx.desiredCoverageAmount).toBe(UNKNOWN);
    }
    // Case C states no dependents, budget or risk tolerance.
    const c = normalizeClientContext(C);
    expect(c.dependents).toBe(UNKNOWN);
    expect(c.budgetMonthly).toBe(UNKNOWN);
    expect(c.riskTolerance).toBe(UNKNOWN);
  });
});

describe("replacement context is explicit, never inferred (16-17)", () => {
  it("Case C is a replacement case", () => {
    expect(normalizeClientContext(C).replacementContext).toBe(true);
  });

  it("Cases A and B are not, despite B having existing coverage", () => {
    expect(normalizeClientContext(A).replacementContext).toBe(false);
    expect(normalizeClientContext(B).replacementContext).toBe(false);
  });

  it("existing coverage alone never triggers replacement", () => {
    expect(detectReplacementContext({ existingCoverage: "employer group term, amount unknown" })).toBe(false);
    expect(detectReplacementContext({ existingCoverage: "none" })).toBe(false);
    expect(detectReplacementContext({ existingCoverage: "individual term policy in force" })).toBe(false);
  });

  it("an in-force surrender period or explicit switch intent does", () => {
    expect(
      detectReplacementContext({ existingCoverage: "fixed annuity purchased in 2021; surrender period through 2028" }),
    ).toBe(true);
    expect(
      detectReplacementContext({
        existingCoverage: "existing annuity contract",
        clientQuestions: ["想换一个利率高一点的，可以吗？"],
      }),
    ).toBe(true);
  });
});

describe("missing client information (15)", () => {
  it("covers every fixture expectation for each case", () => {
    const pairs: Array<[SyntheticCase, string, string]> = [
      [A, TERM_ID, IUL_ID],
      [B, TERM_ID, IUL_ID],
      [C, ANNUITY_ID, IUL_ID],
    ];
    for (const [syntheticCase, a, b] of pairs) {
      const produced = new Set(compare(a, b, syntheticCase).missingClientInformation.map((m) => m.field));
      for (const expected of syntheticCase.expected.missingInformation) {
        const field = FIXTURE_FIELD_MAP[expected];
        expect(field, `unmapped fixture expectation "${expected}"`).toBeDefined();
        expect(produced.has(field!), `${syntheticCase.caseId} missing ${expected} (${field})`).toBe(true);
      }
    }
  });

  it("group-coverage cases ask about individual coverage and vice versa", () => {
    const forA = compare(TERM_ID, IUL_ID, A).missingClientInformation.map((m) => m.field);
    expect(forA).toContain("employerGroupCoverage");
    expect(forA).not.toContain("existingIndividualCoverage");

    const forB = compare(TERM_ID, IUL_ID, B).missingClientInformation.map((m) => m.field);
    expect(forB).toContain("existingIndividualCoverage");
    expect(forB).not.toContain("employerGroupCoverage");
  });

  it("replacement-review gaps appear only for the replacement case", () => {
    const replacementFields = [
      "currentSurrenderCharge",
      "currentMarketValueAdjustment",
      "existingGuaranteedRateEndDate",
      "currentAccountValue",
      "benefitsThatMayBeLost",
    ];
    const forC = compare(ANNUITY_ID, IUL_ID, C).missingClientInformation.map((m) => m.field);
    const forA = compare(ANNUITY_ID, IUL_ID, A).missingClientInformation.map((m) => m.field);
    for (const field of replacementFields) {
      expect(forC).toContain(field);
      expect(forA).not.toContain(field);
    }
  });

  it("IUL-specific gaps appear only when an IUL is in the pair", () => {
    const withIul = compare(TERM_ID, IUL_ID, A).missingClientInformation.map((m) => m.field);
    const withoutIul = compare(TERM_ID, ANNUITY_ID, A).missingClientInformation.map((m) => m.field);
    expect(withIul).toContain("personalizedIllustration");
    expect(withoutIul).not.toContain("personalizedIllustration");
  });

  it("no client means no client questions", () => {
    expect(computeMissingClientInformation(null, ["term_life", "fixed_annuity"])).toEqual([]);
    expect(compare(TERM_ID, ANNUITY_ID, null).missingClientInformation).toEqual([]);
  });
});

describe("review flags (18, 27)", () => {
  it("age 65+ fires only for Case C, using the product's own Demo threshold", () => {
    expect(compare(ANNUITY_ID, IUL_ID, C).reviewReasons).toContain("AGE_65_PLUS");
    expect(compare(ANNUITY_ID, IUL_ID, A).reviewReasons).not.toContain("AGE_65_PLUS");
    expect(compare(ANNUITY_ID, IUL_ID, B).reviewReasons).not.toContain("AGE_65_PLUS");
  });

  it("replacement flag follows the replacement context", () => {
    expect(compare(ANNUITY_ID, IUL_ID, C).reviewReasons).toContain("REPLACEMENT_CONTEXT");
    expect(compare(ANNUITY_ID, IUL_ID, B).reviewReasons).not.toContain("REPLACEMENT_CONTEXT");
  });

  it("client questions asking for specific values raise the value-request flag", () => {
    // Case B asks "How much cash value will I have after 20 years?".
    expect(compare(TERM_ID, IUL_ID, B).reviewReasons).toContain("SPECIFIC_VALUE_REQUEST");
    expect(compare(TERM_ID, IUL_ID, A).reviewReasons).not.toContain("SPECIFIC_VALUE_REQUEST");
  });

  it("product-driven flags do not depend on having a client at all", () => {
    const noClient = compare(TERM_ID, IUL_ID, null).reviewReasons;
    expect(noClient).toContain("CLIENT_FACING_DRAFT");
    expect(noClient).toContain("NON_GUARANTEED_ELEMENTS");
    expect(noClient).toContain("ILLUSTRATION_REQUIRED");
    expect(noClient).not.toContain("ANNUITY_CONTEXT");
    expect(compare(TERM_ID, ANNUITY_ID, null).reviewReasons).toContain("ANNUITY_CONTEXT");
  });

  it("reviewRequired reflects the flags and every draft carries the internal-draft flag", () => {
    for (const syntheticCase of [null, A, B, C]) {
      const draft = compare(TERM_ID, IUL_ID, syntheticCase);
      expect(draft.reviewRequired).toBe(true);
      expect(draft.reviewReasons).toContain("CLIENT_FACING_DRAFT");
    }
  });
});
