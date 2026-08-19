import "server-only";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildClientRosterEntry, type ClientRosterEntry } from "./client-roster";
import { DerivedChunksFileSchema, type ChunkRecord } from "../ingestion/types";
import {
  ManifestSchema,
  ProductCatalogSchema,
  SyntheticCaseSchema,
  type ProductDefinition,
  type SyntheticCase,
} from "../schemas";

// Server-only loader for the committed comparison inputs. The browser never
// imports this module (and cannot: `server-only` makes that a build error), so
// product facts, derived chunks and synthetic cases stay on the server and the
// client receives only a finished ComparisonDraft.
//
// Everything is read from disk once and cached for the process — the
// comparison path performs no database and no network access at all.

interface Catalog {
  products: ProductDefinition[];
  chunksByDocumentId: Record<string, ChunkRecord[]>;
  cases: SyntheticCase[];
  fileByDocumentId: Map<string, string>;
}

let cached: Catalog | null = null;

export async function loadComparisonCatalog(): Promise<Catalog> {
  if (cached) return cached;
  const root = process.cwd();

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

  cached = {
    products: catalog.products,
    chunksByDocumentId,
    cases,
    fileByDocumentId: new Map(manifest.map((entry) => [entry.documentId, entry.file])),
  };
  return cached;
}

// What the selection controls need. Products stay ids and display names; the
// clients carry their demo background too, because /compare shows a roster the
// way the assistant page shows its knowledge base. Everything in it is
// committed fictional demo data — no product facts and no chunk text.
export interface ComparisonOptions {
  products: Array<{ documentId: string; productName: string; productCategory: string }>;
  clients: ClientRosterEntry[];
}

export async function loadComparisonOptions(): Promise<ComparisonOptions> {
  const { products, cases } = await loadComparisonCatalog();
  return {
    products: products.map((p) => ({
      documentId: p.documentId,
      productName: p.productName,
      productCategory: p.productCategory,
    })),
    clients: cases.map(buildClientRosterEntry),
  };
}
