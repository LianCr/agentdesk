import { z } from "zod";
import { ProductCategorySchema } from "../schemas";

// M3-A retrieval contracts. Filters are whitelisted enums/ids passed to the
// match_chunks RPC as typed array parameters — never interpolated into SQL.
// Empty filter arrays are rejected outright (neither "match nothing" nor
// "no filter" — the ambiguity is removed at the contract boundary).

export const QueryLanguageSchema = z.enum(["zh", "en", "mixed"]);
export const DetectedLanguageSchema = z.enum(["zh", "en", "mixed", "other"]);

export const RetrievalFiltersSchema = z
  .object({
    documentIds: z.array(z.string().regex(/^doc_[a-z0-9_]+$/)).min(1).optional(),
    productCategories: z.array(ProductCategorySchema).min(1).optional(),
    carrierIds: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(1).optional(),
  })
  .strict();
export type RetrievalFilters = z.infer<typeof RetrievalFiltersSchema>;

export const DEFAULT_TOP_K = 8;
export const MAX_TOP_K = 20;

export const RetrievalRequestSchema = z
  .object({
    query: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "EMPTY_QUERY").max(500, "QUERY_TOO_LONG")),
    queryLanguage: DetectedLanguageSchema.exclude(["other"]).optional(),
    filters: RetrievalFiltersSchema.optional(),
    topK: z.number().int().min(1).max(MAX_TOP_K).default(DEFAULT_TOP_K),
  })
  .strict();
export type RetrievalRequest = z.input<typeof RetrievalRequestSchema>;
export type ParsedRetrievalRequest = z.output<typeof RetrievalRequestSchema>;

// original: the user's query verbatim
// glossary: deterministic insurance-term normalization (baseline B)
// rewrite:  GPT-5-mini English retrieval rewrite (baseline C)
export const RetrievalQueryKindSchema = z.enum(["original", "glossary", "rewrite"]);
export type RetrievalQueryKind = z.infer<typeof RetrievalQueryKindSchema>;

// English retrieval rewrite (baseline C). Returns null on any failure so the
// caller degrades to the remaining routes.
export type RewriteFn = (query: string) => Promise<string | null>;

export const RetrievedChunkSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  documentName: z.string(),
  productName: z.string(),
  productCategory: ProductCategorySchema,
  carrierName: z.string(),
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1),
  section: z.string(),
  chunkType: z.enum(["text", "table", "disclosure"]),
  content: z.string(), // full chunk content — the answer stage needs it verbatim
  contentHash: z.string(),
  similarityScore: z.number(), // 1 - cosine distance; log/eval only, never shown as model confidence
  matchedQueries: z.array(RetrievalQueryKindSchema).min(1),
  rank: z.number().int().min(1),
});
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;

export const RetrievalResultSchema = z.object({
  retrievalId: z.string(), // request-correlation id only (UUID-based) — not a deterministic retrieval identity
  originalQuery: z.string(),
  detectedLanguage: DetectedLanguageSchema,
  rewriteFailed: z.boolean(),
  retrievalQueries: z
    .array(
      z.object({
        kind: RetrievalQueryKindSchema,
        text: z.string(),
        language: QueryLanguageSchema,
      }),
    )
    .min(1),
  results: z.array(RetrievedChunkSchema),
});
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;
