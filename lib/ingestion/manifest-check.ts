import type { ManifestEntry, ProductDefinition } from "../schemas.js";

// products.json is the single source of truth for metadata; the manifest is a
// generated cross-check. Any disagreement is a hard failure — there is no
// precedence rule that silently picks one side.

export function checkManifestConsistency(
  product: ProductDefinition,
  entry: ManifestEntry | undefined,
  actualPdfSha256: string,
): void {
  if (!entry) {
    throw new Error(`${product.documentId}: missing manifest entry`);
  }
  const mismatches: string[] = [];
  const expect = (field: string, manifestValue: unknown, productValue: unknown): void => {
    if (manifestValue !== productValue) {
      mismatches.push(`${field}: manifest="${manifestValue}" products.json="${productValue}"`);
    }
  };
  expect("file", entry.file, product.fileName);
  expect("documentName", entry.documentName, product.documentName);
  expect("documentType", entry.documentType, product.documentType);
  expect("carrierId", entry.carrierId, product.carrier.id);
  expect("carrier", entry.carrier, product.carrier.legalName);
  expect("productName", entry.productName, product.productName);
  expect("productCategory", entry.productCategory, product.productCategory);
  expect("jurisdiction", entry.jurisdiction, product.jurisdiction);
  expect("language", entry.language, product.language);
  expect("effectiveDate", entry.effectiveDate, product.effectiveDate);
  expect("pages", entry.pages, product.pages);
  if (entry.sha256 !== actualPdfSha256) {
    mismatches.push(`sha256: manifest=${entry.sha256.slice(0, 12)}… actual=${actualPdfSha256.slice(0, 12)}…`);
  }
  if (mismatches.length > 0) {
    throw new Error(
      `${product.documentId}: metadata conflict between products.json/manifest/PDF — ` +
        mismatches.join("; "),
    );
  }
}
