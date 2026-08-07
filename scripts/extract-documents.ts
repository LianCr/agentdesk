import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCatalogSchema, ManifestSchema } from "../lib/schemas";
import { extractStructuredPages } from "../lib/ingestion/extract-pages";
import { buildDocumentRecords } from "../lib/ingestion/chunk-document";
import { computeCoverage, assertFullCoverage } from "../lib/ingestion/coverage";
import { checkManifestConsistency } from "../lib/ingestion/manifest-check";
import {
  DerivedPagesFileSchema,
  DerivedChunksFileSchema,
  ExtractionReportSchema,
  EXTRACTION_VERSION,
  CHUNKING_VERSION,
  type DocumentCoverage,
} from "../lib/ingestion/types";
import { normalizeText } from "../lib/pdf-text";

// M2-A driver: validated PDFs -> deterministic per-document pages/chunks
// fixtures under data/derived/. Offline; no database, no embeddings. The
// derived JSON contains no timestamps so re-running with unchanged inputs is
// byte-identical.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_DIR = join(ROOT, "data/fictional-products/generated");
const DERIVED_DIR = join(ROOT, "data/derived");

const started = Date.now();
const catalog = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);
const manifest = ManifestSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/manifest.json"), "utf8")),
);

mkdirSync(join(DERIVED_DIR, "pages"), { recursive: true });
mkdirSync(join(DERIVED_DIR, "chunks"), { recursive: true });

const coverages: DocumentCoverage[] = [];
let failed = false;

for (const product of catalog.products) {
  try {
    const pdfPath = join(GENERATED_DIR, product.fileName);
    const pdfSha = createHash("sha256").update(readFileSync(pdfPath)).digest("hex");
    checkManifestConsistency(
      product,
      manifest.find((m) => m.documentId === product.documentId),
      pdfSha,
    );

    const structured = await extractStructuredPages(pdfPath);
    const { pageRecords, chunkRecords } = buildDocumentRecords(product, structured);

    // Prove intentional omissions were not introduced by any pipeline step.
    for (const om of product.omissionPatterns) {
      const flags = om.flags ?? "";
      const re = new RegExp(om.pattern, flags.includes("g") ? flags : flags + "g");
      for (const chunk of chunkRecords) {
        const hit = normalizeText(chunk.content).match(re);
        if (hit) {
          throw new Error(
            `${chunk.chunkId}: omission violated (${om.description}) — matched "${hit[0]}"`,
          );
        }
      }
    }

    const coverage = computeCoverage(product.documentId, pageRecords, chunkRecords);
    assertFullCoverage(coverage);
    coverages.push(coverage);

    writeFileSync(
      join(DERIVED_DIR, "pages", `${product.documentId}.pages.json`),
      JSON.stringify(
        DerivedPagesFileSchema.parse({ schemaVersion: 1, documentId: product.documentId, pages: pageRecords }),
        null,
        2,
      ) + "\n",
    );
    writeFileSync(
      join(DERIVED_DIR, "chunks", `${product.documentId}.chunks.json`),
      JSON.stringify(
        DerivedChunksFileSchema.parse({ schemaVersion: 1, documentId: product.documentId, chunks: chunkRecords }),
        null,
        2,
      ) + "\n",
    );

    console.log(
      `ok ${product.documentId}: ${coverage.pages} pages, ${coverage.chunks} chunks ` +
        `(text ${coverage.chunksByType.text} / table ${coverage.chunksByType.table} / ` +
        `disclosure ${coverage.chunksByType.disclosure}), footer chars removed ${coverage.excludedFooterChars}, ` +
        `coverage ${coverage.coveragePercent.toFixed(1)}%`,
    );
  } catch (err) {
    failed = true;
    console.error(`FAIL ${product.documentId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (failed) {
  console.error("Extraction failed; derived output incomplete.");
  process.exit(1);
}

const report = ExtractionReportSchema.parse({
  schemaVersion: 1,
  extractionVersion: EXTRACTION_VERSION,
  chunkingVersion: CHUNKING_VERSION,
  documents: coverages,
  totals: {
    pages: coverages.reduce((s, c) => s + c.pages, 0),
    chunks: coverages.reduce((s, c) => s + c.chunks, 0),
    excludedFooterChars: coverages.reduce((s, c) => s + c.excludedFooterChars, 0),
    unaccountedLines: coverages.reduce((s, c) => s + c.unaccountedLines, 0),
  },
});
writeFileSync(join(DERIVED_DIR, "extraction-report.json"), JSON.stringify(report, null, 2) + "\n");

console.log(
  `\nExtracted ${report.totals.pages} pages -> ${report.totals.chunks} chunks across ` +
    `${coverages.length} documents in ${Date.now() - started}ms. Derived output: data/derived/`,
);
