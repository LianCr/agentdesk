import { describe, expect, it } from "vitest";
import type { ChunkRecord } from "../../lib/ingestion/types";
import { findEvidenceChunk } from "../../lib/comparison/source-map";
import { buildProductFactSheet } from "../../lib/comparison/fact-sheet";
import { parseProductFacts, readFactPath } from "../../lib/comparison/product-facts";
import { ANNUITY_ID, TERM_ID, chunksFor, clone, product } from "./fixtures";

// M4-A matrix items 10-12, 16-17, 19-20.

const annuity = product(ANNUITY_ID);
const annuityChunks = chunksFor(ANNUITY_ID);
const annuityFacts = parseProductFacts(annuity);

function chunkOn(page: number, overrides: Partial<ChunkRecord>): ChunkRecord {
  const base = clone(annuityChunks.find((c) => c.pageStart === page)!);
  return { ...base, ...overrides };
}

describe("evidence mapping outcomes (10-12)", () => {
  it("a unique match resolves to that chunk and is stable across runs", () => {
    const request = {
      quote: readFactPath(annuityFacts, "initialRate.display") as string,
      anchor: { kind: "factId", factId: "annuity_rates" } as const,
    };
    const first = findEvidenceChunk(annuity, annuityFacts, annuityChunks, request);
    const second = findEvidenceChunk(annuity, annuityFacts, [...annuityChunks].reverse(), request);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.chunk.chunkId).toBe(second.chunk.chunkId);
      expect(first.candidateCount).toBe(1);
    }
  });

  it("zero matches on the anchor page is a failure, never a page-wide search", () => {
    const quote = readFactPath(annuityFacts, "initialRate.display") as string;
    const outcome = findEvidenceChunk(annuity, annuityFacts, annuityChunks, {
      quote,
      // The rate lives on the interest-rate page; anchoring at the cover must
      // not silently fall back to "found it somewhere else".
      anchor: { kind: "page", page: 1 },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe("NO_EVIDENCE_ON_ANCHOR_PAGE");
  });

  it("multiple equivalent matches resolve deterministically by chunk index", () => {
    const source = annuityChunks.find((c) => c.chunkId.endsWith(":c002"))!;
    const duplicate: ChunkRecord = { ...clone(source), chunkId: `${ANNUITY_ID}:c900`, chunkIndex: 900 };
    const outcome = findEvidenceChunk(annuity, annuityFacts, [...annuityChunks, duplicate], {
      quote: readFactPath(annuityFacts, "guaranteedMinimumRate.display") as string,
      anchor: { kind: "factId", factId: "annuity_rates" },
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.candidateCount).toBe(2);
      expect(outcome.chunk.chunkId).toBe(source.chunkId); // lower chunkIndex
    }
  });

  it("materially different candidates that stay tied are ambiguous, not arbitrary", () => {
    const quote = readFactPath(annuityFacts, "guaranteedMinimumRate.display") as string;
    const source = annuityChunks.find((c) => c.chunkId.endsWith(":c002"))!;
    // Same page, same section, same length (so the coverage bucket ties), but
    // materially different text.
    const rival: ChunkRecord = {
      ...clone(source),
      chunkId: `${ANNUITY_ID}:c901`,
      chunkIndex: 901,
      content: source.content.replace(/Interest Rates/, "Interest Terms"),
    };
    expect(rival.content).not.toBe(source.content);
    expect(rival.content.length).toBe(source.content.length); // same coverage bucket

    const outcome = findEvidenceChunk(annuity, annuityFacts, [...annuityChunks, rival], {
      quote,
      anchor: { kind: "factId", factId: "annuity_rates" },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toContain("AMBIGUOUS_EVIDENCE");
      expect(outcome.reason).toContain("c901");
    }
  });

  it("a declared chunk type narrows candidates before any index tie-break", () => {
    const tableTitle = readFactPath(annuityFacts, "surrenderChargeSchedule.tableTitle") as string;
    const decoy = chunkOn(4, {
      chunkId: `${ANNUITY_ID}:c902`,
      chunkIndex: 0, // would win a naive lowest-index rule
      chunkType: "text",
      content: `${tableTitle}\nSee the schedule below.`,
    });
    const outcome = findEvidenceChunk(annuity, annuityFacts, [decoy, ...annuityChunks], {
      quote: tableTitle,
      anchor: { kind: "tablePage", path: "surrenderChargeSchedule" },
      expectedChunkType: "table",
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.chunk.chunkType).toBe("table");
  });
});

describe("SecureRate evidence provenance (16-17)", () => {
  const sheet = buildProductFactSheet(annuity, annuityChunks);

  it("the five-year rate guarantee cites the interest-rate page of its own document", () => {
    const guaranteed = sheet.cells.find((c) => c.dimensionId === "guaranteed_elements")!;
    const guaranteeQuote = readFactPath(annuityFacts, "initialRate.guaranteeDisplay") as string;
    const citation = guaranteed.citations.find((c) => c.quote === guaranteeQuote);
    expect(citation).toBeDefined();
    expect(citation!.documentId).toBe(ANNUITY_ID);
    expect(citation!.pageStart).toBe(
      annuity.expectedFactLocations.find((l) => l.factId === "annuity_rates")!.page,
    );
    expect(citation!.section).toContain("Interest Rates");
  });

  it("the surrender schedule cites the table chunk on the declared table page", () => {
    const liquidity = sheet.cells.find((c) => c.dimensionId === "surrender_liquidity")!;
    const tableTitle = readFactPath(annuityFacts, "surrenderChargeSchedule.tableTitle") as string;
    const citation = liquidity.citations.find((c) => c.quote === tableTitle);
    expect(citation).toBeDefined();
    expect(citation!.documentId).toBe(ANNUITY_ID);
    expect(citation!.pageStart).toBe(
      readFactPath(annuityFacts, "surrenderChargeSchedule.tablePage") as number,
    );
    const chunk = annuityChunks.find((c) => c.chunkId === citation!.chunkId)!;
    expect(chunk.chunkType).toBe("table");
  });
});

describe("Term negative facts (19)", () => {
  it("the cash-value negative cites the At a Glance line on its declared page", () => {
    const termSheet = buildProductFactSheet(product(TERM_ID), chunksFor(TERM_ID));
    const facts = parseProductFacts(product(TERM_ID));
    const cash = termSheet.cells.find((c) => c.dimensionId === "cash_value")!;
    expect(cash.rawValue).toBe(false);
    expect(cash.citations).toHaveLength(1);
    expect(cash.citations[0]!.quote).toBe(readFactPath(facts, "cashValue.display"));
    expect(cash.citations[0]!.pageStart).toBe(
      product(TERM_ID).expectedFactLocations.find((l) => l.factId === "term_no_cash_value")!.page,
    );
  });
});

describe("SecureRate rider negative (20)", () => {
  it("the no-riders negative cites the annuitization-options page", () => {
    const sheet = buildProductFactSheet(annuity, annuityChunks);
    const riders = sheet.cells.find((c) => c.dimensionId === "riders")!;
    expect(riders.rawValue).toBe(false);
    expect(riders.citations).toHaveLength(1);
    expect(riders.citations[0]!.quote).toBe(readFactPath(annuityFacts, "optionalRiders.display"));
    expect(riders.citations[0]!.pageStart).toBe(
      annuity.expectedFactLocations.find((l) => l.factId === "annuity_options_no_riders")!.page,
    );
  });
});
