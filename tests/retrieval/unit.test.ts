import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieve } from "../../lib/retrieval/search.js";
import { detectLanguage, usesDualRoute } from "../../lib/retrieval/language.js";
import { glossaryRewrite, matchedGlossaryTerms, expandEnglishAcronyms } from "../../lib/retrieval/glossary.js";
import type { EmbeddingProvider } from "../../lib/embeddings/provider.js";

const ROOT = join(import.meta.dirname, "../..");

// --- mocks -----------------------------------------------------------------

const matchingProvider: EmbeddingProvider = {
  providerName: "openai",
  modelName: "text-embedding-3-large",
  dimensions: 1536,
  embedMany: async (inputs) => inputs.map(() => Array.from({ length: 1536 }, () => 0)),
};

function row(chunkId: string, similarity: number, documentId = "doc_termplus20_v1") {
  return {
    chunk_id: chunkId, document_id: documentId, document_name: "Demo TermPlus 20 Product Guide",
    product_name: "Demo TermPlus 20", product_category: "term_life", carrier_name: "Demo Mutual Life Insurance Company",
    page_start: 2, page_end: 2, section: "At a Glance", chunk_type: "text",
    content: "The policy does not accumulate cash value.", content_hash: "a".repeat(64), similarity,
  };
}

// rpcResults: one array of rows per successive rpc call.
function mockDb(rpcResults: unknown[][], embeddingMeta = [
  { embedding_provider: "openai", embedding_model: "text-embedding-3-large", embedding_dimensions: 1536 },
]): SupabaseClient {
  let call = 0;
  return {
    from: () => ({
      select: () => ({
        not: async () => ({ data: embeddingMeta, error: null }),
      }),
    }),
    rpc: async () => ({ data: rpcResults[Math.min(call++, rpcResults.length - 1)] ?? [], error: null }),
  } as unknown as SupabaseClient;
}

const deps = (rpcResults: unknown[][], extra: Partial<Parameters<typeof retrieve>[0]> = {}) => ({
  db: mockDb(rpcResults),
  provider: matchingProvider,
  ...extra,
});

// --- language detection ----------------------------------------------------

describe("language detection", () => {
  it("classifies zh, en, mixed and other", () => {
    expect(detectLanguage("定期寿险有现金价值吗？")).toBe("zh");
    expect(detectLanguage("Does TermPlus accumulate cash value?")).toBe("en");
    expect(detectLanguage("IUL 的 cap 是多少？")).toBe("mixed");
    expect(detectLanguage("TermPlus 61岁 premium 是多少？")).toBe("mixed");
    expect(detectLanguage("SecureRate 有 rider 吗？")).toBe("mixed");
    expect(detectLanguage("¿Cuánto es?")).toBe("en"); // latin letters dominate
    expect(detectLanguage("？？？")).toBe("other");
  });

  it("routes zh and mixed through the dual path", () => {
    expect(usesDualRoute("zh")).toBe(true);
    expect(usesDualRoute("mixed")).toBe(true);
    expect(usesDualRoute("en")).toBe(false);
    expect(usesDualRoute("other")).toBe(false);
  });
});

// --- glossary normalization ------------------------------------------------

describe("glossary normalization", () => {
  it("maps Chinese insurance terms to English anchors", () => {
    expect(matchedGlossaryTerms("定期寿险有现金价值吗？")).toEqual([
      "term life insurance",
      "cash value",
    ]);
  });

  it("prefers the longest match (退保费用 over 退保)", () => {
    expect(matchedGlossaryTerms("退保费用是多少")).toEqual(["surrender charge"]);
  });

  it("expands English acronyms and preserves all digits", () => {
    const out = glossaryRewrite("IUL 第 3 年的退保费用是多少？");
    expect(out).toContain("indexed universal life");
    expect(out).toContain("surrender charge");
    expect(out).toContain("3");
    const digitsIn = "IUL 第 3 年的退保费用是多少？".match(/\d/g) ?? [];
    const digitsOut = out!.match(/\d/g) ?? [];
    expect(digitsOut).toEqual(digitsIn); // never adds or drops a number
  });

  it("returns null when nothing normalizes", () => {
    expect(glossaryRewrite("hello world")).toBeNull();
    expect(expandEnglishAcronyms("cash value question")).toBeNull();
    expect(expandEnglishAcronyms("What is the MVA?")).toContain("market value adjustment");
  });
});

// --- request validation (matrix 1-3) ---------------------------------------

describe("request validation", () => {
  it("rejects empty and overlong queries", async () => {
    await expect(retrieve(deps([[]]), { query: "   " })).rejects.toThrow(/EMPTY_QUERY/);
    await expect(retrieve(deps([[]]), { query: "x".repeat(501) })).rejects.toThrow(/QUERY_TOO_LONG/);
  });

  it("enforces topK bounds", async () => {
    await expect(retrieve(deps([[]]), { query: "q", topK: 0 })).rejects.toThrow(/INVALID/);
    await expect(retrieve(deps([[]]), { query: "q", topK: 21 })).rejects.toThrow(/INVALID/);
  });

  it("rejects empty filter arrays and unknown filter fields", async () => {
    await expect(
      retrieve(deps([[]]), { query: "q", filters: { productCategories: [] } }),
    ).rejects.toThrow(/INVALID/);
    await expect(
      retrieve(deps([[]]), {
        query: "q",
        filters: { jurisdiction: "California" } as never,
      }),
    ).rejects.toThrow(/INVALID/);
    await expect(
      retrieve(deps([[]]), { query: "q", filters: { productCategories: ["crypto"] } as never }),
    ).rejects.toThrow(/INVALID/);
  });
});

