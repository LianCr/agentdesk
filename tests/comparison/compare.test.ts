import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SyntheticCaseSchema } from "../../lib/schemas";
import { compareProducts, computeComparisonStatus } from "../../lib/comparison/compare";
import type { ComparisonDraft } from "../../lib/comparison/types";
import { ALL_IDS, ANNUITY_ID, IUL_ID, TERM_ID, chunksFor, clone, product } from "./fixtures";

// M4-B acceptance items 1-7 and 19-22.

const chunksByDocumentId = Object.fromEntries(ALL_IDS.map((id) => [id, chunksFor(id)]));

function compare(a: string, b: string, syntheticCase?: Parameters<typeof compareProducts>[0]["syntheticCase"]) {
  return compareProducts({
    productA: product(a),
    productB: product(b),
    chunksByDocumentId,
    syntheticCase: syntheticCase ?? null,
    comparisonIdFactory: () => "cmp_test",
    now: () => 0,
  });
}

const PAIRS = [
  [TERM_ID, IUL_ID],
  [IUL_ID, ANNUITY_ID],
  [TERM_ID, ANNUITY_ID],
] as const;

describe("all three product pairs compare (1-3)", () => {
  it.each(PAIRS)("%s vs %s produces a full, complete table", (a, b) => {
    const draft = compare(a, b);
    expect(draft.comparisonStatus).toBe("complete");
    expect(draft.dimensions).toHaveLength(13);
    expect(draft.productA.documentId).toBe(a);
    expect(draft.productB.documentId).toBe(b);
    for (const row of draft.dimensions) {
      expect(row.cells[0]!.productId).toBe(a);
      expect(row.cells[1]!.productId).toBe(b);
      for (const cell of row.cells) {
        expect(cell.availability).not.toBe("conflict");
        for (const citation of cell.citations) {
          expect(citation.documentId).toBe(cell.productId);
        }
      }
    }
  });

  it("a product cannot be compared with itself", () => {
    expect(() => compare(TERM_ID, TERM_ID)).toThrow(/cannot be compared with itself/);
  });
});

describe("product-order symmetry (4)", () => {
  it.each(PAIRS)("%s vs %s is column-swapped but otherwise identical", (a, b) => {
    const forward = compare(a, b);
    const reverse = compare(b, a);

    expect(reverse.dimensions.map((r) => r.dimensionId)).toEqual(forward.dimensions.map((r) => r.dimensionId));
    expect(reverse.comparisonStatus).toBe(forward.comparisonStatus);
    expect(reverse.reviewReasons).toEqual(forward.reviewReasons);
    expect(reverse.missingClientInformation).toEqual(forward.missingClientInformation);

    // Columns swap, and every cell keeps its own product and citations.
    forward.dimensions.forEach((row, index) => {
      const mirrored = reverse.dimensions[index]!;
      expect(mirrored.cells[0]).toEqual(row.cells[1]);
      expect(mirrored.cells[1]).toEqual(row.cells[0]);
    });

    // Observations stay semantically equivalent: same types, same severities,
    // same cited sources — only the productId ordering may differ.
    expect(reverse.observations.map((o) => o.type).sort()).toEqual(forward.observations.map((o) => o.type).sort());
    for (const type of new Set(forward.observations.map((o) => o.type))) {
      const f = forward.observations.find((o) => o.type === type)!;
      const r = reverse.observations.find((o) => o.type === type)!;
      expect(r.severity).toBe(f.severity);
      expect([...r.citationIds].sort()).toEqual([...f.citationIds].sort());
      expect([...r.factRefs].map((x) => x.productId).sort()).toEqual(
        [...f.factRefs].map((x) => x.productId).sort(),
      );
      expect(r.textEn).toBe(f.textEn);
    }
  });
});

describe("determinism (5-6)", () => {
  it("the same input yields an identical deterministic table", () => {
    const strip = (draft: ComparisonDraft) => ({ ...draft, comparisonId: "", meta: { ...draft.meta, latencyMs: 0 } });
    expect(strip(compare(TERM_ID, ANNUITY_ID))).toEqual(strip(compare(TERM_ID, ANNUITY_ID)));
  });

  it("status is blocked when a core dimension conflicts and partial when a non-core one does", () => {
    const draft = compare(TERM_ID, IUL_ID);
    const core = clone(draft.dimensions);
    core.find((r) => r.dimensionId === "cash_value")!.cells[0]!.availability = "conflict";
    expect(computeComparisonStatus(core)).toBe("blocked");

    const nonCore = clone(draft.dimensions);
    nonCore.find((r) => r.dimensionId === "important_limitations")!.cells[0]!.availability = "conflict";
    expect(computeComparisonStatus(nonCore)).toBe("partial");

    // not_provided is knowledge, not failure.
    const provided = clone(draft.dimensions);
    provided.find((r) => r.dimensionId === "illustration_documentation")!.cells[0]!.availability = "not_provided";
    expect(computeComparisonStatus(provided)).toBe("complete");
  });
});

describe("client context never changes product facts (7, 19-21)", () => {
  const cases = [null, "case-a-low-risk", "case-b-medium-risk", "case-c-high-risk"] as const;

  it("the same pair yields identical cells for every client and for no client", () => {
    const base = compare(TERM_ID, ANNUITY_ID).dimensions;
    for (const file of cases.slice(1)) {
      const syntheticCase = SyntheticCaseSchema.parse(
        JSON.parse(readFileSync(join(process.cwd(), `data/synthetic-cases/${file}.json`), "utf8")),
      );
      const withClient = compare(TERM_ID, ANNUITY_ID, syntheticCase).dimensions;
      expect(withClient).toEqual(base);
    }
  });

  it("no draft contains ranking, winner or recommendation language", () => {
    const forbidden = /\b(best|better|winner|recommend|should buy|most suitable|ideal choice)\b|最好|更好|最适合|推荐购买|应该买|首选/i;
    for (const [a, b] of PAIRS) {
      for (const draft of [compare(a, b), compare(b, a)]) {
        const text = [
          ...draft.dimensions.flatMap((r) => r.cells.map((c) => c.displayValue ?? "")),
          ...draft.observations.flatMap((o) => [o.textZh, o.textEn]),
          ...draft.missingClientInformation.flatMap((m) => [m.reasonZh, m.reasonEn]),
          draft.disclaimerZh,
          draft.disclaimerEn,
        ].join(" ");
        expect(text).not.toMatch(forbidden);
      }
    }
  });

  it("no severity or score implies one product is better", () => {
    for (const [a, b] of PAIRS) {
      for (const observation of compare(a, b).observations) {
        expect(["informational", "review_note"]).toContain(observation.severity);
      }
    }
  });
});

describe("deterministic core is a valid draft without narrative", () => {
  it("narrative fields start empty and the draft is still complete", () => {
    const draft = compare(TERM_ID, IUL_ID);
    expect(draft.narrativeSections).toEqual([]);
    expect(draft.narrativeStatus).toBe("not_requested");
    expect(draft.meta.narrativeModel).toBeNull();
    expect(draft.disclaimerEn).toContain("not a final recommendation");
    expect(draft.comparisonStatus).toBe("complete");
  });
});
