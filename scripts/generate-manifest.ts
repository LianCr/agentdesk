import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductCatalogSchema, ManifestSchema, type ManifestEntry } from "../lib/schemas.js";
import { extractPdf } from "../lib/pdf-text.js";

// Generates data/fictional-products/manifest.json from products.json and the
// generated PDFs. Never hand-maintained. Fails when a declared PDF is missing
// or its actual page count differs from the declared page count.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = join(ROOT, "data/fictional-products");
const GENERATED_DIR = join(PRODUCTS_DIR, "generated");

const catalog = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(PRODUCTS_DIR, "products.json"), "utf8")),
);

const entries: ManifestEntry[] = [];
let failures = 0;

for (const product of catalog.products) {
  const pdfPath = join(GENERATED_DIR, product.fileName);
  if (!existsSync(pdfPath)) {
    console.error(`FAIL ${product.documentId}: PDF not found at ${pdfPath}`);
    failures++;
    continue;
  }
  const bytes = readFileSync(pdfPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { numPages } = await extractPdf(pdfPath);
  if (numPages !== product.pages) {
    console.error(
      `FAIL ${product.documentId}: actual page count ${numPages} != declared ${product.pages}`,
    );
    failures++;
    continue;
  }
  entries.push({
    schemaVersion: 1,
    documentId: product.documentId,
    file: product.fileName,
    documentName: product.documentName,
    documentType: product.documentType,
    carrierId: product.carrier.id,
    carrier: product.carrier.legalName,
    productName: product.productName,
    productCategory: product.productCategory,
    jurisdiction: product.jurisdiction,
    language: product.language,
    effectiveDate: product.effectiveDate,
    pages: product.pages,
    isCurrent: product.isCurrent,
    isFictional: product.isFictional,
    sha256,
  });
  console.log(`ok ${product.documentId}: ${numPages} pages, sha256 ${sha256.slice(0, 12)}…`);
}

if (failures > 0) {
  console.error(`Manifest generation failed with ${failures} error(s); manifest not written.`);
  process.exit(1);
}

const manifest = ManifestSchema.parse(entries);
writeFileSync(join(PRODUCTS_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote manifest.json with ${manifest.length} entries.`);
