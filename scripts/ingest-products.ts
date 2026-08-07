import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCatalogSchema, ManifestSchema, type ProductDefinition } from "../lib/schemas";
import {
  DerivedPagesFileSchema,
  DerivedChunksFileSchema,
  type PageRecord,
  type ChunkRecord,
} from "../lib/ingestion/types";
import { checkManifestConsistency } from "../lib/ingestion/manifest-check";
import { buildDocumentRecords } from "../lib/ingestion/chunk-document";
import { ingestDocument, type IngestResult } from "../lib/ingestion/ingest-document";
import { testProduct, structuredPagesFor } from "../lib/ingestion/test-fixture";
import { createFakeProvider } from "../lib/embeddings/fake";
import { createOpenAiProvider } from "../lib/embeddings/openai";
import type { EmbeddingProvider } from "../lib/embeddings/provider";
import { createServiceClient } from "../lib/supabase/server";
import { deleteTestDocument, deleteTestRuns } from "../lib/supabase/repository";

// Transactional product ingestion CLI.
//   --embedding=openai  ingest the three approved fictional-product documents
//                       with real text-embedding-3-large vectors
//   --embedding=fake    offline pipeline smoke against a built-in test_
//                       fixture document only; cleaned up afterwards
// The provider must be selected explicitly — there is no fallback.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const started = Date.now();

const args = new Map(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return [m?.[1] ?? a, m?.[2] ?? "true"] as const;
  }),
);
const embedding = args.get("embedding");
const onlyDocumentId = args.get("document-id");

if (embedding !== "fake" && embedding !== "openai") {
  console.error("Usage: ingest-products --embedding=openai|fake [--document-id=<id>]");
  console.error("The embedding provider must be selected explicitly; there is no default.");
  process.exit(1);
}

const db = createServiceClient();
let provider: EmbeddingProvider;
let jobs: Array<{ product: ProductDefinition; pages: PageRecord[]; chunks: ChunkRecord[]; sha: string }> = [];
let cleanupTestId: string | null = null;

if (embedding === "openai") {
  provider = createOpenAiProvider(process.env.OPENAI_API_KEY);
  const catalog = ProductCatalogSchema.parse(
    JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
  );
  const manifest = ManifestSchema.parse(
    JSON.parse(readFileSync(join(ROOT, "data/fictional-products/manifest.json"), "utf8")),
  );
  for (const product of catalog.products) {
    if (onlyDocumentId && product.documentId !== onlyDocumentId) continue;
    const pdfPath = join(ROOT, "data/fictional-products/generated", product.fileName);
    const sha = createHash("sha256").update(readFileSync(pdfPath)).digest("hex");
    checkManifestConsistency(product, manifest.find((m) => m.documentId === product.documentId), sha);
    const pages = DerivedPagesFileSchema.parse(
      JSON.parse(readFileSync(join(ROOT, `data/derived/pages/${product.documentId}.pages.json`), "utf8")),
    ).pages;
    const chunks = DerivedChunksFileSchema.parse(
      JSON.parse(readFileSync(join(ROOT, `data/derived/chunks/${product.documentId}.chunks.json`), "utf8")),
    ).chunks;
    jobs.push({ product, pages, chunks, sha });
  }
} else {
  // Fake mode: built-in test fixture only. Never touches the real documents.
  provider = createFakeProvider();
  const product = testProduct({
    documentId: "test_doc_cli_fake",
    fileName: "test-doc-cli-fake.pdf",
  });
  if (onlyDocumentId && onlyDocumentId !== product.documentId) {
    console.error(`fake mode only supports the built-in fixture ${product.documentId}`);
    process.exit(1);
  }
  const { pageRecords, chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
  jobs = [{ product, pages: pageRecords, chunks: chunkRecords, sha: "0".repeat(64) }];
  cleanupTestId = product.documentId;
}

if (jobs.length === 0) {
  console.error(`no documents matched${onlyDocumentId ? ` --document-id=${onlyDocumentId}` : ""}`);
  process.exit(1);
}

const results: IngestResult[] = [];
for (const job of jobs) {
  const r = await ingestDocument(db, job.product, job.pages, job.chunks, provider, job.sha);
  results.push(r);
  const suffix =
    r.status === "failed" ? ` [${r.errorCode}] ${r.errorMessage}` : ` (${r.pages} pages, ${r.chunks} chunks)`;
  console.log(`${r.status.toUpperCase().padEnd(9)} ${r.documentId}${suffix}`);
}

if (cleanupTestId) {
  await deleteTestDocument(db, cleanupTestId);
  await deleteTestRuns(db, cleanupTestId);
  console.log(`cleaned up test fixture ${cleanupTestId}`);
}

const completed = results.filter((r) => r.status === "completed");
const skipped = results.filter((r) => r.status === "skipped");
const failed = results.filter((r) => r.status === "failed");
const pagesInserted = completed.reduce((s, r) => s + r.pages, 0);
const chunksInserted = completed.reduce((s, r) => s + r.chunks, 0);

console.log(`
Ingestion summary
  documents discovered   ${jobs.length}
  documents processed    ${completed.length}
  documents skipped      ${skipped.length}
  documents failed       ${failed.length}
  pages inserted         ${pagesInserted}
  chunks inserted        ${chunksInserted}
  embedding provider     ${provider.providerName}
  embedding model        ${provider.modelName}
  embedding dimensions   ${provider.dimensions}
  vectors created        ${completed.reduce((s, r) => s + r.vectors, 0)}
  database rows inserted ${completed.length + pagesInserted + chunksInserted}
  duration               ${Date.now() - started}ms`);

process.exit(failed.length > 0 ? 1 : 0);
