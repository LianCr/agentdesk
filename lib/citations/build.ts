import { normalizeText } from "../pdf-text";
import type { Citation } from "../rag/types";

// Shared citation primitives. Both the grounded-answer pipeline (M3) and the
// comparison engine (M4) must agree on exactly two rules, so they live here
// once instead of being reimplemented per feature:
//
//   1. a quote counts as evidence only if it is an exact substring of the
//      chunk after normalization (CLAUDE.md red line 2);
//   2. every citation field except the quote is copied from the chunk — no
//      caller, and certainly no model, supplies documentId / page / chunkId.

// The minimum a chunk must expose to be citable. Both RetrievedChunk (vector
// search) and ChunkRecord (derived fixtures) satisfy this structurally.
export interface CitableChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  productName: string;
  pageStart: number;
  pageEnd: number;
  section: string;
  content: string;
}

// PDF text wraps mid-sentence, so a display string such as "Rates after the
// level period are not shown here" appears in the chunk with a newline in the
// middle. normalizeText collapses whitespace (and folds case, dashes and
// quotes), which is why red line 2 admits a normalized substring.
export function quoteMatchesChunk(chunk: Pick<CitableChunk, "content">, quote: string): boolean {
  return normalizeText(chunk.content).includes(normalizeText(quote));
}

// Stable dedup key: the same quote from the same chunk is one citation.
export function citationKey(chunkId: string, quote: string): string {
  return `${chunkId}::${normalizeText(quote)}`;
}

export function citationId(seq: number): string {
  return `cit_${String(seq).padStart(3, "0")}`;
}

// `seq` is owned by the caller so ids stay dense and ordered within one
// answer or one comparison draft. claimIds start empty and are back-filled by
// the caller that knows what this citation supports.
export function buildCitation(chunk: CitableChunk, quote: string, seq: number): Citation {
  return {
    citationId: citationId(seq),
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    productName: chunk.productName,
    chunkId: chunk.chunkId,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    section: chunk.section,
    quote,
    claimIds: [],
  };
}
