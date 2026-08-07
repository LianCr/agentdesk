import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../lib/supabase/server";
import { DerivedChunksFileSchema, type ChunkRecord } from "../lib/ingestion/types";
import {
  ProductCatalogSchema,
  SyntheticCaseSchema,
  type ProductDefinition,
  type SyntheticCase,
} from "../lib/schemas";
import { compareProducts } from "../lib/comparison/compare";
import { lastNonZeroChargeYear } from "../lib/comparison/derivations";
import type { ComparisonDraft } from "../lib/comparison/types";
import { ComparisonDatasetSchema, type ComparisonCase } from "./comparison-schema";
import {
  evaluateComparisonCase,
  failedComparisonCase,
  rate,
  type CaseEvaluation,
} from "./comparison-metrics";

// M4-D runner. Fully deterministic and fully offline: the comparison engine
// reads committed products.json and derived chunks, so the only database
// contact is the before/after count that proves the knowledge base was never
// touched. No model is called.
//
//   npm run eval:comparison -- --out=evals/results/m4-baseline.json

const ROOT = process.cwd();
const COUNTED_TABLES = ["documents", "document_pages", "chunks"] as const;

interface Args {
  out: string;
  dataset: string;
  caseFilter: string | null;
}

function parseArgs(argv: string[]): Args {
  const get = (key: string): string | null => {
    const found = argv.find((a) => a.startsWith(`--${key}=`));
    return found ? found.slice(key.length + 3) : null;
  };
  const out = get("out");
  if (!out) throw new Error("usage: npm run eval:comparison -- --out=evals/results/<file>.json [--dataset=...] [--case=CMP-P01]");
  return { out, dataset: get("dataset") ?? "evals/comparisons.json", caseFilter: get("case") };
}

async function tableCounts(db: SupabaseClient): Promise<number[]> {
  const counts: number[] = [];
  for (const table of COUNTED_TABLES) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`DB_READ_FAILED: ${error.message}`);
    counts.push(count ?? -1);
  }
  return counts;
}

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
      JSON.parse(await readFile(join(ROOT, `data/derived/chunks/${product.documentId}.chunks.json`), "utf8")),
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

function build(catalog: Catalog, evalCase: ComparisonCase): { draft: ComparisonDraft; latencyMs: number } {
  const productA = catalog.products.find((p) => p.documentId === evalCase.productAId);
  const productB = catalog.products.find((p) => p.documentId === evalCase.productBId);
  if (!productA || !productB) throw new Error(`unknown product in ${evalCase.id}`);
  const syntheticCase = evalCase.clientCaseId
    ? catalog.cases.find((c) => c.caseId === evalCase.clientCaseId) ?? null
    : null;
  if (evalCase.clientCaseId && !syntheticCase) throw new Error(`unknown client ${evalCase.clientCaseId}`);
  const startedAt = Date.now();
  const draft = compareProducts({
    productA,
    productB,
    chunksByDocumentId: catalog.chunksByDocumentId,
    syntheticCase,
    comparisonIdFactory: () => `cmp_${evalCase.id}`,
  });
  return { draft, latencyMs: Date.now() - startedAt };
}

/**
 * Symmetry as a hard gate. Two cases in the same group compare the same pair
 * in opposite order; after normalizing presentation order, every structured
 * field must be identical. Only which column is which may differ.
 */
function checkSymmetry(
  drafts: Map<string, ComparisonDraft>,
  dataset: ComparisonCase[],
): Array<{ group: string; detail: string }> {
  const failures: Array<{ group: string; detail: string }> = [];
  const groups = new Map<string, ComparisonCase[]>();
  for (const evalCase of dataset) {
    if (!evalCase.symmetryGroup) continue;
    const list = groups.get(evalCase.symmetryGroup) ?? [];
    list.push(evalCase);
    groups.set(evalCase.symmetryGroup, list);
  }

  for (const [group, members] of groups) {
    if (members.length < 2) continue;
    const normalized = members.map((member) => {
      const draft = drafts.get(member.id);
      if (!draft) return null;
      // Canonical view: cells keyed by (dimension, product), order-independent.
      const cells = draft.dimensions.flatMap((row) =>
        row.cells.map((cell) => ({
          key: `${row.dimensionId}::${cell.productId}`,
          availability: cell.availability,
          sourceKind: cell.sourceKind,
          displayValue: cell.displayValue,
          rawValue: JSON.stringify(cell.rawValue ?? null),
          citations: cell.citations
            .map((c) => `${c.documentId}:${c.chunkId}:${c.pageStart}:${c.quote}`)
            .sort(),
        })),
      );
      cells.sort((a, b) => a.key.localeCompare(b.key));
      return {
        id: member.id,
        dimensions: draft.dimensions.map((r) => r.dimensionId).join(","),
        cells: JSON.stringify(cells),
        observations: JSON.stringify(
          draft.observations
            .map((o) => ({
              type: o.type,
              severity: o.severity,
              textEn: o.textEn,
              refs: o.factRefs.map((r) => `${r.dimensionId}:${r.productId}`).sort(),
            }))
            .sort((a, b) => a.type.localeCompare(b.type)),
        ),
        missing: draft.missingClientInformation.map((m) => m.field).sort().join(","),
        review: [...draft.reviewReasons].sort().join(","),
        status: draft.comparisonStatus,
      };
    });
    const [first, ...rest] = normalized;
    if (!first) continue;
    for (const other of rest) {
      if (!other) continue;
      for (const field of ["dimensions", "cells", "observations", "missing", "review", "status"] as const) {
        if (first[field] !== other[field]) {
          failures.push({ group, detail: `${first.id} vs ${other.id}: ${field} differs` });
        }
      }
    }
  }
  return failures;
}

