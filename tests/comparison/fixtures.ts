import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DerivedChunksFileSchema, type ChunkRecord } from "../../lib/ingestion/types";
import { ProductCatalogSchema, type ProductDefinition } from "../../lib/schemas";

// M4-A tests run entirely against the committed, already-validated artefacts:
// products.json and the derived chunk fixtures. No database, no network, no
// model. That is the point of the Gate — comparison facts must be resolvable
// offline and deterministically.

const ROOT = process.cwd();

export const CATALOG = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);

export function product(documentId: string): ProductDefinition {
  const found = CATALOG.products.find((p) => p.documentId === documentId);
  if (!found) throw new Error(`no product ${documentId}`);
  return found;
}

export function chunksFor(documentId: string): ChunkRecord[] {
  return DerivedChunksFileSchema.parse(
    JSON.parse(readFileSync(join(ROOT, `data/derived/chunks/${documentId}.chunks.json`), "utf8")),
  ).chunks;
}

export const TERM_ID = "doc_termplus20_v1";
export const IUL_ID = "doc_indexflex_ul_v1";
export const ANNUITY_ID = "doc_securerate5_v1";

export const ALL_IDS = [TERM_ID, IUL_ID, ANNUITY_ID] as const;

// Deep clone so a test can mutate a fixture (e.g. shorten a surrender-charge
// table) without touching the production data on disk.
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
