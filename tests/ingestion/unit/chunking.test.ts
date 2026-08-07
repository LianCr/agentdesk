import { describe, expect, it } from "vitest";
import {
  buildDocumentRecords,
  isTableLine,
} from "../../../lib/ingestion/chunk-document.js";
import { computeCoverage, assertFullCoverage } from "../../../lib/ingestion/coverage.js";
import { checkManifestConsistency } from "../../../lib/ingestion/manifest-check.js";
import { ChunkRecordSchema, PageRecordSchema } from "../../../lib/ingestion/types.js";
import type { ManifestEntry } from "../../../lib/schemas.js";
import { testProduct, structuredPagesFor } from "../helpers.js";

describe("table line detection", () => {
  it("detects numeric-dense rows and is repeatable", () => {
    const row = "Charge 7% 6% 5% 4% 3% 2% 1% 0%";
    expect(isTableLine(row)).toBe(true);
    expect(isTableLine(row)).toBe(true);
    expect(isTableLine("Issue Age $250,000 $500,000 $1,000,000")).toBe(true);
    expect(isTableLine("30 $13 $21 $36")).toBe(true);
  });

  it("keeps prose with embedded figures and kv facts as text", () => {
    expect(isTableLine("10% of account value per contract year, beginning in year 2.")).toBe(false);
    expect(isTableLine("Issue Ages 18–85")).toBe(false);
    expect(isTableLine("Cap 9.50% current; guaranteed minimum cap 3.00%")).toBe(false);
  });
});

