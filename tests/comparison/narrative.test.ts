import { describe, expect, it } from "vitest";
import { compareProducts } from "../../lib/comparison/compare";
import { attachNarrative, buildNarrativeInput, validateNarrative } from "../../lib/comparison/narrative";
import type { ComparisonDraft } from "../../lib/comparison/types";
import { ALL_IDS, ANNUITY_ID, IUL_ID, TERM_ID, chunksFor, clone, product } from "./fixtures";

// M4-B acceptance items 23-26 (narrative guards and fallback).

const chunksByDocumentId = Object.fromEntries(ALL_IDS.map((id) => [id, chunksFor(id)]));
const PRODUCTS = [product(TERM_ID), product(ANNUITY_ID), product(IUL_ID)];

const draft = compareProducts({
  productA: product(ANNUITY_ID),
  productB: product(TERM_ID),
  chunksByDocumentId,
  comparisonIdFactory: () => "cmp_test",
  now: () => 0,
});

const mismatch = draft.observations.find((o) => o.type === "RATE_GUARANTEE_SHORTER_THAN_SURRENDER")!;

function section(overrides: Partial<{
  headingZh: string; headingEn: string; text: string; dimensionIds: string[]; observationIds: string[];
}> = {}) {
  return {
    headingZh: "已记录的差异",
    headingEn: "Documented differences",
    text: "The two contracts are described differently in their own guides.",
    dimensionIds: ["product_type"],
    observationIds: [],
    ...overrides,
  };
}

const candidate = (...sections: ReturnType<typeof section>[]) => ({ language: "en" as const, sections });

/** Runs attachNarrative with an injected generator — no model, no network. */
async function withNarrative(generate: () => Promise<unknown>, base: ComparisonDraft = draft) {
  return attachNarrative(base, PRODUCTS, { generate });
}

