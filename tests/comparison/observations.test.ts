import { describe, expect, it } from "vitest";
import { compareProducts } from "../../lib/comparison/compare";
import { computeObservations } from "../../lib/comparison/observations";
import { ALL_IDS, ANNUITY_ID, IUL_ID, TERM_ID, chunksFor, product } from "./fixtures";

// M4-B acceptance items 8-12 and 22.

const chunksByDocumentId = Object.fromEntries(ALL_IDS.map((id) => [id, chunksFor(id)]));

const compare = (a: string, b: string) =>
  compareProducts({
    productA: product(a),
    productB: product(b),
    chunksByDocumentId,
    comparisonIdFactory: () => "cmp_test",
    now: () => 0,
  });

const observationOf = (a: string, b: string, type: string) =>
  compare(a, b).observations.find((o) => o.type === type);

describe("SecureRate rate-guarantee vs surrender schedule (8-10)", () => {
  it("fires whenever SecureRate is in the pair, in either order", () => {
    for (const [a, b] of [
      [ANNUITY_ID, TERM_ID],
      [TERM_ID, ANNUITY_ID],
      [ANNUITY_ID, IUL_ID],
      [IUL_ID, ANNUITY_ID],
    ] as const) {
      expect(observationOf(a, b, "RATE_GUARANTEE_SHORTER_THAN_SURRENDER"), `${a} vs ${b}`).toBeDefined();
    }
  });

  it("never fires for a pair without an annuity — a floor rate is not a guarantee period", () => {
    expect(observationOf(TERM_ID, IUL_ID, "RATE_GUARANTEE_SHORTER_THAN_SURRENDER")).toBeUndefined();
    expect(observationOf(IUL_ID, TERM_ID, "RATE_GUARANTEE_SHORTER_THAN_SURRENDER")).toBeUndefined();
  });

  it("states both numbers and attributes each to its own cited source", () => {
    const observation = observationOf(ANNUITY_ID, TERM_ID, "RATE_GUARANTEE_SHORTER_THAN_SURRENDER")!;
    expect(observation.textEn).toContain("5 contract years");
    expect(observation.textEn).toContain("contract year 7");
    expect(observation.textZh).toContain("5 个合同年");
    expect(observation.textZh).toContain("第 1–7 个合同年");

    const draft = compare(ANNUITY_ID, TERM_ID);
    const cited = new Set(observation.citationIds);
    const guaranteed = draft.dimensions.find((r) => r.dimensionId === "guaranteed_elements")!.cells[0]!;
    const liquidity = draft.dimensions.find((r) => r.dimensionId === "surrender_liquidity")!.cells[0]!;
    // Both fact components carry their own validated sources.
    expect(guaranteed.citations.some((c) => cited.has(c.citationId))).toBe(true);
    expect(liquidity.citations.some((c) => cited.has(c.citationId))).toBe(true);
    expect(observation.factRefs.map((f) => f.dimensionId).sort()).toEqual([
      "guaranteed_elements",
      "surrender_liquidity",
    ]);
    expect(observation.severity).toBe("review_note");
  });

  it("never claims the document states a seven-year surrender period", () => {
    const observation = observationOf(ANNUITY_ID, IUL_ID, "RATE_GUARANTEE_SHORTER_THAN_SURRENDER")!;
    expect(observation.textEn.toLowerCase()).not.toContain("seven-year surrender period");
    expect(observation.textEn.toLowerCase()).not.toContain("the document states");
    expect(observation.textZh).not.toContain("七年退保期");
    // It describes the schedule instead.
    expect(observation.textEn).toContain("surrender-charge schedule");
    expect(observation.textZh).toContain("退保费用表");
  });

  it("gives no advice and no judgement", () => {
    const observation = observationOf(ANNUITY_ID, TERM_ID, "RATE_GUARANTEE_SHORTER_THAN_SURRENDER")!;
    const text = `${observation.textZh} ${observation.textEn}`;
    expect(text).not.toMatch(/\b(should|avoid|risky|bad|poor|surrender now|hold)\b/i);
    expect(text).not.toMatch(/建议|应该|风险较大|不划算|划算/);
  });
});

describe("other observations fire only where facts support them (11-12)", () => {
  it("cash-value difference appears when one side documents no cash value", () => {
    expect(observationOf(TERM_ID, IUL_ID, "CASH_VALUE_FEATURE_DIFFERS")).toBeDefined();
    // The annuity's cash-value cell is not_applicable, so there is nothing to
    // contrast — inventing a difference there would misstate both products.
    expect(observationOf(TERM_ID, ANNUITY_ID, "CASH_VALUE_FEATURE_DIFFERS")).toBeUndefined();
  });

  it("coverage-structure difference appears only against the annuity", () => {
    expect(observationOf(TERM_ID, ANNUITY_ID, "COVERAGE_STRUCTURE_DIFFERS")).toBeDefined();
    expect(observationOf(TERM_ID, IUL_ID, "COVERAGE_STRUCTURE_DIFFERS")).toBeUndefined();
  });

  it("non-guaranteed elements are flagged wherever a product documents them", () => {
    const observation = observationOf(TERM_ID, IUL_ID, "NON_GUARANTEED_ELEMENTS_PRESENT")!;
    expect(observation.severity).toBe("review_note");
    // Term has no non-guaranteed elements, so only the IUL is referenced.
    expect(observation.factRefs.every((f) => f.productId === IUL_ID)).toBe(true);
  });

  it("illustration difference appears only when exactly one side documents it", () => {
    expect(observationOf(TERM_ID, IUL_ID, "ILLUSTRATION_REQUIRED_DIFFERS")).toBeDefined();
    expect(observationOf(TERM_ID, ANNUITY_ID, "ILLUSTRATION_REQUIRED_DIFFERS")).toBeUndefined();
  });

  it("no observation is produced from an empty or conflicted table", () => {
    expect(computeObservations([])).toEqual([]);
  });

  it("every observation references at least one validated citation", () => {
    for (const [a, b] of [
      [TERM_ID, IUL_ID],
      [IUL_ID, ANNUITY_ID],
      [TERM_ID, ANNUITY_ID],
    ] as const) {
      const draft = compare(a, b);
      const known = new Set(draft.dimensions.flatMap((r) => r.cells.flatMap((c) => c.citations.map((x) => x.citationId))));
      for (const observation of draft.observations) {
        expect(observation.citationIds.length).toBeGreaterThan(0);
        for (const id of observation.citationIds) expect(known.has(id)).toBe(true);
        for (const ref of observation.factRefs) {
          expect([a, b]).toContain(ref.productId);
        }
      }
    }
  });
});