describe("buildDocumentRecords", () => {
  const product = testProduct();

  it("produces schema-valid, deterministic records with stable ids and hashes", () => {
    const a = buildDocumentRecords(product, structuredPagesFor(product));
    const b = buildDocumentRecords(product, structuredPagesFor(product));
    expect(a).toEqual(b);
    for (const p of a.pageRecords) PageRecordSchema.parse(p);
    for (const c of a.chunkRecords) ChunkRecordSchema.parse(c);
    expect(a.chunkRecords.map((c) => c.chunkId)).toEqual(
      a.chunkRecords.map((_, i) => `doc_test_v1:c${String(i).padStart(3, "0")}`),
    );
  });

  it("keeps caption, header row, data rows and note in one table chunk", () => {
    const { chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
    const tables = chunkRecords.filter((c) => c.chunkType === "table");
    expect(tables).toHaveLength(1);
    const t = tables[0]!;
    expect(t.pageStart).toBe(2);
    expect(t.content).toContain("Charge Schedule");
    expect(t.content).toContain("Year 1 2 3");
    expect(t.content).toContain("Charge 7% 6% 5%");
    expect(t.content).toContain("Schedule note");
    expect(t.section).toBe("Charges and Sections > Charge Schedule");
  });

  it("gives cover pages a single text chunk with section Cover", () => {
    const { chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
    const cover = chunkRecords.filter((c) => c.pageStart === 1);
    expect(cover).toHaveLength(1);
    expect(cover[0]!.section).toBe("Cover");
    expect(cover[0]!.chunkType).toBe("text");
    expect(cover[0]!.content).toContain("DEMONSTRATION DOCUMENT");
  });

  it("emits separate disclosure chunks and inherits sections", () => {
    const { chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
    const disclosures = chunkRecords.filter((c) => c.chunkType === "disclosure");
    expect(disclosures).toHaveLength(1);
    expect(disclosures[0]!.content).toContain("not an offer");
    expect(disclosures[0]!.section).toBe("Charges and Sections > Another Section");
    const sections = chunkRecords.map((c) => c.section);
    expect(sections).toContain("Charges and Sections > Another Section");
  });

  it("never crosses documents and stamps uniform metadata", () => {
    const { chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
    expect(new Set(chunkRecords.map((c) => c.documentId))).toEqual(new Set(["doc_test_v1"]));
    expect(new Set(chunkRecords.map((c) => c.carrierId))).toEqual(new Set(["test_carrier"]));
    for (const c of chunkRecords) expect(c.pageEnd).toBe(c.pageStart);
  });

  it("fails when the detected heading does not match the page outline", () => {
    const wrongOutline = testProduct({
      pageOutline: [
        { page: 1, title: "Cover" },
        { page: 2, title: "A Different Title" },
      ],
    });
    expect(() => buildDocumentRecords(wrongOutline, structuredPagesFor(wrongOutline))).toThrow(
      /page outline title/,
    );
  });

  it("fails when declared table pages and detected table chunks disagree", () => {
    const noTableDeclared = testProduct({ facts: {} });
    expect(() =>
      buildDocumentRecords(noTableDeclared, structuredPagesFor(noTableDeclared)),
    ).toThrow(/table chunks/);
  });

  it("fails on truncated-continuation page endings", () => {
    const pages = structuredPagesFor(product);
    const last = pages[1]!.lines;
    // Insert a comma-terminated line just before the footer.
    last.splice(last.length - 1, 0, {
      text: "This sentence stops in the middle,",
      height: 10.5,
      y: 60,
    });
    expect(() => buildDocumentRecords(product, pages)).toThrow(/truncated continuation/);
  });

  it("splits oversized sections at line boundaries with inherited section", () => {
    const longLine =
      "This is a long filler sentence for a synthetic oversized section of the fixture document. ";
    const pages = structuredPagesFor(product);
    const bodyLines = Array.from({ length: 40 }, (_, i) => ({
      text: `${longLine}Sentence number ${i}.`,
      height: 10.5,
      y: 500 - i,
    }));
    pages[1]!.lines.splice(2, 0, ...bodyLines);
    const { chunkRecords } = buildDocumentRecords(product, pages);
    const firstSection = chunkRecords.filter(
      (c) => c.pageStart === 2 && c.section === "Charges and Sections" && c.chunkType === "text",
    );
    expect(firstSection.length).toBeGreaterThan(1);
    for (const c of firstSection) expect(c.content.length).toBeLessThanOrEqual(2100);
  });
});

describe("coverage", () => {
  const product = testProduct();

  it("passes on a faithful partition", () => {
    const { pageRecords, chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
    const cov = computeCoverage(product.documentId, pageRecords, chunkRecords);
    expect(cov.unaccountedLines).toBe(0);
    expect(cov.coveragePercent).toBe(100);
    expect(() => assertFullCoverage(cov)).not.toThrow();
  });

  it("detects lost body text", () => {
    const { pageRecords, chunkRecords } = buildDocumentRecords(product, structuredPagesFor(product));
    const tampered = chunkRecords.map((c) => ({
      ...c,
      content: c.content.split("\n").slice(0, -1).join("\n") || c.content,
    }));
    const cov = computeCoverage(product.documentId, pageRecords, tampered);
    expect(cov.unaccountedLines).toBeGreaterThan(0);
    expect(() => assertFullCoverage(cov)).toThrow(/coverage failure/);
  });
});

describe("manifest consistency", () => {
  const product = testProduct();
  const sha = "a".repeat(64);
  const entry: ManifestEntry = {
    schemaVersion: 1,
    documentId: product.documentId,
    file: product.fileName,
    documentName: product.documentName,
    documentType: "product_brochure",
    carrierId: product.carrier.id,
    carrier: product.carrier.legalName,
    productName: product.productName,
    productCategory: product.productCategory,
    jurisdiction: "California",
    language: "en",
    effectiveDate: product.effectiveDate,
    pages: product.pages,
    isCurrent: true,
    isFictional: true,
    sha256: sha,
  };

  it("accepts a matching manifest entry", () => {
    expect(() => checkManifestConsistency(product, entry, sha)).not.toThrow();
  });

  it("fails on any metadata conflict", () => {
    expect(() =>
      checkManifestConsistency(product, { ...entry, pages: 99 }, sha),
    ).toThrow(/metadata conflict/);
    expect(() => checkManifestConsistency(product, entry, "b".repeat(64))).toThrow(/sha256/);
    expect(() => checkManifestConsistency(product, undefined, sha)).toThrow(/missing manifest/);
  });
});
