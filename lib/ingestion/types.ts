import { z } from "zod";
import { ProductCategorySchema } from "../schemas";

// M2-A data contracts. Pages are the first, never-lossy boundary; chunks are
// an ordered partition of each page's clean lines. All metadata comes from
// products.json (manifest is a cross-check only — a mismatch is a hard fail).

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Shared document-level metadata copied onto every page and chunk record so
// each derived file is self-describing and no downstream step can mix
// products. Single source: products.json.
export const SourceMetadataSchema = z.object({
  documentId: z.string().min(1),
  documentName: z.string().min(1),
  productName: z.string().min(1),
  productCategory: ProductCategorySchema,
  carrierId: z.string().min(1),
  carrierName: z.string().min(1),
  jurisdiction: z.literal("California"),
  effectiveDate: IsoDateSchema,
  sourceFile: z.string().min(1),
});
export type SourceMetadata = z.infer<typeof SourceMetadataSchema>;

export const PageRecordSchema = SourceMetadataSchema.extend({
  schemaVersion: z.literal(1),
  page: z.number().int().min(1), // 1-based; equals the physical PDF page (future #page=N)
  rawText: z.string().min(1),
  cleanText: z.string().min(1), // footer removed, whitespace normalized; empty page = pipeline failure
  detectedHeading: z.string().nullable(), // page h2; null only on the cover
  hasTable: z.boolean(),
  hasDisclosure: z.boolean(),
  rawTextHash: Sha256Schema,
  cleanTextHash: Sha256Schema,
  excludedText: z.array(z.string().min(1)), // removed footer lines — the audit trail for coverage
});
export type PageRecord = z.infer<typeof PageRecordSchema>;

export const ChunkTypeSchema = z.enum(["text", "table", "disclosure"]);
export type ChunkType = z.infer<typeof ChunkTypeSchema>;

export const ChunkRecordSchema = SourceMetadataSchema.extend({
  schemaVersion: z.literal(1),
  // `${documentId}:c${index padded}`; doc_* for real documents, test_* for
  // test fixtures (the only ids integration cleanup may touch).
  chunkId: z.string().regex(/^(?:doc|test)_[a-z0-9_]+:c\d{3}$/),
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1), // schema allows ranges; M2 policy keeps pageEnd === pageStart
  section: z.string().min(1),
  chunkIndex: z.number().int().min(0),
  chunkType: ChunkTypeSchema,
  content: z.string().min(1), // verbatim clean lines joined with \n — never rewritten
  contentHash: Sha256Schema,
  sourcePageHashes: z.array(Sha256Schema).min(1), // fixture-only; DB joins document_pages instead
});
export type ChunkRecord = z.infer<typeof ChunkRecordSchema>;

export const DerivedPagesFileSchema = z.object({
  schemaVersion: z.literal(1),
  documentId: z.string().min(1),
  pages: z.array(PageRecordSchema).min(1),
});
export type DerivedPagesFile = z.infer<typeof DerivedPagesFileSchema>;

export const DerivedChunksFileSchema = z.object({
  schemaVersion: z.literal(1),
  documentId: z.string().min(1),
  chunks: z.array(ChunkRecordSchema).min(1),
});
export type DerivedChunksFile = z.infer<typeof DerivedChunksFileSchema>;

export const DocumentCoverageSchema = z.object({
  documentId: z.string().min(1),
  pages: z.number().int().min(1),
  chunks: z.number().int().min(1),
  chunksByType: z.object({
    text: z.number().int().min(0),
    table: z.number().int().min(0),
    disclosure: z.number().int().min(0),
  }),
  rawChars: z.number().int().min(0),
  excludedFooterChars: z.number().int().min(0),
  cleanChars: z.number().int().min(0),
  chunkChars: z.number().int().min(0),
  unaccountedLines: z.number().int(), // must be 0 — the line-partition invariant
  coveragePercent: z.number(), // must be 100
});
export type DocumentCoverage = z.infer<typeof DocumentCoverageSchema>;

export const ExtractionReportSchema = z.object({
  schemaVersion: z.literal(1),
  extractionVersion: z.number().int().min(1),
  chunkingVersion: z.number().int().min(1),
  documents: z.array(DocumentCoverageSchema).min(1),
  totals: z.object({
    pages: z.number().int(),
    chunks: z.number().int(),
    excludedFooterChars: z.number().int(),
    unaccountedLines: z.number().int(),
  }),
});
export type ExtractionReport = z.infer<typeof ExtractionReportSchema>;

// Bumping these forces re-ingestion downstream (they enter the M2-D
// fingerprint). Bump whenever extraction or chunking behavior changes.
export const EXTRACTION_VERSION = 1;
export const CHUNKING_VERSION = 1;