/**
 * Conflict is unreachable from the committed data by design — every fact
 * reconciles. It is exercised on an in-memory mutated copy so fail-closed
 * behaviour is still proven, without touching production fixtures.
 */
function checkInjectedConflict(catalog: Catalog): { pass: boolean; detail: string } {
  const annuity = catalog.products.find((p) => p.productCategory === "fixed_annuity");
  const term = catalog.products.find((p) => p.productCategory === "term_life");
  if (!annuity || !term) return { pass: false, detail: "fixtures missing" };
  const mutated = JSON.parse(JSON.stringify(annuity)) as ProductDefinition;
  // Structured period no longer agrees with its own surrender-charge table.
  (mutated.facts as { surrenderPeriodYears: number }).surrenderPeriodYears = 99;
  const draft = compareProducts({
    productA: mutated,
    productB: term,
    chunksByDocumentId: catalog.chunksByDocumentId,
    comparisonIdFactory: () => "cmp_injected_conflict",
  });
  const cell = draft.dimensions.find((r) => r.dimensionId === "surrender_liquidity")?.cells[0];
  const problems: string[] = [];
  if (cell?.availability !== "conflict") problems.push(`availability ${cell?.availability}`);
  if (cell?.displayValue !== null) problems.push("conflict exposed a display value");
  if ((cell?.citations.length ?? 0) > 0) problems.push("conflict carried citations");
  if (draft.comparisonStatus !== "blocked") problems.push(`status ${draft.comparisonStatus}`);
  return {
    pass: problems.length === 0,
    detail: problems.length === 0
      ? "structured/table mismatch -> conflict cell, no value, no citation, status blocked"
      : problems.join("; "),
  };
}

