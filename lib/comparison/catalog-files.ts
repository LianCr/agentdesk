import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { DerivedChunksFileSchema, type ChunkRecord } from "../ingestion/types";
import {
  ManifestSchema,
  ProductCatalogSchema,
  SyntheticCaseSchema,
  type ProductDefinition,
  type SyntheticCase,
} from "../schemas";

// Reads the committed comparison inputs from disk: product facts, derived
// chunks, synthetic cases and the manifest. Pure file I/O + schema
// validation, no `server-only` marker, so non-Next entry points (the MCP
// server) can use it. The Next app goes through ./loader.ts, which adds the
// server-only guard and a process cache.

export interface Catalog {
  products: ProductDefinition[];
  chunksByDocumentId: Record<string, ChunkRecord[]>;
  cases: SyntheticCase[];
  fileByDocumentId: Map<string, string>;
}

export async function readComparisonCatalog(root: string): Promise<Catalog> {
  const catalog = ProductCatalogSchema.parse(
    JSON.parse(await readFile(join(root, "data/fictional-products/products.json"), "utf8")),
  );
  const manifest = ManifestSchema.parse(
    JSON.parse(await readFile(join(root, "data/fictional-products/manifest.json"), "utf8")),
  );

  const chunksByDocumentId: Record<string, ChunkRecord[]> = {};
  for (const product of catalog.products) {
    chunksByDocumentId[product.documentId] = DerivedChunksFileSchema.parse(
      JSON.parse(
        await readFile(join(root, `data/derived/chunks/${product.documentId}.chunks.json`), "utf8"),
      ),
    ).chunks;
  }

  const caseDir = join(root, "data/synthetic-cases");
  const cases: SyntheticCase[] = [];
  for (const file of (await readdir(caseDir)).sort()) {
    if (!file.endsWith(".json")) continue;
    cases.push(SyntheticCaseSchema.parse(JSON.parse(await readFile(join(caseDir, file), "utf8"))));
  }

  return {
    products: catalog.products,
    chunksByDocumentId,
    cases,
    fileByDocumentId: new Map(manifest.map((entry) => [entry.documentId, entry.file])),
  };
}
