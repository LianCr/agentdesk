import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmbeddingProvider } from "../embeddings/provider.js";
import { validateEmbeddings } from "../embeddings/provider.js";
import { detectLanguage, usesDualRoute } from "./language.js";
import { routesFor } from "./thresholds.js";
import { glossaryRewrite } from "./glossary.js";
import type { RewriteFn } from "./types.js";
import {
  RetrievalRequestSchema,
  type RetrievalQueryKind,
  type RetrievalRequest,
  type RetrievalResult,
  type RetrievedChunk,
} from "./types.js";

// Multi-route retrieval orchestrator. zh/mixed questions take the dual-route
// path (original + an English route); en questions stay single-route.
// Which English route runs in production (glossary vs LLM rewrite) is set in
// thresholds.ts from measured calibration results — calibration itself calls
// this function with explicit `routes` to compare baselines A/B/C.
// All reads go through the match_chunks RPC with typed parameters; the
// pipeline performs no database writes.

export interface RetrievalDeps {
  db: SupabaseClient;
  provider: EmbeddingProvider;
  rewrite?: RewriteFn; // GPT-5-mini rewrite; absent => "rewrite" route degrades
  requestIdFactory?: () => string; // injectable for tests; correlation only
}

export interface RetrieveOptions {
  // Explicit route selection (calibration). Default: production policy —
  // original always; plus the configured English route for zh/mixed.
  routes?: RetrievalQueryKind[];
}

interface MatchRow {
  chunk_id: string;
  document_id: string;
  document_name: string;
  product_name: string;
  product_category: RetrievedChunk["productCategory"];
  carrier_name: string;
  page_start: number;
  page_end: number;
  section: string;
  chunk_type: RetrievedChunk["chunkType"];
  content: string;
  content_hash: string;
  similarity: number;
}

// The query embedding must come from the same provider/model/dimensions the
// active documents were embedded with — fake vectors and mismatched models
// are rejected before any search.
async function assertEmbeddingConsistency(
  db: SupabaseClient,
  provider: EmbeddingProvider,
): Promise<void> {
  const { data, error } = await db
    .from("documents")
    .select("embedding_provider, embedding_model, embedding_dimensions")
    .not("document_id", "like", "test\\_%");
  if (error) throw new Error(`DB_READ_FAILED: ${error.message}`);
  const combos = new Set(
    (data ?? []).map((d) => `${d.embedding_provider}/${d.embedding_model}/${d.embedding_dimensions}`),
  );
  if (combos.size !== 1) {
    throw new Error(`EMBEDDING_MODEL_MISMATCH: documents carry ${combos.size} embedding configurations`);
  }
  const active = [...combos][0]!;
  const mine = `${provider.providerName}/${provider.modelName}/${provider.dimensions}`;
  if (active !== mine) {
    throw new Error(`EMBEDDING_MODEL_MISMATCH: query provider ${mine} != active documents ${active}`);
  }
}

async function matchChunks(
  db: SupabaseClient,
  vector: number[],
  topK: number,
  filters: { documentIds?: string[]; productCategories?: string[]; carrierIds?: string[] },
): Promise<MatchRow[]> {
  const { data, error } = await db.rpc("match_chunks", {
    query_embedding: vector,
    match_count: topK,
    filter_document_ids: filters.documentIds ?? null,
    filter_categories: filters.productCategories ?? null,
    filter_carrier_ids: filters.carrierIds ?? null,
  });
  if (error) throw new Error(`RETRIEVAL_FAILED: ${error.message}`);
  return data as MatchRow[];
}


export async function retrieve(
  deps: RetrievalDeps,
  request: RetrievalRequest,
  options: RetrieveOptions = {},
): Promise<RetrievalResult> {
  const parsed = RetrievalRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error(`INVALID_RETRIEVAL_REQUEST: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  }
  const { query, topK, filters = {} } = parsed.data;
  const detectedLanguage = parsed.data.queryLanguage ?? detectLanguage(query);
  const dual = usesDualRoute(detectedLanguage);
  // Route policy locked from calibration (thresholds.ts); calibration itself
  // passes explicit routes to compare baselines.
  const routes = options.routes ?? routesFor(detectedLanguage);

  await assertEmbeddingConsistency(deps.db, deps.provider);

  const originalLanguage = detectedLanguage === "en" || detectedLanguage === "other" ? "en" : detectedLanguage;
  const queries: Array<{ kind: RetrievalQueryKind; text: string; language: "zh" | "en" | "mixed" }> = [];
  let rewriteFailed = false;

  if (routes.includes("original")) {
    queries.push({ kind: "original", text: query, language: originalLanguage });
  }
  if (routes.includes("glossary")) {
    const normalized = glossaryRewrite(query);
    if (normalized) queries.push({ kind: "glossary", text: normalized, language: "mixed" });
  }
  if (routes.includes("rewrite") && dual) {
    const rewritten = deps.rewrite ? await deps.rewrite(query) : null;
    if (rewritten) queries.push({ kind: "rewrite", text: rewritten, language: "en" });
    else rewriteFailed = true;
  }
  if (queries.length === 0) {
    throw new Error("INVALID_RETRIEVAL_REQUEST: no retrieval routes produced a query");
  }

  const vectors = await deps.provider.embedMany(queries.map((q) => q.text));
  validateEmbeddings(deps.provider, queries.length, vectors);

  const perQuery = await Promise.all(
    queries.map((q, i) => matchChunks(deps.db, vectors[i]!, topK, filters)),
  );

  // Merge by chunkId, keep the higher score (CLAUDE.md §7), remember routes.
  const merged = new Map<string, { row: MatchRow; score: number; matched: Set<RetrievalQueryKind> }>();
  perQuery.forEach((rows, i) => {
    const kind = queries[i]!.kind;
    for (const row of rows) {
      const existing = merged.get(row.chunk_id);
      if (!existing) {
        merged.set(row.chunk_id, { row, score: row.similarity, matched: new Set([kind]) });
      } else {
        existing.score = Math.max(existing.score, row.similarity);
        existing.matched.add(kind);
      }
    }
  });

  const results: RetrievedChunk[] = [...merged.values()]
    .sort((a, b) => b.score - a.score || a.row.chunk_id.localeCompare(b.row.chunk_id))
    .slice(0, topK)
    .map((entry, i) => ({
      chunkId: entry.row.chunk_id,
      documentId: entry.row.document_id,
      documentName: entry.row.document_name,
      productName: entry.row.product_name,
      productCategory: entry.row.product_category,
      carrierName: entry.row.carrier_name,
      pageStart: entry.row.page_start,
      pageEnd: entry.row.page_end,
      section: entry.row.section,
      chunkType: entry.row.chunk_type,
      content: entry.row.content,
      contentHash: entry.row.content_hash,
      similarityScore: entry.score,
      matchedQueries: [...entry.matched].sort(),
      rank: i + 1,
    }));

  const makeId = deps.requestIdFactory ?? (() => `req_${randomUUID().slice(0, 12)}`);
  return {
    retrievalId: makeId(),
    originalQuery: query,
    detectedLanguage,
    rewriteFailed,
    retrievalQueries: queries,
    results,
  };
}
