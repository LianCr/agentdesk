import { describe, expect, it } from "vitest";
import type { ChunkRecord } from "../../lib/ingestion/types";
import { buildLexicalIndex, searchChunks, tokenize } from "../../lib/knowledge/lexical-search";

const chunk = (id: string, content: string, section = "S"): ChunkRecord =>
  ({
    chunkId: `doc_t_v1:${id}`,
    documentId: "doc_t_v1",
    documentName: "T Guide",
    productName: "T",
    pageStart: 1,
    pageEnd: 1,
    section,
    content,
  }) as unknown as ChunkRecord;

describe("tokenize", () => {
  it("lowercases, drops stopwords and 1-char tokens, keeps percentages", () => {
    expect(tokenize("The Guaranteed Rate is 3.25% for 5 years")).toEqual(["guaranteed", "rate", "3.25%", "years"]);
  });
  it("ignores Chinese characters (they are mapped by the glossary first)", () => {
    expect(tokenize("现金价值")).toEqual([]);
  });
});

describe("searchChunks", () => {
  const index = buildLexicalIndex([
    chunk("c000", "Cash value accumulates over time. Cash value can be borrowed."),
    chunk("c001", "The death benefit is paid to the beneficiary."),
    chunk("c002", "Premiums are level for 20 years."),
  ]);

  it("ranks the chunk with the most relevant terms first", () => {
    const r = searchChunks(index, "cash value");
    expect(r.hits[0]!.chunkId).toBe("doc_t_v1:c000");
    expect(r.hits[0]!.matchedTerms).toEqual(["cash", "value"]);
  });

  it("maps Chinese insurance terms through the glossary", () => {
    const r = searchChunks(index, "身故赔偿是多少？");
    expect(r.searchedTerms).toEqual(expect.arrayContaining(["death", "benefit"]));
    expect(r.hits[0]!.chunkId).toBe("doc_t_v1:c001");
  });

  it("returns no hits rather than weak noise when nothing matches", () => {
    expect(searchChunks(index, "cryptocurrency").hits).toEqual([]);
  });

  it("clamps the limit to 1..10 and is deterministic", () => {
    expect(searchChunks(index, "cash value premiums death", { limit: 1 }).hits).toHaveLength(1);
    expect(searchChunks(index, "cash", { limit: 0 }).hits).toHaveLength(1);
    expect(searchChunks(index, "years benefit")).toEqual(searchChunks(index, "years benefit"));
  });
});
