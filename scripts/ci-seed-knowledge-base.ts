import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCatalogSchema, ManifestSchema } from "../lib/schemas";
import { DerivedPagesFileSchema, DerivedChunksFileSchema } from "../lib/ingestion/types";
import { checkManifestConsistency } from "../lib/ingestion/manifest-check";
import { ingestDocument } from "../lib/ingestion/ingest-document";
import type { EmbeddingProvider } from "../lib/embeddings/provider";
import { createServiceClient } from "../lib/supabase/server";

// CI ONLY. Seeds an EPHEMERAL local Supabase (started by `supabase start` in
// the GitHub Actions runner) with the three committed demo documents, so the
// database tests and the M4/M5 evals see the same 3/20/45 knowledge base the
// real project has and can prove they leave it unchanged.
//
// Pages and chunks are the committed derived fixtures, byte for byte. The
// vectors are NOT real embeddings: a deterministic placeholder provider,
// recorded as embedding_provider = "ci-placeholder", so nothing in CI can
// pretend to measure retrieval quality (no CI job does). The script refuses
// to run against anything but a localhost database, so placeholder vectors
// can never reach a real project.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const url = new URL(process.env.SUPABASE_URL ?? "http://missing");
if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
  console.error(`refusing to seed placeholder vectors into non-local database ${url.hostname}`);
  process.exit(1);
}

function placeholderVector(input: string): number[] {
  const out: number[] = [];
  let block = createHash("sha256").update(input).digest();
  while (out.length < 1536) {
    for (const byte of block) out.push(byte / 127.5 - 1);
    block = createHash("sha256").update(block).digest();
  }
  const v = out.slice(0, 1536);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

const provider: EmbeddingProvider = {
  providerName: "ci-placeholder",
  modelName: "none",
  dimensions: 1536,
  embedMany: async (inputs) => inputs.map(placeholderVector),
};

const catalog = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);
const manifest = ManifestSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/manifest.json"), "utf8")),
);

const db = createServiceClient();
let failed = 0;
for (const product of catalog.products) {
  const pdf = readFileSync(join(ROOT, "data/fictional-products/generated", product.fileName));
  const sha = createHash("sha256").update(pdf).digest("hex");
  checkManifestConsistency(product, manifest.find((m) => m.documentId === product.documentId), sha);
  const pages = DerivedPagesFileSchema.parse(
    JSON.parse(readFileSync(join(ROOT, `data/derived/pages/${product.documentId}.pages.json`), "utf8")),
  ).pages;
  const chunks = DerivedChunksFileSchema.parse(
    JSON.parse(readFileSync(join(ROOT, `data/derived/chunks/${product.documentId}.chunks.json`), "utf8")),
  ).chunks;
  const r = await ingestDocument(db, product, pages, chunks, provider, sha);
  console.log(`${r.status.padEnd(9)} ${r.documentId} (${r.pages} pages, ${r.chunks} chunks)`);
  if (r.status === "failed") {
    console.error(`  [${r.errorCode}] ${r.errorMessage}`);
    failed += 1;
  }
}
process.exit(failed > 0 ? 1 : 0);
