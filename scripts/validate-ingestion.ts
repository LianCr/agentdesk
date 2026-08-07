import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCatalogSchema } from "../lib/schemas.js";
import {
  DerivedPagesFileSchema,
  DerivedChunksFileSchema,
} from "../lib/ingestion/types.js";
import { fingerprintFor } from "../lib/ingestion/fingerprint.js";
import { createServiceClient } from "../lib/supabase/server.js";
import { getActiveDocument, documentRowCounts } from "../lib/supabase/repository.js";

// Read-only reconciliation of the database against the committed derived
// fixtures: row counts, chunk identity/hashes, embedding dimensions,
// fingerprints, run history, leftover test data. Exit 1 on any failure.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const fail = (msg: string): void => {
  failures++;
  console.error(`FAIL: ${msg}`);
};

const db = createServiceClient();
const catalog = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);

for (const product of catalog.products) {
  const id = product.documentId;
  const pagesFixture = DerivedPagesFileSchema.parse(
    JSON.parse(readFileSync(join(ROOT, `data/derived/pages/${id}.pages.json`), "utf8")),
  ).pages;
  const chunksFixture = DerivedChunksFileSchema.parse(
    JSON.parse(readFileSync(join(ROOT, `data/derived/chunks/${id}.chunks.json`), "utf8")),
  ).chunks;

  const { data: doc, error } = await db
    .from("documents")
    .select("id, ingestion_fingerprint, embedding_provider, embedding_model, embedding_dimensions, page_count")
    .eq("document_id", id)
    .maybeSingle();
  if (error) {
    fail(`${id}: read failed — ${error.message}`);
    continue;
  }
  if (!doc) {
    fail(`${id}: no active document row`);
    continue;
  }

  if (doc.embedding_provider === "fake-deterministic") {
    fail(`${id}: real document carries FAKE embeddings`);
  }

  const counts = await documentRowCounts(db, id);
  if (counts.pages !== pagesFixture.length) {
    fail(`${id}: ${counts.pages} pages in DB != ${pagesFixture.length} in fixtures`);
  }
  if (counts.chunks !== chunksFixture.length) {
    fail(`${id}: ${counts.chunks} chunks in DB != ${chunksFixture.length} in fixtures`);
  }

  const expectedFp = fingerprintFor(product, pagesFixture, {
    providerName: doc.embedding_provider,
    modelName: doc.embedding_model,
    dimensions: doc.embedding_dimensions,
  });
  if (doc.ingestion_fingerprint !== expectedFp) {
    fail(`${id}: stored fingerprint differs from recomputed fingerprint`);
  }

  const { data: chunkRows, error: chunkErr } = await db
    .from("chunks")
    .select("chunk_id, content_hash, chunk_type, section, page_start, page_end")
    .eq("document_id", doc.id)
    .order("chunk_index");
  if (chunkErr) {
    fail(`${id}: chunk read failed — ${chunkErr.message}`);
    continue;
  }
  for (let i = 0; i < chunksFixture.length; i++) {
    const fixture = chunksFixture[i]!;
    const row = chunkRows![i];
    if (!row || row.chunk_id !== fixture.chunkId || row.content_hash !== fixture.contentHash) {
      fail(`${id}: chunk ${fixture.chunkId} missing or hash mismatch in DB`);
      break;
    }
    if (
      row.chunk_type !== fixture.chunkType ||
      row.section !== fixture.section ||
      row.page_start !== fixture.pageStart ||
      row.page_end !== fixture.pageEnd
    ) {
      fail(`${id}: chunk ${fixture.chunkId} metadata mismatch`);
      break;
    }
  }

  // Sample one embedding and verify dimensionality (vectors come back as a
  // JSON-style "[...]" string; values themselves are never printed).
  const { data: sample } = await db
    .from("chunks")
    .select("embedding")
    .eq("document_id", doc.id)
    .limit(1)
    .single();
  const dims = JSON.parse((sample as { embedding: string }).embedding).length;
  if (dims !== doc.embedding_dimensions || dims !== 1536) {
    fail(`${id}: sampled embedding has ${dims} dimensions, expected 1536`);
  }

  const { data: runs } = await db
    .from("ingestion_runs")
    .select("status")
    .eq("document_id", id);
  const byStatus = (runs ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  if (!byStatus.completed) fail(`${id}: no completed ingestion run recorded`);
  if (byStatus.running) console.warn(`warn ${id}: ${byStatus.running} stale running run(s)`);

  console.log(
    `ok ${id}: ${counts.pages} pages, ${counts.chunks} chunks, ${dims}-dim ${doc.embedding_provider}/${doc.embedding_model}, ` +
      `runs ${JSON.stringify(byStatus)}`,
  );
}

// No test data may remain.
const { data: testDocs } = await db.from("documents").select("document_id").like("document_id", "test\\_%");
if (testDocs && testDocs.length > 0) {
  fail(`leftover test documents: ${testDocs.map((d) => d.document_id).join(", ")}`);
}

if (failures > 0) {
  console.error(`\n${failures} ingestion validation failure(s).`);
  process.exit(1);
}
console.log("\nAll ingestion validation checks passed.");
