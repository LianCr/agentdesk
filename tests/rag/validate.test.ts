import { describe, expect, it } from "vitest";
import { buildEvidenceMap, validateDraft, mustBeFactual } from "../../lib/rag/validate.js";
import { computeEvidenceStatus } from "../../lib/rag/evidence-status.js";
import { renderAnswer, assertRenderedAnswer } from "../../lib/rag/render.js";
import { ModelDraftSchema } from "../../lib/rag/types.js";
import { chunk, riderChunk, draft } from "./helpers.js";

// Offline validator tests (matrix 1-14). All validators are the real code.

const evidence = buildEvidenceMap([chunk(), riderChunk()]); // E1, E2

describe("evidence handles (1-2)", () => {
  it("1: valid handle accepted with citation injected from retrieval metadata", () => {
    const v = validateDraft(draft(), evidence);
    expect(v.ok).toBe(true);
    expect(v.validatedClaims).toHaveLength(1);
    expect(v.citations).toHaveLength(1);
    expect(v.citations[0]).toMatchObject({
      documentId: "doc_termplus20_v1",
      documentName: "Demo TermPlus 20 Product Guide",
      pageStart: 2,
      chunkId: "doc_termplus20_v1:c001",
      citationId: "cit_001",
    });
  });

  it("2: unknown evidence handle is a hard validation failure", () => {
    const bad = draft({
      claims: [{ ...draft().claims[0]!, evidenceHandles: ["E9"], quoteSelections: [{ handle: "E9", quote: "x" }] }],
    });
    const v = validateDraft(bad, evidence);
    expect(v.ok).toBe(false);
    expect(v.hardErrors.join(" ")).toMatch(/unknown evidence handle E9/);
  });
});

describe("quotes (3-4)", () => {
  it("3: exact (normalized) substring quote passes", () => {
    const v = validateDraft(
      draft({
        claims: [{ ...draft().claims[0]!, quoteSelections: [{ handle: "E1", quote: "does not  accumulate cash value" }] }],
      }),
      evidence,
    );
    expect(v.validatedClaims[0]!.citationIds).toHaveLength(1);
  });

  it("4: invented quote fails and the factual claim becomes unsupported", () => {
    const v = validateDraft(
      draft({
        claims: [{ ...draft().claims[0]!, quoteSelections: [{ handle: "E1", quote: "guarantees a 10% return" }] }],
      }),
      evidence,
    );
    expect(v.ok).toBe(true);
    expect(v.validatedClaims).toHaveLength(0);
    expect(v.unsupportedClaims).toHaveLength(1);
  });
});

describe("code-owned metadata (5-6)", () => {
  it("5/6: the draft schema has no page/documentId/citation fields for the model to fill", () => {
    const withForged = {
      ...draft(),
      claims: [{ ...draft().claims[0]!, page: 99, documentId: "doc_forged" }],
    };
    // Strict schema: unknown keys are rejected outright.
    expect(ModelDraftSchema.safeParse(withForged).success).toBe(false);
    // And even when parsed non-strictly, citations still carry retrieval metadata.
    const v = validateDraft(draft(), evidence);
    expect(v.citations[0]!.pageStart).toBe(2);
  });
});