/** The derived year must come from the table, not from a constant. */
function checkDerivationSource(catalog: Catalog): { pass: boolean; detail: string } {
  const annuity = catalog.products.find((p) => p.productCategory === "fixed_annuity");
  const term = catalog.products.find((p) => p.productCategory === "term_life");
  if (!annuity || !term) return { pass: false, detail: "fixtures missing" };
  const schedule = (annuity.facts as { surrenderChargeSchedule: { chargesByYearPercent: number[] } })
    .surrenderChargeSchedule.chargesByYearPercent;
  const expected = lastNonZeroChargeYear(schedule);

  const shortened = JSON.parse(JSON.stringify(annuity)) as ProductDefinition;
  const facts = shortened.facts as {
    surrenderChargeSchedule: { chargesByYearPercent: number[] };
    surrenderPeriodYears: number;
  };
  facts.surrenderChargeSchedule.chargesByYearPercent = schedule.slice(0, 3);
  facts.surrenderPeriodYears = 3;
  const draft = compareProducts({
    productA: shortened,
    productB: term,
    chunksByDocumentId: catalog.chunksByDocumentId,
    comparisonIdFactory: () => "cmp_derivation_probe",
  });
  const cell = draft.dimensions.find((r) => r.dimensionId === "surrender_liquidity")?.cells[0];
  const pass = expected === 7 && cell?.rawValue === 3;
  return {
    pass,
    detail: pass
      ? "committed table yields 7; a 3-year table fixture yields 3 — the value tracks the table"
      : `expected 7 from the committed table and 3 from the shortened fixture, got ${expected} / ${String(cell?.rawValue)}`,
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const dataset = ComparisonDatasetSchema.parse(
    JSON.parse(await readFile(join(ROOT, args.dataset), "utf8")),
  );
  const cases = args.caseFilter ? dataset.cases.filter((c) => c.id === args.caseFilter) : dataset.cases;
  const catalog = await loadCatalog();

  const db = createServiceClient();
  const dbBefore = await tableCounts(db);

  const drafts = new Map<string, ComparisonDraft>();
  const evaluations: CaseEvaluation[] = [];
  for (const evalCase of cases) {
    try {
      const { draft, latencyMs } = build(catalog, evalCase);
      drafts.set(evalCase.id, draft);
      evaluations.push(evaluateComparisonCase(evalCase, draft, catalog.chunksByDocumentId, latencyMs));
    } catch (err) {
      evaluations.push(failedComparisonCase(evalCase, err instanceof Error ? err.message : String(err)));
    }
  }

  const symmetryFailures = checkSymmetry(drafts, cases);
  const injectedConflict = checkInjectedConflict(catalog);
  const derivationSource = checkDerivationSource(catalog);
  const dbAfter = await tableCounts(db);

  const sum = (pick: (e: CaseEvaluation) => number) => evaluations.reduce((acc, e) => acc + pick(e), 0);
  const hard = {
    wrongFactualCells0: sum((e) => e.hardCounts.wrongFactualCells) === 0,
    wrongProductAssignments0: sum((e) => e.hardCounts.wrongProductAssignments) === 0,
    wrongCitationDocument0: sum((e) => e.hardCounts.wrongCitationDocument) === 0,
    wrongCitationPage0: sum((e) => e.hardCounts.wrongCitationPage) === 0,
    invalidCitationQuote0: sum((e) => e.hardCounts.invalidCitationQuote) === 0,
    ambiguousCitationIds0: sum((e) => e.hardCounts.ambiguousCitationIds) === 0,
    availableWithoutSource0: sum((e) => e.hardCounts.availableWithoutSource) === 0,
    inventedNumericCells0: sum((e) => e.hardCounts.inventedNumericCells) === 0,
    availabilityCollapse0: sum((e) => e.hardCounts.availabilityCollapse) === 0,
    wrongDerivedProvenance0: sum((e) => e.hardCounts.wrongDerivedProvenance) === 0,
    wrongObservationInputs0: sum((e) => e.hardCounts.wrongObservationInputs) === 0,
    recommendationViolations0: sum((e) => e.hardCounts.recommendationViolations) === 0,
    guaranteeViolations0: sum((e) => e.hardCounts.guaranteeViolations) === 0,
    symmetryFailures0: symmetryFailures.length === 0,
    injectedConflictFailsClosed: injectedConflict.pass,
    derivedFromTable: derivationSource.pass,
    dbUnchanged: JSON.stringify(dbBefore) === JSON.stringify(dbAfter),
  };

  const metrics = {
    cellFactCorrectness: rate(sum((e) => e.counts.cellsCorrect), sum((e) => e.counts.cellsChecked)),
    cellAvailabilityCorrectness: rate(sum((e) => e.counts.availabilityCorrect), sum((e) => e.counts.availabilityChecked)),
    cellCitationCorrectness: rate(sum((e) => e.counts.citationsCorrect), sum((e) => e.counts.citationsChecked)),
    observationCorrectness: rate(sum((e) => e.counts.observationsCorrect), sum((e) => e.counts.observationsChecked)),
    missingClientInfoAccuracy: rate(sum((e) => e.counts.missingInfoCorrect), sum((e) => e.counts.missingInfoChecked)),
    reviewReasonAccuracy: rate(sum((e) => e.counts.reviewCorrect), sum((e) => e.counts.reviewChecked)),
    comparisonStatusAccuracy: rate(
      evaluations.filter((e) => !e.failures.some((f) => f.category === "status defect")).length,
      evaluations.length,
    ),
    symmetryAccuracy: rate(
      [...new Set(cases.map((c) => c.symmetryGroup).filter(Boolean))].length - symmetryFailures.length,
      [...new Set(cases.map((c) => c.symmetryGroup).filter(Boolean))].length,
    ),
    dimensionCoverage: rate(
      evaluations.filter((e) => !e.failures.some((f) => f.detail.includes("dimension list/order"))).length,
      evaluations.length,
    ),
    deterministicLatencyMs: {
      median: median(evaluations.map((e) => e.latencyMs)),
      max: Math.max(...evaluations.map((e) => e.latencyMs)),
    },
  };

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: args.dataset,
    caseCount: evaluations.length,
    engine: { comparisonEngineVersion: 1, factRegistryVersion: 1, model: null },
    metrics,
    hardGates: hard,
    structuralChecks: { injectedConflict, derivationSource },
    symmetryFailures,
    dbCounts: { before: dbBefore, after: dbAfter },
    cases: evaluations,
  };

  const outPath = join(ROOT, args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const passed = evaluations.filter((e) => e.pass).length;
  console.log(`\nScored cases: ${passed}/${evaluations.length}`);
  for (const evaluation of evaluations.filter((e) => !e.pass)) {
    console.log(`  ${evaluation.id} FAIL`);
    for (const failure of evaluation.failures) console.log(`    [${failure.category}] ${failure.detail}`);
  }
  console.log("\nQUALITY METRICS:");
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === "number") console.log(`  ${key.padEnd(30)} ${(value * 100).toFixed(1)}%`);
    else if (value === null) console.log(`  ${key.padEnd(30)} n/a`);
    else console.log(`  ${key.padEnd(30)} ${JSON.stringify(value)}`);
  }
  console.log("\nSTRUCTURAL CHECKS:");
  console.log(`  injected conflict  ${injectedConflict.pass ? "PASS" : "FAIL"} — ${injectedConflict.detail}`);
  console.log(`  derived from table ${derivationSource.pass ? "PASS" : "FAIL"} — ${derivationSource.detail}`);
  console.log("\nHARD GATES:");
  let allGates = true;
  for (const [gate, ok] of Object.entries(hard)) {
    if (!ok) allGates = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${gate}`);
  }
  console.log(`\nDB: ${dbBefore.join("/")} -> ${dbAfter.join("/")}`);
  console.log(allGates ? "ALL HARD GATES PASS" : "HARD GATE FAILURE — see above");
  return allGates ? 0 : 1;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
