import { beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "../../lib/supabase/server.js";
import { createOpenAiProvider } from "../../lib/embeddings/openai.js";
import { createAnswerModel } from "../../lib/ai/client.js";
import { createRewriter } from "../../lib/retrieval/rewrite.js";
import { answerQuestion, type AnswerDeps } from "../../lib/rag/answer.js";
import type { GroundedAnswer } from "../../lib/rag/types.js";

// Live grounded-answer tests (matrix 31-40, 45-47). Read-only; the database
// must remain exactly 3/20/45 and no test/fake document may ever be cited.

let deps: AnswerDeps;
let db: ReturnType<typeof createServiceClient>;

async function counts(): Promise<string> {
  const out: number[] = [];
  for (const t of ["documents", "document_pages", "chunks"]) {
    const { count } = await db.from(t).select("*", { count: "exact", head: true });
    out.push(count ?? -1);
  }
  return out.join("/");
}

// Rendered-output safety: every rendered factual claim is cited and all
// citations have clean provenance. This is the hard guarantee — a nonzero
// unsupportedClaimCount means the validator correctly DROPPED a claim, which
// is defense-in-depth working, not a safety failure.
function assertRenderedSafety(result: GroundedAnswer): void {
  for (const claim of result.claims.filter((c) => c.factual)) {
    expect(claim.citationIds.length, `claim "${claim.text}" uncited`).toBeGreaterThan(0);
  }
  for (const citation of result.citations) {
    expect(citation.documentId).toMatch(/^doc_/);
    expect(citation.pageStart).toBeGreaterThan(0);
  }
}

// Strict grounding for clearly answerable questions: additionally, the model
// should not have produced any claim the validator had to drop.
function assertGrounded(result: GroundedAnswer): void {
  expect(result.meta.unsupportedClaimCount).toBe(0);
  assertRenderedSafety(result);
}

beforeAll(() => {
  db = createServiceClient();
  const model = createAnswerModel();
  deps = {
    retrieval: {
      db,
      provider: createOpenAiProvider(process.env.OPENAI_API_KEY),
      rewrite: createRewriter(model),
    },
    model,
  };
});

describe("answerable questions (31-35)", () => {
  it("31: English TermPlus cash-value question", async () => {
    const r = await answerQuestion(deps, "Does Demo TermPlus 20 accumulate cash value?");
    expect(r.refusal.isRefusal).toBe(false);
    expect(r.language).toBe("en");
    expect(r.answer.toLowerCase()).toContain("cash value");
    expect(r.citations.some((c) => c.documentId === "doc_termplus20_v1" && c.pageStart === 2)).toBe(true);
    assertGrounded(r);
  });

  it("32: Chinese TermPlus cash-value question answers in Chinese with English quotes", async () => {
    const r = await answerQuestion(deps, "定期寿险有现金价值吗？");
    expect(r.language).toBe("zh");
    expect(r.refusal.isRefusal).toBe(false);
    expect(/\p{Script=Han}/u.test(r.answer)).toBe(true);
    expect(r.citations.length).toBeGreaterThan(0);
    expect(/\p{Script=Han}/u.test(r.citations[0]!.quote)).toBe(false); // quotes stay English
    assertGrounded(r);
  });

  it("33: mixed IUL cap question carries current AND guaranteed values with citations", async () => {
    const r = await answerQuestion(deps, "IUL 的 current cap 和 guaranteed minimum cap 是多少？");
    expect(r.refusal.isRefusal).toBe(false);
    expect(r.answer).toContain("9.50%");
    expect(r.answer).toContain("3.00%");
    expect(r.citations.some((c) => c.documentId === "doc_indexflex_ul_v1" && c.pageStart === 5)).toBe(true);
    assertGrounded(r);
  });

  it("34: SecureRate optional-rider question renders the cited negative fact", async () => {
    const r = await answerQuestion(deps, "SecureRate 有 optional rider 吗？");
    expect(r.refusal.isRefusal).toBe(false);
    expect(r.citations.some((c) => c.documentId === "doc_securerate5_v1" && c.pageStart === 5)).toBe(true);
    expect(r.citations.some((c) => c.quote.includes("does not offer optional riders"))).toBe(true);
    assertGrounded(r);
  });

  it("35: attained-age renewal question", async () => {
    const r = await answerQuestion(deps, "TermPlus level period 结束以后 premium 怎么变化？");
    expect(r.refusal.isRefusal).toBe(false);
    expect(r.citations.every((c) => c.documentId === "doc_termplus20_v1")).toBe(true);
    expect(r.citations.some((c) => c.quote.toLowerCase().includes("attained-age"))).toBe(true);
    assertGrounded(r);
  });
});

describe("intentionally missing questions (36-40)", () => {
  it("36/39/40: age-61 premium — no invented number, explicit gap, cited known facts", async () => {
    const r = await answerQuestion(deps, "TermPlus 61 岁续保费是多少？");
    expect(r.evidenceStatus).not.toBe("strong");
    expect(r.missingInformation.length).toBeGreaterThan(0);
    expect(r.answer).not.toMatch(/61[^\d]{0,10}[$¥][\d,]+|[$¥][\d,]+[^\d]{0,10}61 ?岁/);
    assertRenderedSafety(r); // whatever facts it does state are cited
  });

  it("37/39/40: 20-year IUL cash value — no projection invented", async () => {
    const r = await answerQuestion(deps, "IndexFlex 20 年后有多少 cash value？");
    expect(r.evidenceStatus).not.toBe("strong");
    expect(r.missingInformation.length).toBeGreaterThan(0);
    expect(r.reviewRequired).toBe(true); // illustration soft flag
    assertRenderedSafety(r);
  });

  it("38/39/40: historical renewal rates — no history invented", async () => {
    const r = await answerQuestion(deps, "SecureRate 历史 renewal rates 是多少？");
    expect(r.evidenceStatus).not.toBe("strong");
    expect(r.missingInformation.length).toBeGreaterThan(0);
    assertRenderedSafety(r);
  });
});

describe("M2 regression (45-47)", () => {
  it("45/46: ask performs zero database writes; state stays 3/20/45", async () => {
    const before = await counts();
    expect(before).toBe("3/20/45");
    const r = await answerQuestion(deps, "Does SecureRate have a free withdrawal provision?");
    expect(r.citations.every((c) => !c.documentId.startsWith("test_"))).toBe(true); // 47
    const after = await counts();
    expect(after).toBe("3/20/45");
  });
});
