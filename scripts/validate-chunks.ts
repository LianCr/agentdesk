import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCatalogSchema } from "../lib/schemas.js";
import { extractStructuredPages } from "../lib/ingestion/extract-pages.js";
import { buildDocumentRecords } from "../lib/ingestion/chunk-document.js";
import { computeCoverage, assertFullCoverage } from "../lib/ingestion/coverage.js";
import {
  DerivedPagesFileSchema,
  DerivedChunksFileSchema,
  ExtractionReportSchema,
} from "../lib/ingestion/types.js";
import { normalizeText } from "../lib/pdf-text.js";
import { DEMO_MARK } from "../data/fictional-products/templates/layout.js";

// Validates the committed data/derived fixtures: schema-valid, byte-for-byte
// reproducible from the PDFs, full line coverage, no footer leakage, no
// intentional omissions. Offline and read-only.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DERIVED_DIR = join(ROOT, "data/derived");

let failures = 0;
const fail = (msg: string): void => {
  failures++;
  console.error(`FAIL: ${msg}`);
};

const catalog = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);

ExtractionReportSchema.parse(JSON.parse(readFileSync(join(DERIVED_DIR, "extraction-report.json"), "utf8")));

for (const product of catalog.products) {
  const id = product.documentId;
  try {
    const pagesFile = DerivedPagesFileSchema.parse(
      JSON.parse(readFileSync(join(DERIVED_DIR, "pages", `${id}.pages.json`), "utf8")),
    );
    const chunksFile = DerivedChunksFileSchema.parse(
      JSON.parse(readFileSync(join(DERIVED_DIR, "chunks", `${id}.chunks.json`), "utf8")),
    );

    // Reproducibility: re-derive from the PDF and compare exactly.
    const structured = await extractStructuredPages(
      join(ROOT, "data/fictional-products/generated", product.fileName),
    );
    const rebuilt = buildDocumentRecords(product, structured);
    // Normalize both sides through the same zod parse so key order (schema
    // definition order) is identical and only real content differences fail.
    const rebuiltPages = DerivedPagesFileSchema.parse({
      schemaVersion: 1,
      documentId: id,
      pages: rebuilt.pageRecords,
    });
    const rebuiltChunks = DerivedChunksFileSchema.parse({
      schemaVersion: 1,
      documentId: id,
      chunks: rebuilt.chunkRecords,
    });
    if (JSON.stringify(rebuiltPages) !== JSON.stringify(pagesFile)) {
      fail(`${id}: committed pages fixture differs from re-derived output`);
    }
    if (JSON.stringify(rebuiltChunks) !== JSON.stringify(chunksFile)) {
      fail(`${id}: committed chunks fixture differs from re-derived output`);
    }

    const coverage = computeCoverage(id, pagesFile.pages, chunksFile.chunks);
    assertFullCoverage(coverage);

    const normalizedFooterMark = normalizeText(DEMO_MARK) + " |";
    for (const chunk of chunksFile.chunks) {
      if (normalizeText(chunk.content).includes(normalizedFooterMark)) {
        fail(`${chunk.chunkId}: footer text leaked into chunk content`);
      }
    }
    for (const om of product.omissionPatterns) {
      const flags = om.flags ?? "";
      const re = new RegExp(om.pattern, flags.includes("g") ? flags : flags + "g");
      for (const chunk of chunksFile.chunks) {
        if (re.test(normalizeText(chunk.content))) {
          fail(`${chunk.chunkId}: intentional omission present (${om.description})`);
        }
      }
    }

    console.log(`ok ${id}: fixtures schema-valid, reproducible, coverage 100%`);
  } catch (err) {
    fail(`${id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} chunk validation failure(s).`);
  process.exit(1);
}
console.log("\nAll chunk validation checks passed.");
