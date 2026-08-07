import { createHash } from "node:crypto";
import type { ProductDefinition } from "../schemas.js";
import type { EmbeddingProvider } from "../embeddings/provider.js";
import type { PageRecord } from "./types.js";
import { EXTRACTION_VERSION, CHUNKING_VERSION } from "./types.js";

// Ingestion fingerprint. The authoritative content signal is the ordered
// cleanTextHash sequence of the CURRENT M2-A extraction output — semantic
// text, not PDF bytes — so regenerating a byte-different but text-identical
// PDF does not trigger a rebuild, while any wording change does.
// data/fictional-products/generated/text-digest.json is an M1 cross-check
// only and is deliberately not read here.

export const CHUNK_SCHEMA_VERSION = 1;

// Version triple, injectable in tests so fingerprint-driven rebuilds can be
// exercised without editing committed production constants.
export interface FingerprintVersions {
  extraction: number;
  chunking: number;
  chunkSchema: number;
}

export const DEFAULT_FINGERPRINT_VERSIONS: FingerprintVersions = {
  extraction: EXTRACTION_VERSION,
  chunking: CHUNKING_VERSION,
  chunkSchema: CHUNK_SCHEMA_VERSION,
};

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function contentDigestOf(pages: Array<Pick<PageRecord, "page" | "cleanTextHash">>): string {
  const ordered = [...pages].sort((a, b) => a.page - b.page);
  return sha256(ordered.map((p) => `${p.page}:${p.cleanTextHash}`).join("\n"));
}

// Hash of exactly the metadata fields that land in the documents table,
// serialized with a fixed key order.
export function metadataHashOf(product: ProductDefinition): string {
  return sha256(
    JSON.stringify({
      documentId: product.documentId,
      documentName: product.documentName,
      documentType: product.documentType,
      productName: product.productName,
      productCategory: product.productCategory,
      carrierId: product.carrier.id,
      carrierName: product.carrier.legalName,
      jurisdiction: product.jurisdiction,
      language: product.language,
      effectiveDate: product.effectiveDate,
      sourceFile: product.fileName,
      pageCount: product.pages,
      isCurrent: product.isCurrent,
      isFictional: product.isFictional,
    }),
  );
}

export function computeFingerprint(args: {
  contentDigest: string;
  metadataHash: string;
  provider: Pick<EmbeddingProvider, "providerName" | "modelName" | "dimensions">;
  versions?: FingerprintVersions;
}): string {
  const v = args.versions ?? DEFAULT_FINGERPRINT_VERSIONS;
  return sha256(
    [
      args.contentDigest,
      args.metadataHash,
      `extraction:${v.extraction}`,
      `chunking:${v.chunking}`,
      `chunkSchema:${v.chunkSchema}`,
      args.provider.providerName,
      args.provider.modelName,
      String(args.provider.dimensions),
    ].join("|"),
  );
}

export function fingerprintFor(
  product: ProductDefinition,
  pages: PageRecord[],
  provider: Pick<EmbeddingProvider, "providerName" | "modelName" | "dimensions">,
  versions?: FingerprintVersions,
): string {
  return computeFingerprint({
    contentDigest: contentDigestOf(pages),
    metadataHash: metadataHashOf(product),
    provider,
    versions,
  });
}
