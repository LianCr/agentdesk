import { describe, expect, it } from "vitest";
import { DIMENSIONS } from "../../lib/comparison/dimensions";
import { REPLACEMENT_CHECKLIST_KEYS } from "../../lib/reviews/checklist";
import { FIXTURE_CHECKLIST_DETAIL } from "../../components/reviews/checklist-detail-copy";

// The copy module is keyed by the fixture strings the generator emits. If either
// side is edited alone the UI silently loses a panel, so the drift is asserted
// rather than trusted.

const REPLACEMENT_KEYS = REPLACEMENT_CHECKLIST_KEYS;

describe("checklist detail copy", () => {
  it("covers every fixture checklist key, and invents no extra ones", () => {
    expect(REPLACEMENT_KEYS.length).toBe(8);
    expect(Object.keys(FIXTURE_CHECKLIST_DETAIL).sort()).toEqual([...REPLACEMENT_KEYS].sort());
  });

  it("is bilingual throughout", () => {
    for (const [key, copy] of Object.entries(FIXTURE_CHECKLIST_DETAIL)) {
      for (const field of ["whyZh", "whyEn", "verifyZh", "verifyEn"] as const) {
        expect(copy[field].trim().length, `${key}.${field}`).toBeGreaterThan(0);
      }
    }
  });

  it("links only the two rows that describe the contract being applied for", () => {
    const linked = Object.entries(FIXTURE_CHECKLIST_DETAIL)
      .filter(([, copy]) => copy.relatedDimensionId !== undefined)
      .map(([key, copy]) => [key, copy.relatedDimensionId]);
    // The client's existing contract is not in the comparison; paperwork and a
    // suitability review are not product facts. Mapping any of those to a row
    // would point the reviewer at another product's numbers.
    expect(linked).toEqual([
      ["new contract guaranteed rate period", "guaranteed_elements"],
      ["new contract surrender period", "surrender_liquidity"],
    ]);
  });

  it("only links dimensions that exist", () => {
    const known = new Set(DIMENSIONS.map((d) => d.dimensionId));
    for (const [key, copy] of Object.entries(FIXTURE_CHECKLIST_DETAIL)) {
      if (copy.relatedDimensionId) expect(known.has(copy.relatedDimensionId as never), key).toBe(true);
    }
  });

  it("states no recommendation, no guarantee and no legal duty", () => {
    // Deliberately a small explicit list rather than lib/rag/redlines.ts, which
    // classifies user queries: pointing a query classifier at authored copy is a
    // misapplication dressed up as reuse.
    const banned = [
      "最好", "最适合", "推荐", "建议购买", "保证收益", "无风险", "法律要求", "必须依法",
      "best", "guaranteed return", "we recommend", "most suitable", "should buy", "required by law",
    ];
    for (const [key, copy] of Object.entries(FIXTURE_CHECKLIST_DETAIL)) {
      const text = `${copy.whyZh} ${copy.whyEn} ${copy.verifyZh} ${copy.verifyEn}`.toLowerCase();
      for (const phrase of banned) {
        expect(text.includes(phrase.toLowerCase()), `${key} contains "${phrase}"`).toBe(false);
      }
    }
  });

  it("quotes no product numbers — those belong in the cited table", () => {
    for (const [key, copy] of Object.entries(FIXTURE_CHECKLIST_DETAIL)) {
      const text = `${copy.whyZh} ${copy.whyEn} ${copy.verifyZh} ${copy.verifyEn}`;
      expect(/\d/.test(text), `${key} contains a digit`).toBe(false);
    }
  });
});
