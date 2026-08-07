import { describe, expect, it } from "vitest";
import { lastNonZeroChargeYear, runDerivation } from "../../lib/comparison/derivations";
import { buildProductFactSheet } from "../../lib/comparison/fact-sheet";
import { parseProductFacts, readFactPath } from "../../lib/comparison/product-facts";
import { assertFactSheetIntegrity } from "../../lib/comparison/validate";
import { ANNUITY_ID, IUL_ID, chunksFor, clone, product } from "./fixtures";

// M4-A matrix items 10, 14-15, 18.
//
// The annuity guide never writes "seven-year surrender period" — the string
// "seven" appears nowhere in the document. The 7 therefore has to be computed
// from the surrender-charge table and cited to that table, which is what
// these tests pin down. A hardcoded 7 in the registry would pass a naive
// assertion; changing the table fixture is what proves it is really derived.

const annuity = product(ANNUITY_ID);
const annuityChunks = chunksFor(ANNUITY_ID);

describe("derivation rule (14-15, 18)", () => {
  it("computes the last contract year carrying a non-zero charge", () => {
    expect(lastNonZeroChargeYear([7, 6, 5, 4, 3, 2, 1])).toBe(7);
    expect(lastNonZeroChargeYear([9, 8, 0, 0])).toBe(2);
    expect(lastNonZeroChargeYear([5])).toBe(1);
  });

  it("phrases the result as what the schedule shows, not as a document sentence", () => {
    const derived = runDerivation("LAST_NONZERO_SURRENDER_CHARGE_YEAR", [[7, 6, 5, 4, 3, 2, 1]]);
    expect(derived.rawValue).toBe(7);
    expect(derived.displayEn).toContain("surrender-charge schedule");
    expect(derived.displayEn).toMatch(/through contract year 7/);
    expect(derived.displayEn.toLowerCase()).not.toContain("seven-year surrender period");
    expect(derived.displayZh).not.toContain("七年退保期");
  });

  it("rejects an empty or all-zero schedule instead of inventing a year", () => {
    expect(() => runDerivation("LAST_NONZERO_SURRENDER_CHARGE_YEAR", [[]])).toThrow(/DERIVATION_INPUT_INVALID/);
    expect(() => runDerivation("LAST_NONZERO_SURRENDER_CHARGE_YEAR", [[0, 0]])).toThrow(/DERIVATION_INPUT_INVALID/);
  });

  it("records derived provenance with its real input paths", () => {
    const sheet = buildProductFactSheet(annuity, annuityChunks);
    const liquidity = sheet.cells.find((c) => c.dimensionId === "surrender_liquidity")!;
    expect(liquidity.sourceKind).toBe("derived");
    expect(liquidity.derivation).not.toBeNull();
    expect(liquidity.derivation!.ruleId).toBe("LAST_NONZERO_SURRENDER_CHARGE_YEAR");
    expect(liquidity.derivation!.inputFactRefs).toContain("surrenderChargeSchedule.chargesByYearPercent");
    expect(liquidity.derivation!.reconciledWithPath).toBe("surrenderPeriodYears");

    const facts = parseProductFacts(annuity);
    expect(liquidity.rawValue).toBe(readFactPath(facts, "surrenderPeriodYears"));
  });

  it("direct cells record direct provenance and carry no derivation", () => {
    const sheet = buildProductFactSheet(annuity, annuityChunks);
    const rates = sheet.cells.find((c) => c.dimensionId === "crediting_mechanics")!;
    expect(rates.sourceKind).toBe("direct");
    expect(rates.derivation).toBeNull();
  });
});

describe("the derived year really comes from the table (18)", () => {
  it("shortening the schedule in a test fixture changes the derived year", () => {
    // Controlled fixture only — production products.json is untouched.
    const shortened = clone(annuity);
    const facts = shortened.facts as {
      surrenderChargeSchedule: { chargesByYearPercent: number[] };
      surrenderPeriodYears: number;
    };
    facts.surrenderChargeSchedule.chargesByYearPercent = [7, 6, 5];
    facts.surrenderPeriodYears = 3; // keep the structured counterpart consistent

    const sheet = buildProductFactSheet(shortened, annuityChunks);
    const liquidity = sheet.cells.find((c) => c.dimensionId === "surrender_liquidity")!;
    expect(liquidity.availability).toBe("available");
    expect(liquidity.rawValue).toBe(3);
    expect(liquidity.displayValue).toContain("contract year 3");
    expect(liquidity.displayValue).not.toContain("contract year 7");
  });

  it("a schedule that disagrees with the structured period is a conflict, not a preference", () => {
    const mismatched = clone(annuity);
    (mismatched.facts as { surrenderPeriodYears: number }).surrenderPeriodYears = 9;

    const sheet = buildProductFactSheet(mismatched, annuityChunks);
    const liquidity = sheet.cells.find((c) => c.dimensionId === "surrender_liquidity")!;
    expect(liquidity.availability).toBe("conflict");
    expect(liquidity.conflictReason).toContain("DERIVATION_RECONCILE_MISMATCH");
    // Fail closed: nothing renders as a verified fact.
    expect(liquidity.displayValue).toBeNull();
    expect(liquidity.citations).toHaveLength(0);
    expect(() => assertFactSheetIntegrity(sheet, mismatched, annuityChunks)).not.toThrow();
  });

  it("the IUL schedule derives its own year independently", () => {
    const iulSheet = buildProductFactSheet(product(IUL_ID), chunksFor(IUL_ID));
    const liquidity = iulSheet.cells.find((c) => c.dimensionId === "surrender_liquidity")!;
    const facts = parseProductFacts(product(IUL_ID));
    expect(liquidity.sourceKind).toBe("derived");
    expect(liquidity.rawValue).toBe(readFactPath(facts, "surrenderCharge.years"));
    expect(liquidity.rawValue).not.toBe(7); // not the annuity's number
  });
});
