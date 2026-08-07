import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCatalogSchema, ManifestSchema } from "../lib/schemas.js";
import { DerivedPagesFileSchema, DerivedChunksFileSchema } from "../lib/ingestion/types.js";
import { fingerprintFor } from "../lib/ingestion/fingerprint.js";
import { createServiceClient } from "../lib/supabase/server.js";
import { documentRowCounts, detectStaleRuns, STALE_RUN_THRESHOLD_MINUTES } from "../lib/supabase/repository.js";

// Read-only M2 reconciliation of the database against products.json,
// manifest.json and the committed M2-A fixtures. Never mutates data.
// Exit 1 on any failure; stale running runs are reported separately.

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
const manifest = ManifestSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/manifest.json"), "utf8")),
);

const uuidToBusiness = new Map<string, string>();

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
    .select("*")
    .eq("document_id", id)
    .maybeSingle();
  if (error || !doc) {
    fail(`${id}: ${error ? `read failed — ${error.message}` : "no active document row"}`);
    continue;
  }
  uuidToBusiness.set(doc.id, id);

  // Metadata must match products.json exactly (typed columns).
  const expectMeta: Array<[string, unknown, unknown]> = [
    ["document_name", doc.document_name, product.documentName],
    ["document_type", doc.document_type, product.documentType],
    ["product_name", doc.product_name, product.productName],
    ["product_category", doc.product_category, product.productCategory],
    ["carrier_id", doc.carrier_id, product.carrier.id],
    ["carrier_name", doc.carrier_name, product.carrier.legalName],
    ["jurisdiction", doc.jurisdiction, product.jurisdiction],
    ["language", doc.language, product.language],
    ["effective_date", doc.effective_date, product.effectiveDate],
    ["source_file", doc.source_file, product.fileName],
    ["page_count", doc.page_count, product.pages],
    ["is_current", doc.is_current, product.isCurrent],
    ["is_fictional", doc.is_fictional, product.isFictional],
  ];
  for (const [field, got, want] of expectMeta) {
    if (got !== want) fail(`${id}: metadata ${field} = "${got}" != products.json "${want}"`);
  }
  const manifestEntry = manifest.find((m) => m.documentId === id);
  if (!manifestEntry) fail(`${id}: missing manifest entry`);
  else if (manifestEntry.sha256 !== doc.source_sha256) {
    console.warn(
      `warn ${id}: stored source_sha256 differs from current manifest (byte-level PDF drift; ` +
        `semantic fingerprint governs rebuilds)`,
    );
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

  // Page hashes must match the fixtures.
  const { data: pageRows } = await db
    .from("document_pages")
    .select("page_number, clean_text_hash")
    .eq("document_id", doc.id)
    .order("page_number");
  pagesFixture.forEach((p, i) => {
    const row = pageRows?.[i];
    if (!row || row.page_number !== p.page || row.clean_text_hash !== p.cleanTextHash) {
      fail(`${id}: page ${p.page} missing or clean_text_hash mismatch`);
    }
  });

  const expectedFp = fingerprintFor(product, pagesFixture, {
    providerName: doc.embedding_provider,
    modelName: doc.embedding_model,
    dimensions: doc.embedding_dimensions,
  });
  if (doc.ingestion_fingerprint !== expectedFp) {
    fail(`${id}: stored fingerprint differs from recomputed fingerprint`);
  }

  // Chunk identity, bounds, sections, types, hashes — and EVERY embedding
  // must be a non-null 1536-dimensional vector (values never printed).
  const { data: chunkRows, error: chunkErr } = await db
    .from("chunks")
    .select("chunk_id, content_hash, chunk_type, section, page_start, page_end, embedding")
    .eq("document_id", doc.id)
    .order("chunk_index");
  if (chunkErr) {
    fail(`${id}: chunk read failed — ${chunkErr.message}`);
    continue;
  }
  chunksFixture.forEach((fixture, i) => {
    const row = chunkRows![i];
    if (!row || row.chunk_id !== fixture.chunkId || row.content_hash !== fixture.contentHash) {
      fail(`${id}: chunk ${fixture.chunkId} missing or hash mismatch`);
      return;
    }
    if (
      row.chunk_type !== fixture.chunkType ||
      row.section !== fixture.section ||
      row.page_start !== fixture.pageStart ||
      row.page_end !== fixture.pageEnd
    ) {
      fail(`${id}: chunk ${fixture.chunkId} metadata mismatch`);
    }
    if (!fixture.chunkId.startsWith(`${id}:`)) {
      fail(`${id}: chunk ${fixture.chunkId} attached to the wrong document`);
    }
    const dims = row.embedding ? JSON.parse(row.embedding as unknown as string).length : 0;
    if (dims !== 1536) fail(`${id}: chunk ${fixture.chunkId} embedding has ${dims} dims`);
  });

  console.log(
    `ok ${id}: metadata, ${counts.pages} pages, ${counts.chunks} chunks, all embeddings 1536-dim ` +
      `${doc.embedding_provider}/${doc.embedding_model}, fingerprint verified`,
  );
}

