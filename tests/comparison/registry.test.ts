import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIMENSIONS, DIMENSION_IDS } from "../../lib/comparison/dimensions";
import { FACT_RULES, findFactRule } from "../../lib/comparison/fact-registry";
import { buildProductFactSheet } from "../../lib/comparison/fact-sheet";
import { parseProductFacts, readFactPath } from "../../lib/comparison/product-facts";
import { assertFactSheetIntegrity } from "../../lib/comparison/validate";
import { ALL_IDS, ANNUITY_ID, CATALOG, IUL_ID, TERM_ID, chunksFor, product } from "./fixtures";

// M4-A matrix items 1-9, 13, 19-23.

const sheetFor = (documentId: string) => buildProductFactSheet(product(documentId), chunksFor(documentId));
const cell = (documentId: string, dimensionId: string) => {
  const found = sheetFor(documentId).cells.find((c) => c.dimensionId === dimensionId);
  if (!found) throw new Error(`no cell ${dimensionId}`);
  return found;
};

describe("registry coverage (1)", () => {
  it("every (dimension, category) pair has a rule", () => {
    for (const dimensionId of DIMENSION_IDS) {
      for (const p of CATALOG.products) {
        expect(findFactRule(dimensionId, p.productCategory), `${dimensionId}/${p.productCategory}`).toBeDefined();
      }
    }
  });

  it("every rule resolves to available, not_applicable or not_provided — never conflict", () => {
    for (const documentId of ALL_IDS) {
      for (const c of sheetFor(documentId).cells) {
        expect(`${documentId}/${c.dimensionId}: ${c.conflictReason ?? ""}`).not.toContain("conflict");
        expect(c.availability, `${documentId}/${c.dimensionId}`).not.toBe("conflict");
      }
    }
  });
});

describe("registry holds no product values (2)", () => {
  it("the registry source contains no numeric product literals", () => {
    const source = readFileSync(join(process.cwd(), "lib/comparison/fact-registry.ts"), "utf8");
    // Strip the "$1,000 of face amount"-free prose: comments may explain, but
    // executable lines must not carry rates, ages, amounts or year counts.
    const code = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    const numerics = code.match(/(?<![A-Za-z_])\d+(?:\.\d+)?%?/g) ?? [];
    expect(numerics, `numeric literals in registry: ${numerics.join(", ")}`).toHaveLength(0);
  });

  it("displayed values are the ones in products.json, not copies", () => {
    const facts = parseProductFacts(product(IUL_ID));
    const guaranteed = cell(IUL_ID, "guaranteed_elements");
    const nonGuaranteed = cell(IUL_ID, "non_guaranteed_elements");
    expect(guaranteed.displayValue).toContain(readFactPath(facts, "cap.guaranteedMinimumRateDisplay"));
    expect(nonGuaranteed.displayValue).toContain(readFactPath(facts, "cap.currentRateDisplay"));
  });
});

