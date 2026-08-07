import { describe, expect, it } from "vitest";
import { buildProductFactSheet } from "../../lib/comparison/fact-sheet";
import { FACT_RULES, findFactRule } from "../../lib/comparison/fact-registry";
import { readFactPath } from "../../lib/comparison/product-facts";
import { assertFactSheetIntegrity } from "../../lib/comparison/validate";
import type { ComparisonCell, ProductFactSheet } from "../../lib/comparison/types";
import { ANNUITY_ID, IUL_ID, TERM_ID, chunksFor, clone, product } from "./fixtures";

// M4-A matrix items 9-10 and the integrity contract (plan §13).

const term = product(TERM_ID);
const termChunks = chunksFor(TERM_ID);

function tamper(sheet: ProductFactSheet, dimensionId: string, patch: Partial<ComparisonCell>): ProductFactSheet {
  const copy = clone(sheet);
  const index = copy.cells.findIndex((c) => c.dimensionId === dimensionId);
  copy.cells[index] = { ...copy.cells[index]!, ...patch } as ComparisonCell;
  return copy;
}

describe("structured value vs evidence must agree (10)", () => {
  it("a display string absent from the document is a conflict, not an available fact", () => {
    const drifted = clone(term);
    // products.json now claims something the PDF never says.
    (drifted.facts as { cashValue: { display: string } }).cashValue.display =
      "None. The policy accumulates a modest cash value.";

    const sheet = buildProductFactSheet(drifted, termChunks);
    const cash = sheet.cells.find((c) => c.dimensionId === "cash_value")!;
    expect(cash.availability).toBe("conflict");
    expect(cash.conflictReason).toContain("NO_EVIDENCE_ON_ANCHOR_PAGE");
    expect(cash.displayValue).toBeNull();
    expect(cash.citations).toHaveLength(0);
    // Fail closed, but the sheet as a whole stays structurally valid.
    expect(() => assertFactSheetIntegrity(sheet, drifted, termChunks)).not.toThrow();
  });

  it("a fact the document does not contain cannot become an available cell", () => {
    const invented = clone(term);
    (invented.facts as { riders: unknown[] }).riders = [
      { name: "Ghost Rider", display: "Covers everything, at no cost." },
    ];
    const ghost = buildProductFactSheet(invented, termChunks).cells.find((c) => c.dimensionId === "riders")!;
    expect(ghost.availability).toBe("conflict");
    expect(ghost.displayValue).toBeNull();
    expect(ghost.citations).toHaveLength(0);
  });

  it("a structurally invalid facts object fails closed at parse time", () => {
    const stripped = clone(term);
    delete (stripped.facts as { cashValue?: unknown }).cashValue;
    expect(() => buildProductFactSheet(stripped, termChunks)).toThrow(/PRODUCT_FACTS_INVALID/);
  });
});

describe("category isolation is structural (9)", () => {
  it("every rule is keyed by its own category and cannot be looked up under another", () => {
    for (const rule of FACT_RULES) {
      const others = (["term_life", "indexed_universal_life", "fixed_annuity"] as const).filter(
        (c) => c !== rule.productCategory,
      );
      for (const other of others) {
        const foreign = findFactRule(rule.dimensionId, other);
        expect(foreign?.productCategory ?? other).toBe(other);
      }
    }
  });

  it("a life-insurance-only fact path is never read for the annuity", () => {
    const annuitySheet = buildProductFactSheet(product(ANNUITY_ID), chunksFor(ANNUITY_ID));
    const rendered = annuitySheet.cells.map((c) => c.displayValue ?? "").join(" ");
    const termFacts = term.facts as { cashValue: { display: string } };
    expect(rendered).not.toContain(termFacts.cashValue.display);
  });

  it("IUL and annuity surrender units stay distinct", () => {
    const iul = buildProductFactSheet(product(IUL_ID), chunksFor(IUL_ID));
    const annuity = buildProductFactSheet(product(ANNUITY_ID), chunksFor(ANNUITY_ID));
    const iulCell = iul.cells.find((c) => c.dimensionId === "surrender_liquidity")!;
    const annuityCell = annuity.cells.find((c) => c.dimensionId === "surrender_liquidity")!;
    const iulBasis = readFactPath(product(IUL_ID).facts, "surrenderChargeSchedule.basis") as string;
    const annuityBasis = readFactPath(product(ANNUITY_ID).facts, "surrenderChargeSchedule.basis") as string;
    expect(iulBasis).not.toBe(annuityBasis);
    expect(iulCell.citations[0]!.documentId).toBe(IUL_ID);
    expect(annuityCell.citations[0]!.documentId).toBe(ANNUITY_ID);
  });
});

