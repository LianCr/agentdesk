import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProductCatalogSchema } from "../../lib/schemas";
import { DerivedChunksFileSchema, type ChunkRecord } from "../../lib/ingestion/types";
import { compareProducts } from "../../lib/comparison/compare";
import type { ComparisonDraft } from "../../lib/comparison/types";
import { ComparisonDatasetSchema, type ComparisonCase } from "../../evals/comparison-schema";
import { evaluateComparisonCase, sameStructuredValue } from "../../evals/comparison-metrics";

// Does the M4-D evaluator have teeth?
//
// A frozen suite that passes on the first run is only meaningful if it can
// fail. Each test below injects one realistic defect into an otherwise correct
// draft and asserts the evaluator catches it in the right category — the
// mutation-testing counterpart to the M3 true-positive regressions.

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
const dataset = ComparisonDatasetSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "evals/comparisons.json"), "utf8")),
);

const TERM = "doc_termplus20_v1";
const IUL = "doc_indexflex_ul_v1";
const ANNUITY = "doc_securerate5_v1";

function evalCase(id: string): ComparisonCase {
  const found = dataset.cases.find((c) => c.id === id);
  if (!found) throw new Error(`no eval case ${id}`);
  return found;
}

function draftFor(evalCase: ComparisonCase): ComparisonDraft {
  const productA = catalog.products.find((p) => p.documentId === evalCase.productAId)!;
  const productB = catalog.products.find((p) => p.documentId === evalCase.productBId)!;
  return compareProducts({
    productA,
    productB,
    chunksByDocumentId,
    syntheticCase: null,
    comparisonIdFactory: () => `cmp_${evalCase.id}`,
    now: () => 0,
  });
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function run(evalCase: ComparisonCase, draft: ComparisonDraft) {
  return evaluateComparisonCase(evalCase, draft, chunksByDocumentId, 0);
}

function cellOf(draft: ComparisonDraft, dimensionId: string, index: 0 | 1) {
  return draft.dimensions.find((r) => r.dimensionId === dimensionId)!.cells[index];
}

describe("the frozen dataset passes on correct output", () => {
  it("every case in the dataset evaluates clean against the real engine", () => {
    for (const evalCase of dataset.cases) {
      if (evalCase.clientCaseId !== null) continue; // client cases need fixtures; covered by the runner
      const result = run(evalCase, draftFor(evalCase));
      expect(result.failures.map((f) => f.detail).join(" | "), evalCase.id).toBe("");
    }
  });
});

describe("evaluator catches injected defects (mutation checks)", () => {
  const base = evalCase("CMP-F01"); // Term x IUL, pins cash-value false and not_provided

  it("catches a citation pointing at the wrong product", () => {
    const draft = clone(draftFor(base));
    cellOf(draft, "cash_value", 0).citations[0]!.documentId = ANNUITY;
    const result = run(base, draft);
    expect(result.hardCounts.wrongCitationDocument).toBeGreaterThan(0);
    expect(result.failures.some((f) => f.category === "citation-ID defect")).toBe(true);
  });

  it("catches a citation whose page no longer matches its chunk", () => {
    const draft = clone(draftFor(base));
    cellOf(draft, "cash_value", 0).citations[0]!.pageStart = 5;
    const result = run(base, draft);
    expect(result.hardCounts.wrongCitationPage).toBeGreaterThan(0);
  });

  it("catches a quote that is not in the cited chunk", () => {
    const draft = clone(draftFor(base));
    cellOf(draft, "cash_value", 0).citations[0]!.quote = "The policy accumulates cash value.";
    const result = run(base, draft);
    expect(result.hardCounts.invalidCitationQuote).toBeGreaterThan(0);
  });

  it("catches two citations sharing one id — the M4-C browser-QA bug", () => {
    const draft = clone(draftFor(base));
    const termCitation = cellOf(draft, "cash_value", 0).citations[0]!;
    const iulCitation = cellOf(draft, "product_type", 1).citations[0]!;
    iulCitation.citationId = termCitation.citationId;
    const result = run(base, draft);
    expect(result.hardCounts.ambiguousCitationIds).toBeGreaterThan(0);
    expect(result.failures.some((f) => f.detail.includes("two different sources"))).toBe(true);
  });

  it("catches a documented negative collapsed into an absence", () => {
    const draft = clone(draftFor(base));
    const cell = cellOf(draft, "cash_value", 0);
    cell.availability = "not_provided";
    cell.rawValue = null;
    cell.citations = [];
    cell.displayValue = "演示资料未提供 Not provided in demo materials";
    const result = run(base, draft);
    expect(result.hardCounts.availabilityCollapse).toBeGreaterThan(0);
    expect(result.failures.some((f) => f.category === "availability defect")).toBe(true);
  });

  it("catches an available cell that lost its source", () => {
    const draft = clone(draftFor(base));
    cellOf(draft, "cash_value", 0).citations = [];
    const result = run(base, draft);
    expect(result.hardCounts.availableWithoutSource).toBeGreaterThan(0);
  });

  it("catches a conflict cell that still shows a value", () => {
    const draft = clone(draftFor(base));
    const cell = cellOf(draft, "cash_value", 0);
    cell.availability = "conflict";
    cell.conflictReason = "injected";
    const result = run(base, draft);
    expect(result.hardCounts.wrongFactualCells).toBeGreaterThan(0);
  });

  it("catches a cell bound to the wrong product column", () => {
    const draft = clone(draftFor(base));
    cellOf(draft, "product_type", 0).productId = IUL;
    const result = run(base, draft);
    expect(result.hardCounts.wrongProductAssignments).toBeGreaterThan(0);
    expect(result.failures.some((f) => f.category === "cross-category assignment defect")).toBe(true);
  });

  it("catches a derived cell that lost its provenance", () => {
    const derivedCase = evalCase("CMP-F03"); // IUL x annuity, both surrender cells derived
    const draft = clone(draftFor(derivedCase));
    cellOf(draft, "surrender_liquidity", 1).derivation = null;
    const result = run(derivedCase, draft);
    expect(result.hardCounts.wrongDerivedProvenance).toBeGreaterThan(0);
  });

  it("catches a wrong structured value even when the display text still reads well", () => {
    const derivedCase = evalCase("CMP-F03");
    const draft = clone(draftFor(derivedCase));
    cellOf(draft, "surrender_liquidity", 1).rawValue = 5;
    const result = run(derivedCase, draft);
    expect(result.hardCounts.wrongFactualCells).toBeGreaterThan(0);
  });

  it("catches an observation fired without support", () => {
    const observationCase = evalCase("CMP-O02"); // Term x IUL forbids the 5/7 observation
    const draft = clone(draftFor(observationCase));
    draft.observations.push({
      observationId: "obs_099",
      type: "RATE_GUARANTEE_SHORTER_THAN_SURRENDER",
      textZh: "注入",
      textEn: "injected",
      factRefs: [{ dimensionId: "guaranteed_elements", productId: IUL }],
      citationIds: [],
      severity: "review_note",
    });
    const result = run(observationCase, draft);
    expect(result.failures.some((f) => f.detail.includes("unsupported observation produced"))).toBe(true);
  });

  it("catches an observation citing a source no cell carries", () => {
    const observationCase = evalCase("CMP-O01");
    const draft = clone(draftFor(observationCase));
    draft.observations[0]!.citationIds = ["cit_999"];
    const result = run(observationCase, draft);
    expect(result.hardCounts.wrongObservationInputs).toBeGreaterThan(0);
  });

  it("catches a recommendation conclusion anywhere in the rendered draft", () => {
    const draft = clone(draftFor(base));
    cellOf(draft, "product_type", 0).displayValue = "Demo TermPlus 20 is the best choice for this client.";
    const result = run(base, draft);
    expect(result.hardCounts.recommendationViolations).toBeGreaterThan(0);
    expect(result.failures.some((f) => f.category === "boundary defect")).toBe(true);
  });

  it("catches a cap presented as a guaranteed return", () => {
    const guaranteeCase = evalCase("CMP-B02");
    const draft = clone(draftFor(guaranteeCase));
    cellOf(draft, "non_guaranteed_elements", 0).displayValue = "guaranteed 9.50% every year";
    const result = run(guaranteeCase, draft);
    expect(result.hardCounts.guaranteeViolations).toBeGreaterThan(0);
  });

  it("catches a reordered or truncated dimension list", () => {
    const draft = clone(draftFor(base));
    draft.dimensions = [draft.dimensions[1]!, draft.dimensions[0]!, ...draft.dimensions.slice(2)];
    const result = run(base, draft);
    expect(result.failures.some((f) => f.detail.includes("dimension list/order"))).toBe(true);
  });

  it("catches a wrong comparison status", () => {
    const draft = clone(draftFor(base));
    draft.comparisonStatus = "partial";
    const result = run(base, draft);
    expect(result.failures.some((f) => f.category === "status defect")).toBe(true);
  });
});

describe("semantic value comparison", () => {
  it("treats equal numbers as equal and different ones as different", () => {
    expect(sameStructuredValue(7, 7)).toBe(true);
    expect(sameStructuredValue(7, 10)).toBe(false);
    expect(sameStructuredValue(false, false)).toBe(true);
    expect(sameStructuredValue(false, null)).toBe(false);
  });

  it("compares fact-path maps key by key", () => {
    expect(
      sameStructuredValue({ "initialRate.guaranteeYears": 5 }, { "initialRate.guaranteeYears": 5, other: 1 }),
    ).toBe(true);
    expect(
      sameStructuredValue({ "initialRate.guaranteeYears": 5 }, { "initialRate.guaranteeYears": 7 }),
    ).toBe(false);
  });
});
