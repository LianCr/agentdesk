import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DerivedChunksFileSchema } from "../ingestion/types";
import { ManifestSchema } from "../schemas";

// What the knowledge base actually contains, for the Knowledge Assistant page.
//
// Every number here is DERIVED, never written down: page counts come from the
// manifest, chunk counts and section names from the committed chunk fixtures,
// and the three totals are sums. If a document were added or re-chunked, this
// would follow automatically -- and a hard-coded "45" would quietly become a
// lie, which is the whole reason it is computed.
//
// This is not a second source of truth. It reads the same two files the
// ingestion path reads, and `npm run validate:ingestion` reconciles those
// files against the database on every regression run.
//
// Deliberately absent: embeddings, vector values, chunk text, chunk ids and
// file hashes. A reader needs to see that real documents were indexed, not to
// inspect the index.

export interface KnowledgeDocument {
  documentId: string;
  productName: string;
  documentName: string;
  productCategory: string;
  carrier: string;
  jurisdiction: string;
  effectiveDate: string;
  pages: number;
  chunks: number;
  /** A few human-readable section names, not the chunks themselves. */
  sections: string[];
  /** The same static path the citation cards link to. */
  pdfUrl: string;
}

export interface KnowledgeSummary {
  documents: KnowledgeDocument[];
  totals: { documents: number; pages: number; chunks: number };
}

const SECTION_PREVIEW_LIMIT = 5;

let cached: KnowledgeSummary | null = null;

export async function loadKnowledgeSummary(): Promise<KnowledgeSummary> {
  if (cached) return cached;
  const root = process.cwd();

  const manifest = ManifestSchema.parse(
    JSON.parse(await readFile(join(root, "data/fictional-products/manifest.json"), "utf8")),
  );

  const documents: KnowledgeDocument[] = [];
  for (const entry of manifest) {
    const { chunks } = DerivedChunksFileSchema.parse(
      JSON.parse(
        await readFile(join(root, `data/derived/chunks/${entry.documentId}.chunks.json`), "utf8"),
      ),
    );
    // Section names in fixture order, deduplicated: the order is how the
    // document reads, which is more useful than alphabetical.
    const sections: string[] = [];
    for (const chunk of chunks) {
      const top = chunk.section.split(" > ")[0]!.trim();
      if (top.length > 0 && !sections.includes(top)) sections.push(top);
    }

    documents.push({
      documentId: entry.documentId,
      productName: entry.productName,
      documentName: entry.documentName,
      productCategory: entry.productCategory,
      carrier: entry.carrier,
      jurisdiction: entry.jurisdiction,
      effectiveDate: entry.effectiveDate,
      pages: entry.pages,
      chunks: chunks.length,
      sections: sections.slice(0, SECTION_PREVIEW_LIMIT),
      pdfUrl: `/documents/${entry.file}`,
    });
  }

  cached = {
    documents,
    totals: {
      documents: documents.length,
      pages: documents.reduce((sum, d) => sum + d.pages, 0),
      chunks: documents.reduce((sum, d) => sum + d.chunks, 0),
    },
  };
  return cached;
}
