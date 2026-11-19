import type { ChunkRecord } from "../ingestion/types";
import { glossaryRewrite } from "../retrieval/glossary";

// Offline keyword search over the committed, frozen chunks (3 documents /
// 45 chunks). Used by the MCP server, which must run with no database and no
// API key.
//
// This is deliberately NOT the production retrieval. The web app embeds the
// question and searches pgvector (multi-route, calibrated thresholds). This is
// BM25 over lowercase English tokens, with Chinese questions mapped to English
// insurance terms by the same deterministic glossary the production pipeline
// uses. It returns verbatim chunk text and page numbers, so anything a client
// quotes can be checked against the PDF.

/**
 * The fields search actually reads. Structural, so the support help-center
 * passages (lib/support/kb.ts) can share the same index without pretending to
 * be ingested chunks.
 */
export type SearchableChunk = Pick<
  ChunkRecord,
  "chunkId" | "documentId" | "documentName" | "productName" | "pageStart" | "pageEnd" | "section" | "content"
>;

export type SearchHit = {
  chunkId: string;
  documentId: string;
  documentName: string;
  productName: string;
  pageStart: number;
  pageEnd: number;
  section: string | null;
  score: number;
  matchedTerms: string[];
  excerpt: string;
};

export type SearchResult = {
  query: string;
  /** The English terms actually searched (after glossary expansion). */
  searchedTerms: string[];
  hits: SearchHit[];
};

const STOPWORDS = new Set(
  "a an and are as at be by can do does for from has have how i if in is it its me my of on or the this to was what when which who why will with you your".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:[.%][0-9]+)?%?/g) ?? []).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t),
  );
}

type Indexed = { chunk: SearchableChunk; tokens: string[]; tf: Map<string, number> };

export type LexicalIndex = {
  docs: Indexed[];
  df: Map<string, number>;
  avgLength: number;
};

export function buildLexicalIndex(chunks: readonly SearchableChunk[]): LexicalIndex {
  const docs = chunks.map((chunk) => {
    const tokens = tokenize(`${chunk.section ?? ""} ${chunk.content}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { chunk, tokens, tf };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLength = docs.reduce((sum, d) => sum + d.tokens.length, 0) / Math.max(1, docs.length);
  return { docs, df, avgLength };
}

const K1 = 1.2;
const B = 0.75;

function excerptAround(content: string, terms: string[], width = 240): string {
  const lower = content.toLowerCase();
  const positions = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0);
  const center = positions.length > 0 ? Math.min(...positions) : 0;
  const start = Math.max(0, center - Math.floor(width / 3));
  const end = Math.min(content.length, start + width);
  return `${start > 0 ? "…" : ""}${content.slice(start, end).replace(/\s+/g, " ").trim()}${end < content.length ? "…" : ""}`;
}

export function searchChunks(
  index: LexicalIndex,
  query: string,
  options: { documentId?: string; limit?: number } = {},
): SearchResult {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
  const expanded = glossaryRewrite(query) ?? query;
  const searchedTerms = [...new Set(tokenize(expanded))];
  const n = index.docs.length;

  const hits: SearchHit[] = [];
  for (const d of index.docs) {
    if (options.documentId && d.chunk.documentId !== options.documentId) continue;
    let score = 0;
    const matched: string[] = [];
    for (const term of searchedTerms) {
      const f = d.tf.get(term);
      if (!f) continue;
      matched.push(term);
      const df = index.df.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.tokens.length) / index.avgLength));
    }
    if (score <= 0) continue;
    hits.push({
      chunkId: d.chunk.chunkId,
      documentId: d.chunk.documentId,
      documentName: d.chunk.documentName,
      productName: d.chunk.productName,
      pageStart: d.chunk.pageStart,
      pageEnd: d.chunk.pageEnd,
      section: d.chunk.section ?? null,
      score: Math.round(score * 1000) / 1000,
      matchedTerms: matched,
      excerpt: excerptAround(d.chunk.content, matched),
    });
  }
  hits.sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId));
  return { query, searchedTerms, hits: hits.slice(0, limit) };
}