describe("integrity validation catches tampering", () => {
  const sheet = buildProductFactSheet(term, termChunks);

  it("an available fact stripped of citations fails", () => {
    const broken = tamper(sheet, "cash_value", { citations: [] });
    expect(() => assertFactSheetIntegrity(broken, term, termChunks)).toThrow(/without a citation/);
  });

  it("a citation pointing at another product fails", () => {
    const cash = sheet.cells.find((c) => c.dimensionId === "cash_value")!;
    const broken = tamper(sheet, "cash_value", {
      citations: [{ ...cash.citations[0]!, documentId: ANNUITY_ID }],
    });
    expect(() => assertFactSheetIntegrity(broken, term, termChunks)).toThrow(/cites doc_securerate5_v1/);
  });

  it("a quote that is not in its chunk fails", () => {
    const cash = sheet.cells.find((c) => c.dimensionId === "cash_value")!;
    const broken = tamper(sheet, "cash_value", {
      citations: [{ ...cash.citations[0]!, quote: "The policy accumulates cash value." }],
    });
    expect(() => assertFactSheetIntegrity(broken, term, termChunks)).toThrow(/quote is not in its chunk/);
  });

  it("a not_applicable cell carrying a citation fails", () => {
    const cash = sheet.cells.find((c) => c.dimensionId === "cash_value")!;
    const broken = tamper(sheet, "surrender_liquidity", { citations: [cash.citations[0]!] });
    expect(() => assertFactSheetIntegrity(broken, term, termChunks)).toThrow(/must not carry citations/);
  });

  it("a conflict masquerading as a verified value fails", () => {
    const broken = tamper(sheet, "cash_value", {
      availability: "conflict",
      conflictReason: "test",
      displayValue: "None. The policy does not accumulate cash value.",
    });
    expect(() => assertFactSheetIntegrity(broken, term, termChunks)).toThrow(/must not expose a display value/);
  });

  it("intentionally omitted content cannot be presented as a fact", () => {
    // TermPlus deliberately omits any age-61 premium; if one ever reached a
    // cell, the product's own omission patterns must reject it.
    const broken = tamper(sheet, "premium_structure", {
      displayValue: "The premium at age 61 is $210 per month.",
    });
    expect(() => assertFactSheetIntegrity(broken, term, termChunks)).toThrow(/intentional omission/);
  });

  it("reordered dimensions fail", () => {
    const broken = clone(sheet);
    broken.cells = [broken.cells[1]!, broken.cells[0]!, ...broken.cells.slice(2)];
    expect(() => assertFactSheetIntegrity(broken, term, termChunks)).toThrow(/expected/);
  });

  it("a derived cell without a derivation fails", () => {
    const annuitySheet = buildProductFactSheet(product(ANNUITY_ID), chunksFor(ANNUITY_ID));
    const broken = tamper(annuitySheet, "surrender_liquidity", { derivation: null });
    expect(() => assertFactSheetIntegrity(broken, product(ANNUITY_ID), chunksFor(ANNUITY_ID))).toThrow(
      /derived cell without a derivation/,
    );
  });
});