// --- merge, dedup, ranking (matrix 4-6) ------------------------------------

describe("merge and ranking", () => {
  it("passes through scores and assigns ranks in order", async () => {
    const result = await retrieve(
      deps([[row("doc_termplus20_v1:c001", 0.61), row("doc_termplus20_v1:c004", 0.44)]]),
      { query: "Does TermPlus accumulate cash value?" },
    );
    expect(result.results.map((r) => [r.chunkId, r.similarityScore, r.rank])).toEqual([
      ["doc_termplus20_v1:c001", 0.61, 1],
      ["doc_termplus20_v1:c004", 0.44, 2],
    ]);
  });

  it("dedupes dual-route hits keeping the higher score and both routes", async () => {
    const result = await retrieve(
      deps([
        [row("doc_termplus20_v1:c001", 0.5)],   // original route
        [row("doc_termplus20_v1:c001", 0.62)],  // glossary route
        [row("doc_termplus20_v1:c001", 0.58)],  // rewrite route
      ], { rewrite: async () => "term life cash value" }),
      { query: "定期寿险有现金价值吗？" },
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.similarityScore).toBe(0.62);
    expect(result.results[0]!.matchedQueries).toEqual(["glossary", "original", "rewrite"]);
  });

  it("breaks score ties by chunkId ascending (stable)", async () => {
    const result = await retrieve(
      deps([[row("doc_termplus20_v1:c009", 0.5), row("doc_termplus20_v1:c002", 0.5)]]),
      { query: "premium" },
    );
    expect(result.results.map((r) => r.chunkId)).toEqual([
      "doc_termplus20_v1:c002",
      "doc_termplus20_v1:c009",
    ]);
  });
});

// --- consistency guard and SQL-level exclusions (matrix 7-9) ----------------

describe("safety guards", () => {
  it("rejects provider/model/dimension mismatch (fake vectors can never search real docs)", async () => {
    const fakeProvider: EmbeddingProvider = {
      providerName: "fake-deterministic", modelName: "fake", dimensions: 1536,
      embedMany: async (inputs) => inputs.map(() => Array.from({ length: 1536 }, () => 0)),
    };
    await expect(
      retrieve({ db: mockDb([[]]), provider: fakeProvider }, { query: "q" }),
    ).rejects.toThrow(/EMBEDDING_MODEL_MISMATCH/);
  });

  it("rejects when documents carry multiple embedding configurations", async () => {
    const db = mockDb([[]], [
      { embedding_provider: "openai", embedding_model: "text-embedding-3-large", embedding_dimensions: 1536 },
      { embedding_provider: "openai", embedding_model: "text-embedding-3-small", embedding_dimensions: 1536 },
    ]);
    await expect(retrieve({ db, provider: matchingProvider }, { query: "q" })).rejects.toThrow(
      /EMBEDDING_MODEL_MISMATCH/,
    );
  });

  it("SQL enforces test/fake exclusion, is_current, topK bounds and read-only search", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260806000004_match_chunks.sql"),
      "utf8",
    );
    expect(sql).toMatch(/not like 'test\\_%'/);
    expect(sql).toMatch(/embedding_provider <> 'fake-deterministic'/);
    expect(sql).toMatch(/d\.is_current/);
    expect(sql).toMatch(/MATCH_COUNT_OUT_OF_RANGE/);
    expect(sql).toMatch(/security invoker/);
    expect(sql).toMatch(/set search_path = public, extensions/);
    expect(sql).toMatch(/revoke execute/);
    expect(sql).not.toMatch(/\b(insert|update|delete)\b/i);
  });
});

// --- degradation and identifiers -------------------------------------------

describe("degradation and ids", () => {
  it("falls back to remaining routes when the LLM rewrite fails", async () => {
    const result = await retrieve(
      deps([[row("doc_termplus20_v1:c001", 0.5)], [row("doc_termplus20_v1:c001", 0.52)]], {
        rewrite: async () => null,
      }),
      { query: "定期寿险有现金价值吗？" },
    );
    expect(result.rewriteFailed).toBe(true);
    expect(result.retrievalQueries.map((q) => q.kind)).toEqual(["original", "glossary"]);
  });

  it("uses the injected request-id factory (correlation only)", async () => {
    const result = await retrieve(
      deps([[row("doc_termplus20_v1:c001", 0.5)]], { requestIdFactory: () => "req_test_fixed" }),
      { query: "cash value" },
    );
    expect(result.retrievalId).toBe("req_test_fixed");
  });

  it("english queries stay single-route by default", async () => {
    const result = await retrieve(deps([[row("doc_termplus20_v1:c001", 0.5)]]), {
      query: "Does TermPlus accumulate cash value?",
    });
    expect(result.retrievalQueries).toHaveLength(1);
    expect(result.retrievalQueries[0]!.kind).toBe("original");
  });
});
