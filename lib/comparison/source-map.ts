import { normalizeText } from "../pdf-text";
import { buildCitation, citationKey, quoteMatchesChunk, type CitableChunk } from "../citations/build";
import type { Citation } from "../rag/types";
import type { ChunkRecord } from "../ingestion/types";
import type { ProductDefinition } from "../schemas";

// Deterministic evidence mapping: a fact rule names WHERE its evidence should
// be (an anchor page) and WHAT the quote is (a products.json display string);
// this module finds the one chunk that carries it. No LLM, no vector search,
// no similarity — and no arbitrary pick when the answer is genuinely unclear.

export type Anchor =
  | { kind: "factId"; factId: string } // page comes from expectedFactLocations
  | { kind: "tablePage"; path: string } // page comes from facts.<path>.tablePage
  | { kind: "page"; page: number };

export interface EvidenceRequest {
  quote: string;
  anchor: Anchor;
  // Optional narrowing signals, used before specificity and long before any
  // index-based tie-break.
  expectedSectionIncludes?: string;
  expectedChunkType?: ChunkRecord["chunkType"];
}

export type EvidenceOutcome =
  | { ok: true; chunk: ChunkRecord; page: number; candidateCount: number }
  | { ok: false; reason: string; page: number | null; candidateCount: number };

export function resolveAnchorPage(product: ProductDefinition, anchor: Anchor, facts: unknown): number | null {
  if (anchor.kind === "page") return anchor.page;
  if (anchor.kind === "factId") {
    return product.expectedFactLocations.find((l) => l.factId === anchor.factId)?.page ?? null;
  }
  const schedule = anchor.path
    .split(".")
    .reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), facts);
  const page = (schedule as { tablePage?: unknown } | undefined)?.tablePage;
  return typeof page === "number" ? page : null;
}

// Coverage bucket: how much of the chunk the quote accounts for, rounded so
// float noise cannot manufacture a "winner". A quote that fills most of a
// chunk is more specific evidence than the same quote inside a long page-wide
// block.
function coverageBucket(chunk: ChunkRecord, quote: string): number {
  const content = normalizeText(chunk.content).length;
  if (content === 0) return 0;
  return Math.round((normalizeText(quote).length / content) * 20); // 5% buckets
}

/**
 * Rank candidates by strictly ordered signals and require the winner to be
 * strictly better at the first differentiating signal:
 *   1. same document + anchor page + normalized quote containment (hard filter)
 *   2. declared section hint
 *   3. declared chunk type
 *   4. coverage/specificity bucket
 *   5. identical content ⇒ semantically equivalent ⇒ lowest chunkIndex
 * Anything still tied across materially different chunks is AMBIGUOUS_EVIDENCE,
 * never an arbitrary pick.
 */
export function findEvidenceChunk(
  product: ProductDefinition,
  facts: unknown,
  chunks: readonly ChunkRecord[],
  request: EvidenceRequest,
): EvidenceOutcome {
  const page = resolveAnchorPage(product, request.anchor, facts);
  if (page === null) {
    return { ok: false, reason: "ANCHOR_UNRESOLVED", page: null, candidateCount: 0 };
  }

  let candidates = chunks.filter(
    (c) =>
      c.documentId === product.documentId &&
      c.pageStart <= page &&
      c.pageEnd >= page &&
      quoteMatchesChunk(c, request.quote),
  );
  const candidateCount = candidates.length;
  if (candidateCount === 0) {
    return { ok: false, reason: "NO_EVIDENCE_ON_ANCHOR_PAGE", page, candidateCount };
  }
  if (candidateCount === 1) {
    return { ok: true, chunk: candidates[0]!, page, candidateCount };
  }

  const narrow = <T>(list: T[], predicate: (item: T) => boolean): T[] => {
    const kept = list.filter(predicate);
    return kept.length > 0 && kept.length < list.length ? kept : list;
  };

  if (request.expectedSectionIncludes !== undefined) {
    const needle = normalizeText(request.expectedSectionIncludes);
    candidates = narrow(candidates, (c) => normalizeText(c.section).includes(needle));
  }
  if (request.expectedChunkType !== undefined) {
    candidates = narrow(candidates, (c) => c.chunkType === request.expectedChunkType);
  }
  if (candidates.length === 1) {
    return { ok: true, chunk: candidates[0]!, page, candidateCount };
  }

  const best = Math.max(...candidates.map((c) => coverageBucket(c, request.quote)));
  const top = candidates.filter((c) => coverageBucket(c, request.quote) === best);
  if (top.length === 1) {
    return { ok: true, chunk: top[0]!, page, candidateCount };
  }

  // Still tied. Only an exact content match makes the remaining candidates
  // interchangeable; otherwise the source is genuinely ambiguous.
  const contents = new Set(top.map((c) => normalizeText(c.content)));
  if (contents.size === 1) {
    const stable = [...top].sort((a, b) => a.chunkIndex - b.chunkIndex)[0]!;
    return { ok: true, chunk: stable, page, candidateCount };
  }
  return {
    ok: false,
    reason: `AMBIGUOUS_EVIDENCE: ${top.map((c) => c.chunkId).join(", ")}`,
    page,
    candidateCount,
  };
}

// Citation ids are dense and ordered within one fact sheet, so the sequence is
// owned by the caller. The same quote from the same chunk yields one citation.
export class CitationCollector {
  private seq = 0;
  private readonly byKey = new Map<string, Citation>();

  add(chunk: CitableChunk, quote: string): Citation {
    const key = citationKey(chunk.chunkId, quote);
    const existing = this.byKey.get(key);
    if (existing) return existing;
    this.seq += 1;
    const citation = buildCitation(chunk, quote, this.seq);
    this.byKey.set(key, citation);
    return citation;
  }
}