// ---- Global reconciliation -------------------------------------------------

const nonTestCounts: Record<string, number> = {};
for (const [table, expected] of [
  ["documents", 3],
  ["document_pages", 20],
  ["chunks", 45],
] as const) {
  let count: number | null;
  if (table === "documents") {
    ({ count } = await db
      .from(table).select("*", { count: "exact", head: true })
      .not("document_id", "like", "test\\_%"));
  } else {
    // Pages/chunks reference documents by uuid; subtract rows under test docs.
    const { data: testDocs } = await db.from("documents").select("id").like("document_id", "test\\_%");
    const testIds = (testDocs ?? []).map((d) => d.id);
    const q = db.from(table).select("*", { count: "exact", head: true });
    ({ count } = testIds.length > 0 ? await q.not("document_id", "in", `(${testIds.join(",")})`) : await q);
  }
  nonTestCounts[table] = count ?? -1;
  if (count !== expected) fail(`global: ${table} non-test count ${count} != expected ${expected}`);
}

const { count: activeTestDocs } = await db
  .from("documents").select("*", { count: "exact", head: true }).like("document_id", "test\\_%");
if ((activeTestDocs ?? 0) > 0) fail(`global: ${activeTestDocs} active test_ document(s) remain`);

// Orphans: pages/chunks whose document uuid has no documents row. FK
// constraints make this impossible unless the schema drifted — verify anyway.
const { data: allDocs } = await db.from("documents").select("id");
const known = new Set((allDocs ?? []).map((d) => d.id));
for (const table of ["document_pages", "chunks"] as const) {
  const { data: rows } = await db.from(table).select("document_id");
  const orphans = (rows ?? []).filter((r) => !known.has(r.document_id)).length;
  if (orphans > 0) fail(`global: ${orphans} orphan ${table} row(s)`);
}

// Run summary and stale-run report (report-only, never blocks).
const { data: allRuns } = await db.from("ingestion_runs").select("status");
const runSummary = (allRuns ?? []).reduce<Record<string, number>>((acc, r) => {
  acc[r.status] = (acc[r.status] ?? 0) + 1;
  return acc;
}, {});
console.log(`run summary: ${JSON.stringify(runSummary)}`);

const stale = await detectStaleRuns(db);
if (stale.length > 0) {
  console.warn(`stale running runs (> ${STALE_RUN_THRESHOLD_MINUTES} min): ${stale.length}`);
  for (const r of stale) {
    console.warn(`  run ${r.id} document ${r.document_id} age ${r.ageMinutes} min`);
  }
} else {
  console.log("stale running runs: none");
}

console.log(
  `non-test totals: documents ${nonTestCounts.documents}, pages ${nonTestCounts.document_pages}, chunks ${nonTestCounts.chunks}`,
);

if (failures > 0) {
  console.error(`\n${failures} ingestion validation failure(s).`);
  process.exit(1);
}
console.log("\nAll ingestion validation checks passed.");
