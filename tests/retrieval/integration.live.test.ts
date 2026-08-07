import { beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "../../lib/supabase/server.js";
import { createOpenAiProvider } from "../../lib/embeddings/openai.js";
import { createAnswerModel } from "../../lib/ai/client.js";
import { createRewriter } from "../../lib/retrieval/rewrite.js";
import { retrieve, type RetrievalDeps } from "../../lib/retrieval/search.js";
import { LOW_RELEVANCE_TOP } from "../../lib/retrieval/thresholds.js";
import type { RewriteFn } from "../../lib/retrieval/types.js";

// Live retrieval integration (matrix 10-17) and live rewrite behavior
// (18-21) against the real database and embedding API. Read-only.

let deps: RetrievalDeps;
let rewrite: RewriteFn;

beforeAll(() => {
  rewrite = createRewriter(createAnswerModel());
  deps = {
    db: createServiceClient(),
    provider: createOpenAiProvider(process.env.OPENAI_API_KEY),
    rewrite,
  };
});

describe("live retrieval", () => {
  it("10/13: English TermPlus cash-value question recalls the negative fact first", async () => {
    const r = await retrieve(deps, { query: "Does TermPlus 20 accumulate cash value?" });
    expect(r.results[0]!.documentId).toBe("doc_termplus20_v1");
    const top3 = r.results.slice(0, 3).map((x) => x.content).join(" ");
    expect(top3).toContain("does not accumulate cash value");
  });

  it("11: Chinese question recalls English chunks", async () => {
    const r = await retrieve(deps, { query: "定期寿险有现金价值吗？" });
    expect(r.detectedLanguage).toBe("zh");
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results[0]!.documentId).toBe("doc_termplus20_v1");
    expect(/\p{Script=Han}/u.test(r.results[0]!.content)).toBe(false); // English source text
  });

  it("12: explicit product filter never leaks other products", async () => {
    const r = await retrieve(deps, {
      query: "surrender charge",
      filters: { productCategories: ["fixed_annuity"] },
    });
    expect(r.results.length).toBeGreaterThan(0);
    for (const chunk of r.results) expect(chunk.documentId).toBe("doc_securerate5_v1");
  });

  it("14: SecureRate rider question surfaces the explicit negative statement", async () => {
    const r = await retrieve(deps, { query: "SecureRate 有 rider 吗？" });
    expect(r.detectedLanguage).toBe("mixed");
    const top3 = r.results.slice(0, 3).map((x) => x.content).join(" ");
    expect(top3).toContain("does not offer optional riders");
  });

  it("15: IUL cap question keeps current and guaranteed values in one chunk", async () => {
    const r = await retrieve(deps, { query: "IUL 的当前 cap 和保证最低 cap 是多少？" });
    const hit = r.results.slice(0, 3).find((x) => x.content.includes("9.50%"));
    expect(hit).toBeDefined();
    expect(hit!.content).toContain("3.00%");
  });

  it("16: 5-year guarantee and 7-year surrender chunks are both retrievable", async () => {
    const r = await retrieve(deps, {
      query: "SecureRate rate guarantee period and surrender charge period",
    });
    const ids = r.results.map((x) => x.chunkId);
    expect(ids).toContain("doc_securerate5_v1:c002"); // p3 interest rates
    expect(ids).toContain("doc_securerate5_v1:c004"); // p4 surrender table
  });

  it("17: missing-information query yields related context, never fabricated evidence", async () => {
    const r = await retrieve(deps, { query: "TermPlus 61 岁的续保保费是多少？" });
    // Relevance is expected (premium-structure context) — sufficiency is not.
    expect(r.results[0]!.similarityScore).toBeGreaterThan(LOW_RELEVANCE_TOP);
    for (const chunk of r.results) {
      expect(chunk.content).not.toMatch(/age\s*61/i); // the answer genuinely does not exist
    }
  });
});

describe("live rewrite behavior", () => {
  it("18/19/20/21: preserves numbers, product names and terminology; adds no digits; answers nothing", async () => {
    const query = "SecureRate 的初始利率 4.25% 保证几年？";
    const out = await rewrite(query);
    expect(out).not.toBeNull();
    expect(out!).toContain("4.25");
    expect(out!.toLowerCase()).toContain("securerate");
    expect(/\p{Script=Han}/u.test(out!)).toBe(false); // fully English
    const digitsIn = new Set(query.match(/\d+(\.\d+)?/g));
    for (const num of out!.match(/\d+(\.\d+)?/g) ?? []) {
      expect(digitsIn.has(num), `rewrite invented number ${num}`).toBe(true);
    }
    // A retrieval query, not an answer: no assertive answer phrasing.
    expect(out!.toLowerCase()).not.toMatch(/guaranteed for (the )?first five/);
  });
});
