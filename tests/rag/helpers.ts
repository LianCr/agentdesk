import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmbeddingProvider } from "../../lib/embeddings/provider.js";
import type { RetrievedChunk } from "../../lib/retrieval/types.js";
import type { ModelDraft } from "../../lib/rag/types.js";

// Shared fixtures for M3-B offline tests. Chunk contents mirror the real
// corpus shape; retrieval is mocked at the db/provider layer (the validators
// under test are always the real implementations).

export function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "doc_termplus20_v1:c001",
    documentId: "doc_termplus20_v1",
    documentName: "Demo TermPlus 20 Product Guide",
    productName: "Demo TermPlus 20",
    productCategory: "term_life",
    carrierName: "Demo Mutual Life Insurance Company",
    pageStart: 2,
    pageEnd: 2,
    section: "At a Glance",
    chunkType: "text",
    content:
      "At a Glance\nProduct Type 20-Year Level Term Life Insurance\nIssue Ages 18–60\nCash Value None. The policy does not accumulate cash value.",
    contentHash: "a".repeat(64),
    similarityScore: 0.61,
    matchedQueries: ["original"],
    rank: 1,
    ...overrides,
  };
}

export function riderChunk(): RetrievedChunk {
  return chunk({
    chunkId: "doc_securerate5_v1:c008",
    documentId: "doc_securerate5_v1",
    documentName: "Demo SecureRate 5 Fixed Annuity Guide",
    productName: "Demo SecureRate 5",
    productCategory: "fixed_annuity",
    pageStart: 5,
    section: "Annuitization Options > Optional Riders",
    content: "Optional Riders\nThis product does not offer optional riders.",
    similarityScore: 0.45,
    rank: 2,
  });
}

export function draft(overrides: Partial<ModelDraft> = {}): ModelDraft {
  return {
    language: "en",
    requestedFacets: [
      { facetId: "f1", description: "whether TermPlus accumulates cash value", required: true, supportedByClaimIds: ["c1"] },
    ],
    sections: [{ heading: null, claimIds: ["c1"], nonFactualText: null }],
    claims: [
      {
        claimId: "c1",
        text: "TermPlus does not accumulate cash value.",
        factual: true,
        evidenceHandles: ["E1"],
        quoteSelections: [{ handle: "E1", quote: "The policy does not accumulate cash value." }],
      },
    ],
    missingInformation: [],
    suggestedNextStep: null,
    ...overrides,
  };
}

// Mock retrieval dependencies: db.rpc returns the provided chunks as
// match_chunks rows; embedding provider matches the active configuration.
export function mockRetrievalDeps(chunks: RetrievedChunk[]) {
  const provider: EmbeddingProvider = {
    providerName: "openai",
    modelName: "text-embedding-3-large",
    dimensions: 1536,
    embedMany: async (inputs) => inputs.map(() => Array.from({ length: 1536 }, () => 0)),
  };
  const rows = chunks.map((c) => ({
    chunk_id: c.chunkId,
    document_id: c.documentId,
    document_name: c.documentName,
    product_name: c.productName,
    product_category: c.productCategory,
    carrier_name: c.carrierName,
    page_start: c.pageStart,
    page_end: c.pageEnd,
    section: c.section,
    chunk_type: c.chunkType,
    content: c.content,
    content_hash: c.contentHash,
    similarity: c.similarityScore,
  }));
  const db = {
    from: () => ({
      select: () => ({
        not: async () => ({
          data: [{ embedding_provider: "openai", embedding_model: "text-embedding-3-large", embedding_dimensions: 1536 }],
          error: null,
        }),
      }),
    }),
    rpc: async () => ({ data: rows, error: null }),
  } as unknown as SupabaseClient;
  return { db, provider, requestIdFactory: () => "req_test" };
}