describe("citations are mandatory for facts (3-5)", () => {
  it("every available cell carries at least one citation", () => {
    for (const documentId of ALL_IDS) {
      for (const c of sheetFor(documentId).cells) {
        if (c.availability === "available") {
          expect(c.citations.length, `${documentId}/${c.dimensionId}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("numeric facts carry citations", () => {
    const rate = cell(ANNUITY_ID, "crediting_mechanics");
    expect(rate.displayValue).toMatch(/\d/);
    expect(rate.citations.length).toBeGreaterThan(0);
  });

  it("negative facts carry citations", () => {
    const termCash = cell(TERM_ID, "cash_value");
    expect(termCash.rawValue).toBe(false);
    expect(termCash.citations.length).toBeGreaterThan(0);

    const annuityRiders = cell(ANNUITY_ID, "riders");
    expect(annuityRiders.rawValue).toBe(false);
    expect(annuityRiders.citations.length).toBeGreaterThan(0);
  });
});

describe("availability semantics (6-8)", () => {
  it("false is available with evidence, not not_applicable", () => {
    const termCash = cell(TERM_ID, "cash_value");
    expect(termCash.availability).toBe("available");
    expect(termCash.rawValue).toBe(false);
  });

  it("false is not not_provided", () => {
    const annuityRiders = cell(ANNUITY_ID, "riders");
    expect(annuityRiders.availability).toBe("available");
    expect(annuityRiders.availability).not.toBe("not_provided");
    expect(annuityRiders.displayValue).not.toContain("Not provided");
  });

  it("not_provided is not zero, not false, and carries no citation", () => {
    const termIllustration = cell(TERM_ID, "illustration_documentation");
    expect(termIllustration.availability).toBe("not_provided");
    expect(termIllustration.rawValue).toBeNull();
    expect(termIllustration.rawValue).not.toBe(false);
    expect(termIllustration.rawValue).not.toBe(0);
    expect(termIllustration.citations).toHaveLength(0);
  });

  it("not_applicable is a category rule with no citation", () => {
    const annuityCoverage = cell(ANNUITY_ID, "coverage_duration");
    expect(annuityCoverage.availability).toBe("not_applicable");
    expect(annuityCoverage.citations).toHaveLength(0);
  });
});

describe("category isolation (9)", () => {
  it("a rule only exists for its declared category", () => {
    for (const rule of FACT_RULES) {
      const owner = CATALOG.products.filter((p) => p.productCategory === rule.productCategory);
      expect(owner.length).toBeGreaterThan(0);
      expect(findFactRule(rule.dimensionId, rule.productCategory)).toBeDefined();
    }
  });

  it("annuity rate facts never land in a life-insurance premium dimension", () => {
    const annuityPremium = cell(ANNUITY_ID, "premium_structure");
    const facts = parseProductFacts(product(ANNUITY_ID));
    expect(annuityPremium.displayValue).not.toContain(readFactPath(facts, "initialRate.display"));
  });
});

describe("dimension ordering (13)", () => {
  it("cells follow DIMENSIONS order for every product", () => {
    for (const documentId of ALL_IDS) {
      expect(sheetFor(documentId).cells.map((c) => c.dimensionId)).toEqual(
        DIMENSIONS.map((d) => d.dimensionId),
      );
    }
  });
});

describe("IUL guaranteed vs non-guaranteed separation (21)", () => {
  it("the current cap is non-guaranteed and the minimum cap is guaranteed", () => {
    const facts = parseProductFacts(product(IUL_ID));
    const current = readFactPath(facts, "cap.currentRateDisplay") as string;
    const minimum = readFactPath(facts, "cap.guaranteedMinimumRateDisplay") as string;

    const guaranteed = cell(IUL_ID, "guaranteed_elements");
    const nonGuaranteed = cell(IUL_ID, "non_guaranteed_elements");

    expect(guaranteed.displayValue).toContain(minimum);
    expect(guaranteed.displayValue).not.toContain(current);
    expect(nonGuaranteed.displayValue).toContain(current);
    expect(nonGuaranteed.displayValue).not.toContain(minimum);
  });
});

describe("internal spec notes never surface (22)", () => {
  it("nonRenderedSpecNotes content appears in no cell", () => {
    const notes = (product(ANNUITY_ID).facts as { nonRenderedSpecNotes?: string[] }).nonRenderedSpecNotes ?? [];
    expect(notes.length).toBeGreaterThan(0);
    const rendered = sheetFor(ANNUITY_ID)
      .cells.map((c) => `${c.displayValue ?? ""} ${c.citations.map((x) => x.quote).join(" ")}`)
      .join(" ");
    for (const note of notes) {
      expect(rendered).not.toContain(note);
      expect(rendered).not.toContain(note.slice(0, 40));
    }
  });
});

describe("citations bind to their own product (23)", () => {
  it("no cell cites another product's document", () => {
    for (const documentId of ALL_IDS) {
      const sheet = sheetFor(documentId);
      for (const c of sheet.cells) {
        for (const citation of c.citations) {
          expect(citation.documentId, `${documentId}/${c.dimensionId}`).toBe(documentId);
          expect(citation.chunkId.startsWith(`${documentId}:`)).toBe(true);
        }
      }
    }
  });

  it("integrity validation passes for all three products", () => {
    for (const documentId of ALL_IDS) {
      expect(() =>
        assertFactSheetIntegrity(sheetFor(documentId), product(documentId), chunksFor(documentId)),
      ).not.toThrow();
    }
  });
});