describe("narrative validation accepts only traceable prose (23-25)", () => {
  it("accepts sections that reference real dimensions and observations", () => {
    const outcome = validateNarrative(
      draft,
      candidate(section({ observationIds: [mismatch.observationId], dimensionIds: ["guaranteed_elements"] })),
      PRODUCTS,
    );
    expect(outcome.ok).toBe(true);
  });

  it("rejects an unknown dimension", () => {
    const outcome = validateNarrative(draft, candidate(section({ dimensionIds: ["made_up_dimension"] })), PRODUCTS);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toMatch(/SCHEMA_INVALID|UNKNOWN_DIMENSION/);
  });

  it("rejects an unknown observation", () => {
    const outcome = validateNarrative(draft, candidate(section({ observationIds: ["obs_999"] })), PRODUCTS);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toContain("UNKNOWN_OBSERVATION");
  });

  it("rejects a section that references nothing at all", () => {
    const outcome = validateNarrative(
      draft,
      candidate(section({ dimensionIds: [], observationIds: [] })),
      PRODUCTS,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("SECTION_WITHOUT_REFERENCES");
  });

  it("rejects a number that is not in the referenced cells", () => {
    const outcome = validateNarrative(
      draft,
      candidate(section({ text: "The renewal rate after year five is 6.75%.", dimensionIds: ["product_type"] })),
      PRODUCTS,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toContain("UNSUPPORTED_NUMBER");
  });

  it("licenses numbers per section, not from a global pool", () => {
    // 4.25% is real — but it belongs to guaranteed_elements, not product_type.
    const wrongScope = validateNarrative(
      draft,
      candidate(section({ text: "The initial rate is 4.25%.", dimensionIds: ["product_type"] })),
      PRODUCTS,
    );
    expect(wrongScope.ok).toBe(false);

    const rightScope = validateNarrative(
      draft,
      candidate(section({ text: "The initial rate is 4.25%.", dimensionIds: ["guaranteed_elements", "crediting_mechanics"] })),
      PRODUCTS,
    );
    expect(rightScope.ok).toBe(true);
  });

  it("rejects a recommendation, in either language", () => {
    for (const text of [
      "Demo SecureRate 5 is the best choice for this client.",
      "客户应该购买 Demo TermPlus 20。",
    ]) {
      const outcome = validateNarrative(draft, candidate(section({ text })), PRODUCTS);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toContain("RECOMMENDATION");
    }
  });

  it("allows an explicit statement that this is not a recommendation", () => {
    const outcome = validateNarrative(
      draft,
      candidate(section({ text: "This is not a recommendation. The documents do not establish which product is better." })),
      PRODUCTS,
    );
    expect(outcome.ok).toBe(true);
  });

  it("rejects fabricated citation metadata", () => {
    const outcome = validateNarrative(
      draft,
      candidate(section({ text: "See doc_securerate5_v1 for the schedule." })),
      PRODUCTS,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("FABRICATED_CITATION_REFERENCE");
  });

  it("rejects an assertion about an intentionally omitted fact", () => {
    const outcome = validateNarrative(
      draft,
      candidate(section({ text: "Historical renewal rates are expected to stay near the initial rate." })),
      PRODUCTS,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toContain("INTENTIONAL_OMISSION");
  });
});

describe("narrative failure never breaks the comparison (26)", () => {
  const deterministic = (d: ComparisonDraft) => ({
    dimensions: d.dimensions,
    observations: d.observations,
    missingClientInformation: d.missingClientInformation,
    reviewReasons: d.reviewReasons,
    comparisonStatus: d.comparisonStatus,
  });

  it("a provider failure leaves the deterministic draft intact", async () => {
    const result = await withNarrative(async () => {
      throw new Error("NARRATIVE_MODEL_UNAVAILABLE");
    });
    expect(result.narrativeStatus).toBe("unavailable");
    expect(result.narrativeSections).toEqual([]);
    expect(deterministic(result)).toEqual(deterministic(draft));
  });

  it("a timeout leaves the deterministic draft intact", async () => {
    const result = await withNarrative(async () => {
      throw new Error("The operation was aborted due to timeout");
    });
    expect(result.narrativeStatus).toBe("unavailable");
    expect(deterministic(result)).toEqual(deterministic(draft));
  });

  it("an invalid narrative is rejected and the draft still returns", async () => {
    const result = await withNarrative(async () => candidate(section({ text: "The cap is 12.00%." })));
    expect(result.narrativeStatus).toBe("rejected");
    expect(result.narrativeRejectionReason).toContain("UNSUPPORTED_NUMBER");
    expect(result.narrativeSections).toEqual([]);
    expect(deterministic(result)).toEqual(deterministic(draft));
  });

  it("a recommending narrative is rejected and the draft still returns", async () => {
    const result = await withNarrative(async () =>
      candidate(section({ text: "Demo TermPlus 20 is the most suitable option here." })),
    );
    expect(result.narrativeStatus).toBe("rejected");
    expect(deterministic(result)).toEqual(deterministic(draft));
  });

  it("narrative cannot change review flags, status or citations", async () => {
    const result = await withNarrative(async () => ({
      language: "en",
      sections: [section({ observationIds: [mismatch.observationId] })],
      // Fields the model has no business emitting; the strict schema drops the
      // whole draft rather than letting them through.
      reviewReasons: [],
      comparisonStatus: "blocked",
    }));
    expect(result.narrativeStatus).toBe("rejected");
    expect(result.reviewReasons).toEqual(draft.reviewReasons);
    expect(result.comparisonStatus).toBe(draft.comparisonStatus);
  });

  it("a blocked comparison never gets a narrative at all", async () => {
    const blocked = clone(draft);
    blocked.comparisonStatus = "blocked";
    let called = false;
    const result = await withNarrative(async () => {
      called = true;
      return candidate(section());
    }, blocked);
    expect(called).toBe(false);
    expect(result.narrativeStatus).toBe("unavailable");
    expect(result.narrativeRejectionReason).toBe("COMPARISON_BLOCKED");
  });

  it("a valid narrative attaches without touching anything deterministic", async () => {
    const result = await withNarrative(async () =>
      candidate(section({ observationIds: [mismatch.observationId], dimensionIds: ["surrender_liquidity"] })),
    );
    expect(result.narrativeStatus).toBe("available");
    expect(result.narrativeSections).toHaveLength(1);
    expect(deterministic(result)).toEqual(deterministic(draft));
  });
});

describe("the model sees only validated structures", () => {
  it("the prompt input carries no chunk text, page numbers or document ids", () => {
    const input = buildNarrativeInput(draft, "en");
    expect(input).toContain("<dimension id=");
    expect(input).toContain("<observation id=");
    expect(input).not.toContain("doc_securerate5_v1");
    expect(input).not.toContain("chunkId");
    expect(input).not.toMatch(/page \d+/i);
  });

  it("builds the same structure in both languages", () => {
    for (const language of ["zh", "en"] as const) {
      const input = buildNarrativeInput(draft, language);
      expect(input).toContain(`Language: ${language}`);
      expect(input).toContain("<missingClientInformation>");
    }
  });
});

describe("word-form and digit-form of a cited number are the same fact", () => {
  it("a source saying 'year five' licenses the digit 5 in that section", () => {
    // crediting_mechanics for the annuity reads "Declared annually after year
    // five" — a restatement writing 第 5 年 states the same documented fact.
    const outcome = validateNarrative(
      draft,
      candidate(section({ text: "续期利率在第 5 年之后由承保方每年宣告。", dimensionIds: ["crediting_mechanics"] })),
      PRODUCTS,
    );
    expect(outcome.ok).toBe(true);
  });

  it("but a number absent from the referenced sources is still rejected in either form", () => {
    const digits = validateNarrative(
      draft,
      candidate(section({ text: "续期利率在第 9 年之后重置。", dimensionIds: ["crediting_mechanics"] })),
      PRODUCTS,
    );
    expect(digits.ok).toBe(false);

    const unrelatedSection = validateNarrative(
      draft,
      candidate(section({ text: "The guaranteed minimum rate is 1.00%.", dimensionIds: ["product_type"] })),
      PRODUCTS,
    );
    expect(unrelatedSection.ok).toBe(false);
  });
});
