import { randomUUID } from "node:crypto";
import type { ChunkRecord } from "../ingestion/types";
import type { ProductDefinition, SyntheticCase } from "../schemas";
import { normalizeClientContext } from "./client-context";
import { DIMENSIONS, isCoreDimension } from "./dimensions";
import { buildProductFactSheet, productRef } from "./fact-sheet";
import { computeMissingClientInformation } from "./missing-info";
import { computeObservations } from "./observations";
import { computeReviewFlags } from "./review";
import { assertFactSheetIntegrity } from "./validate";
import {
  COMPARISON_ENGINE_VERSION,
  FACT_REGISTRY_VERSION,
  type ComparisonDraft,
  type ComparisonRow,
  type ComparisonStatus,
  type ProductFactSheet,
} from "./types";

// The deterministic comparison engine.
//
// Nothing here consults a model, a database or the network: two validated
// M4-A fact sheets are projected into rows, and status / observations /
// missing information / review flags follow from those rows by code. The
// optional narrative (lib/comparison/narrative.ts) is layered on afterwards
// and cannot change any of it.
//
// Product order is a presentation choice, never a business input. All logic
// runs on a canonical ordering (documentId ascending) and is projected into
// the caller's order at the end, so comparing A-vs-B and B-vs-A can only
// differ by which column is which.

export const DISCLAIMER_ZH =
  "本比较为内部工作草稿,仅供持牌保险经纪人审阅。所有产品与数据均为虚构演示资料。" +
  "本文不构成最终推荐、suitability 判断、报价、保单 illustration,也不构成法律或税务意见。";
export const DISCLAIMER_EN =
  "This comparison is an internal working draft for licensed-agent review. All products and data are " +
  "fictional demonstration materials. It is not a final recommendation, a suitability determination, a " +
  "quote, a policy illustration, or legal or tax advice.";

export interface ComparisonInput {
  productA: ProductDefinition;
  productB: ProductDefinition;
  chunksByDocumentId: Readonly<Record<string, readonly ChunkRecord[]>>;
  syntheticCase?: SyntheticCase | null;
  comparisonIdFactory?: () => string;
  now?: () => number;
}

function chunksFor(input: ComparisonInput, documentId: string): readonly ChunkRecord[] {
  const chunks = input.chunksByDocumentId[documentId];
  if (!chunks) throw new Error(`COMPARISON_INPUT: no chunks for ${documentId}`);
  return chunks;
}

function buildRows(sheetA: ProductFactSheet, sheetB: ProductFactSheet): ComparisonRow[] {
  return DIMENSIONS.map((dimension) => {
    const cellA = sheetA.cells.find((c) => c.dimensionId === dimension.dimensionId);
    const cellB = sheetB.cells.find((c) => c.dimensionId === dimension.dimensionId);
    if (!cellA || !cellB) {
      throw new Error(`COMPARISON_ROW_MISSING: ${dimension.dimensionId}`);
    }
    return {
      dimensionId: dimension.dimensionId,
      labelZh: dimension.labelZh,
      labelEn: dimension.labelEn,
      core: dimension.core,
      cells: [cellA, cellB] as [typeof cellA, typeof cellB],
    };
  });
}

/**
 * complete — every dimension resolved to a known state (available,
 *            not_applicable or not_provided) with no conflicts. `not_provided`
 *            is knowledge, not failure, so it does not downgrade anything.
 * partial   — a non-core dimension is in conflict; the rest of the table is
 *            still safe to read.
 * blocked   — a core dimension is in conflict, so no comparison conclusion is
 *            safe.
 */
export function computeComparisonStatus(rows: readonly ComparisonRow[]): ComparisonStatus {
  let sawNonCoreConflict = false;
  for (const row of rows) {
    const conflicted = row.cells.some((c) => c.availability === "conflict");
    if (!conflicted) continue;
    if (isCoreDimension(row.dimensionId)) return "blocked";
    sawNonCoreConflict = true;
  }
  return sawNonCoreConflict ? "partial" : "complete";
}

function swapRows(rows: readonly ComparisonRow[]): ComparisonRow[] {
  return rows.map((row) => ({ ...row, cells: [row.cells[1], row.cells[0]] as ComparisonRow["cells"] }));
}

export function compareProducts(input: ComparisonInput): ComparisonDraft {
  const startedAt = (input.now ?? Date.now)();
  if (input.productA.documentId === input.productB.documentId) {
    throw new Error("COMPARISON_INPUT: a product cannot be compared with itself");
  }

  // Canonical order: business logic must not depend on which product the
  // caller happened to put first.
  const swapped = input.productB.documentId < input.productA.documentId;
  const [first, second] = swapped
    ? [input.productB, input.productA]
    : [input.productA, input.productB];

  const sheets = [first, second].map((product) => {
    const chunks = chunksFor(input, product.documentId);
    const sheet = buildProductFactSheet(product, chunks);
    assertFactSheetIntegrity(sheet, product, chunks);
    return sheet;
  });

  const canonicalRows = buildRows(sheets[0]!, sheets[1]!);
  const comparisonStatus = computeComparisonStatus(canonicalRows);
  const observations = computeObservations(canonicalRows);

  const client = input.syntheticCase ? normalizeClientContext(input.syntheticCase) : null;
  const categories = [first.productCategory, second.productCategory];
  const missingClientInformation = computeMissingClientInformation(client, categories);
  const reviewReasons = computeReviewFlags({
    rows: canonicalRows,
    client,
    categories,
    products: [first, second],
  });

  const rows = swapped ? swapRows(canonicalRows) : canonicalRows;

  return {
    schemaVersion: 1,
    comparisonId: (input.comparisonIdFactory ?? randomUUID)(),
    productA: productRef(input.productA),
    productB: productRef(input.productB),
    clientContext: client,
    dimensions: rows,
    observations,
    missingClientInformation,
    // The deterministic core is a complete, valid draft on its own.
    narrativeSections: [],
    narrativeStatus: "not_requested",
    narrativeRejectionReason: null,
    comparisonStatus,
    reviewRequired: reviewReasons.length > 0,
    reviewReasons,
    disclaimerZh: DISCLAIMER_ZH,
    disclaimerEn: DISCLAIMER_EN,
    meta: {
      comparisonEngineVersion: COMPARISON_ENGINE_VERSION,
      factRegistryVersion: FACT_REGISTRY_VERSION,
      narrativeModel: null,
      latencyMs: (input.now ?? Date.now)() - startedAt,
    },
  };
}
