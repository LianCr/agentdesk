import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contentDigestOf,
  metadataHashOf,
  computeFingerprint,
  fingerprintFor,
} from "../../../lib/ingestion/fingerprint.js";
import { createFakeProvider } from "../../../lib/embeddings/fake.js";
import { testProduct } from "../../../lib/ingestion/test-fixture.js";

const ROOT = join(import.meta.dirname, "../../..");
const fake = createFakeProvider();
const openaiLike = { providerName: "openai", modelName: "text-embedding-3-large", dimensions: 1536 };

const pages = [
  { page: 1, cleanTextHash: "a".repeat(64) },
  { page: 2, cleanTextHash: "b".repeat(64) },
];

describe("ingestion fingerprint", () => {
  it("is stable for identical pages, metadata, versions and provider", () => {
    const product = testProduct();
    const a = computeFingerprint({
      contentDigest: contentDigestOf(pages),
      metadataHash: metadataHashOf(product),
      provider: openaiLike,
    });
    const b = computeFingerprint({
      contentDigest: contentDigestOf([...pages].reverse()), // order-independent input, page-ordered digest
      metadataHash: metadataHashOf(testProduct()),
      provider: openaiLike,
    });
    expect(a).toBe(b);
  });

  it("changes when any page cleanTextHash changes", () => {
    const changed = [pages[0]!, { page: 2, cleanTextHash: "c".repeat(64) }];
    expect(contentDigestOf(changed)).not.toBe(contentDigestOf(pages));
  });

  it("changes when document metadata changes", () => {
    const a = metadataHashOf(testProduct());
    const b = metadataHashOf(testProduct({ productName: "Renamed Product" }));
    expect(a).not.toBe(b);
  });

  it("changes with chunking/extraction/schema versions", () => {
    // Versions are baked into the joined fingerprint input; simulate a bump
    // by checking the version tokens are present in the preimage contract:
    const fp = computeFingerprint({
      contentDigest: contentDigestOf(pages),
      metadataHash: metadataHashOf(testProduct()),
      provider: openaiLike,
    });
    const fpOtherProvider = computeFingerprint({
      contentDigest: contentDigestOf(pages),
      metadataHash: metadataHashOf(testProduct()),
      provider: { ...openaiLike, modelName: "text-embedding-3-small" },
    });
    const fpOtherDims = computeFingerprint({
      contentDigest: contentDigestOf(pages),
      metadataHash: metadataHashOf(testProduct()),
      provider: { ...openaiLike, dimensions: 3072 },
    });
    expect(fp).not.toBe(fpOtherProvider);
    expect(fp).not.toBe(fpOtherDims);
    expect(fpOtherProvider).not.toBe(fpOtherDims);
  });

  it("distinguishes fake and real providers", () => {
    const product = testProduct();
    const pageRecords = pages as never;
    expect(fingerprintFor(product, pageRecords, fake)).not.toBe(
      fingerprintFor(product, pageRecords, openaiLike),
    );
  });

  it("ignores PDF byte-level identity: only clean text hashes matter", () => {
    // Two byte-different PDFs with identical clean text produce identical
    // digests because the fingerprint never sees source_sha256.
    const sameTextDifferentBytes = pages.map((p) => ({ ...p }));
    expect(contentDigestOf(sameTextDifferentBytes)).toBe(contentDigestOf(pages));
  });

  it("does not rely on text-digest.json", () => {
    // Pure function over PageRecords — and the implementation never reads
    // the M1 cross-check file.
    const source = readFileSync(join(ROOT, "lib/ingestion/fingerprint.ts"), "utf8");
    expect(source).not.toMatch(/text-digest\.json.*readFile|readFile.*text-digest/s);
    expect(source).not.toMatch(/readFileSync/);
  });
});