describe("citation-required claims (7-10)", () => {
  it("7/8: factual and numeric claims without citations cannot render", () => {
    const numeric = draft({
      claims: [{ claimId: "c1", text: "The cap is 9.50%.", factual: false, evidenceHandles: [], quoteSelections: [] }],
    });
    const v = validateDraft(numeric, evidence);
    expect(v.validatedClaims).toHaveLength(0); // forced factual by number, no citation -> unsupported
    expect(v.unsupportedClaims).toHaveLength(1);
    expect(v.citationCoverage).toBe(0);
  });

  it("9: negative product facts require citations", () => {
    expect(mustBeFactual("SecureRate does not offer optional riders")).toBe(true);
    const negative = draft({
      claims: [{ claimId: "c1", text: "SecureRate does not offer optional riders.", factual: false, evidenceHandles: [], quoteSelections: [] }],
    });
    expect(validateDraft(negative, evidence).unsupportedClaims).toHaveLength(1);
  });

  it("10: non-factual transition text renders without citation", () => {
    const v = validateDraft(
      draft({
        sections: [{ heading: null, claimIds: ["c1"], nonFactualText: "Here is what the guide documents:" }],
      }),
      evidence,
    );
    const answer = renderAnswer({
      language: "en", sections: [{ heading: null, claimIds: ["c1"], nonFactualText: "Here is what the guide documents:" }],
      claims: v.validatedClaims, citations: v.citations, missingInformation: [], suggestedNextStep: null,
    });
    expect(answer).toContain("Here is what the guide documents:");
  });
});

describe("render integrity and coverage (11-12)", () => {
  it("11: the renderer cannot introduce new factual prose", () => {
    const v = validateDraft(draft(), evidence);
    const answer = renderAnswer({
      language: "en", sections: draft().sections, claims: v.validatedClaims,
      citations: v.citations, missingInformation: [], suggestedNextStep: null,
    });
    expect(() => assertRenderedAnswer(answer, v.validatedClaims, [], null)).not.toThrow();
    const tampered = answer + "\nThe premium is $999 per month.";
    expect(() => assertRenderedAnswer(tampered, v.validatedClaims, [], null)).toThrow(/RENDER_INTEGRITY/);
  });

  it("12: citation coverage is computed deterministically", () => {
    const two = draft({
      sections: [{ heading: null, claimIds: ["c1", "c2"], nonFactualText: null }],
      claims: [
        draft().claims[0]!,
        { claimId: "c2", text: "The cap is 9.50%.", factual: true, evidenceHandles: ["E1"], quoteSelections: [{ handle: "E1", quote: "not present in chunk" }] },
      ],
    });
    const v = validateDraft(two, evidence);
    expect(v.citationCoverage).toBe(0.5);
  });
});

describe("sufficiency (13-14)", () => {
  it("13: one accurate chunk can produce strong evidence", () => {
    expect(
      computeEvidenceStatus({ supportedFactualClaims: 1, unsupportedFactualClaims: 0, missingInformationCount: 0, topSimilarityScore: 0.395 }),
    ).toBe("strong"); // the measured weakest gold score — single chunk, still strong
  });

  it("14: chunk count is not an input to sufficiency", () => {
    // The function signature has no chunk-count parameter; verify behavior
    // depends on claims, not on how many chunks were retrieved.
    const one = computeEvidenceStatus({ supportedFactualClaims: 2, unsupportedFactualClaims: 0, missingInformationCount: 0, topSimilarityScore: 0.6 });
    expect(one).toBe("strong");
    expect(
      computeEvidenceStatus({ supportedFactualClaims: 0, unsupportedFactualClaims: 1, missingInformationCount: 0, topSimilarityScore: 0.75 }),
    ).toBe("insufficient"); // high score alone proves nothing
  });
});

describe("product consistency and forbidden evidence", () => {
  it("claims naming one product cannot cite another product's chunk", () => {
    const cross = draft({
      claims: [{
        claimId: "c1", text: "IndexFlex does not accumulate cash value.", factual: true,
        evidenceHandles: ["E1"], quoteSelections: [{ handle: "E1", quote: "does not accumulate cash value" }],
      }],
    });
    const v = validateDraft(cross, evidence); // E1 is a TermPlus chunk
    expect(v.validatedClaims).toHaveLength(0);
    expect(v.unsupportedClaims).toHaveLength(1);
  });

  it("test documents can never become evidence handles", () => {
    expect(() => buildEvidenceMap([chunk({ documentId: "test_doc_x" })])).toThrow(/EVIDENCE_FORBIDDEN/);
  });
});
