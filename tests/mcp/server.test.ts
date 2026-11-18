import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { readComparisonCatalog } from "../../lib/comparison/catalog-files";
import { createAgentDeskMcpServer } from "../../mcp/server";

// Tool-contract tests: a real MCP client talks to the real server over an
// in-memory transport (the protocol, schemas and validation are exercised;
// only stdio is swapped out). No network, no database, no API key.

let client: Client;
type Structured = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(name: string, args: Record<string, unknown> = {}) {
  return (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
    structuredContent?: Structured;
  };
}

beforeAll(async () => {
  const catalog = await readComparisonCatalog(process.cwd());
  const server = createAgentDeskMcpServer(catalog, "https://example.test");
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  client = new Client({ name: "contract-test", version: "0" });
  await client.connect(clientSide);
});

afterAll(async () => {
  await client.close();
});

describe("AgentDesk MCP server", () => {
  it("exposes exactly four tools, all read-only", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "compare_products",
      "get_chunk",
      "list_documents",
      "search_knowledge_base",
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.description, tool.name).toBeTruthy();
    }
  });

  it("list_documents: the frozen knowledge base, 3 documents / 20 pages / 45 chunks", async () => {
    const res = await call("list_documents");
    const docs = res.structuredContent!.documents as Array<{ pages: number; chunks: number }>;
    expect(docs).toHaveLength(3);
    expect(docs.reduce((s, d) => s + d.pages, 0)).toBe(20);
    expect(docs.reduce((s, d) => s + d.chunks, 0)).toBe(45);
  });

  it("search_knowledge_base (Chinese): 现金价值 finds the TermPlus 'no cash value' chunk on page 2", async () => {
    const res = await call("search_knowledge_base", { query: "定期寿险有现金价值吗？" });
    const { searchedTerms, hits } = res.structuredContent!;
    expect(searchedTerms).toEqual(expect.arrayContaining(["cash", "value", "term", "life"]));
    const top = hits[0];
    expect(top.documentId).toBe("doc_termplus20_v1");
    expect(top.pageStart).toBe(2);
    expect(top.sourceUrl).toBe("https://example.test/documents/demo-termplus-20.pdf#page=2");
  });

  it("search hits are verbatim: every excerpt (minus ellipses) is a substring of its chunk", async () => {
    const res = await call("search_knowledge_base", { query: "surrender charge schedule", limit: 10 });
    const hits = res.structuredContent!.hits as Array<{ chunkId: string; excerpt: string }>;
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      const chunk = (await call("get_chunk", { chunkId: hit.chunkId })).structuredContent!;
      const normalized = (chunk.content as string).replace(/\s+/g, " ");
      expect(normalized).toContain(hit.excerpt.replace(/^…|…$/g, ""));
    }
  });

  it("search can be restricted to one document and capped", async () => {
    const res = await call("search_knowledge_base", {
      query: "rate",
      documentId: "doc_securerate5_v1",
      limit: 2,
    });
    const hits = res.structuredContent!.hits as Array<{ documentId: string }>;
    expect(hits.length).toBeLessThanOrEqual(2);
    for (const h of hits) expect(h.documentId).toBe("doc_securerate5_v1");
  });

  it("search with nothing to match says so instead of returning noise", async () => {
    const res = await call("search_knowledge_base", { query: "cryptocurrency staking" });
    expect(res.structuredContent!.hits).toEqual([]);
    expect(res.content[0]!.text).toMatch(/No chunk matched/);
  });

  it("rejects out-of-range input at the schema boundary", async () => {
    const res = await call("search_knowledge_base", { query: "rate", limit: 50 });
    expect(res.isError).toBe(true);
  });

  it("get_chunk: verbatim text with page; unknown id is an error", async () => {
    const ok = await call("get_chunk", { chunkId: "doc_termplus20_v1:c001" });
    expect(ok.structuredContent!.content).toContain("The policy does not accumulate cash value.");
    expect(ok.structuredContent!.pageStart).toBe(2);
    const missing = await call("get_chunk", { chunkId: "doc_termplus20_v1:c999" });
    expect(missing.isError).toBe(true);
    expect(missing.content[0]!.text).toMatch(/UNKNOWN_CHUNK/);
  });

  it("compare_products: the same 13-row draft as the web app, cited, unranked", async () => {
    const res = await call("compare_products", {
      productAId: "doc_securerate5_v1",
      productBId: "doc_indexflex_ul_v1",
      clientCaseId: "DEMO-2026-003",
    });
    const draft = res.structuredContent!;
    expect(draft.dimensions).toHaveLength(13);
    expect(draft.comparisonStatus).toBe("complete");
    const text = JSON.stringify(draft);
    expect(text).toContain("\"quote\"");
    for (const banned of ['"score"', '"winner"', '"rank"', '"recommendation"']) expect(text).not.toContain(banned);
  });

  it("compare_products: same product twice, unknown product and unknown client are errors", async () => {
    expect((await call("compare_products", { productAId: "doc_securerate5_v1", productBId: "doc_securerate5_v1" })).isError).toBe(true);
    expect((await call("compare_products", { productAId: "doc_securerate5_v1", productBId: "doc_nope_v1" })).isError).toBe(true);
    expect(
      (await call("compare_products", { productAId: "doc_securerate5_v1", productBId: "doc_indexflex_ul_v1", clientCaseId: "X" })).isError,
    ).toBe(true);
  });
});
