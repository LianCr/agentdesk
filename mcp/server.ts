import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { readComparisonCatalog, type Catalog } from "../lib/comparison/catalog-files";
import { withCitationUrls } from "../lib/comparison/citation-urls";
import { compareProducts } from "../lib/comparison/compare";
import { buildLexicalIndex, searchChunks } from "../lib/knowledge/lexical-search";

// AgentDesk MCP server (stdio). Read-only, offline, deterministic.
//
// It exposes the committed, frozen knowledge base (3 fictional product
// guides, 45 chunks) and the code-only comparison engine to an MCP client
// such as Claude Code or Claude Desktop. It needs no database, no API key
// and makes no network call — so it cannot spend credit, write a review or
// trigger automation. Every tool is annotated readOnlyHint.
//
// What it does NOT expose: the grounded Q&A pipeline (needs OpenAI + pgvector
// and enforces the citation checks server-side), reviews, automation.
//
// Run:  npm run mcp    (see README "MCP server" for client configuration)

export const DEFAULT_BASE_URL = "https://agentdesk-acme307.vercel.app";

const docIdSchema = z.string().regex(/^doc_[a-z0-9_]+$/);

const hitShape = {
  chunkId: z.string(),
  documentId: z.string(),
  documentName: z.string(),
  productName: z.string(),
  pageStart: z.number().int(),
  pageEnd: z.number().int(),
  section: z.string().nullable(),
  score: z.number(),
  matchedTerms: z.array(z.string()),
  excerpt: z.string(),
  sourceUrl: z.string().nullable(),
};

export function createAgentDeskMcpServer(catalog: Catalog, baseUrl = DEFAULT_BASE_URL): McpServer {
  const allChunks = Object.values(catalog.chunksByDocumentId).flat();
  const index = buildLexicalIndex(allChunks);
  const chunkById = new Map(allChunks.map((c) => [c.chunkId, c]));
  const pdfUrl = (documentId: string, page: number): string | null => {
    const file = catalog.fileByDocumentId.get(documentId);
    return file ? `${baseUrl}/documents/${file}#page=${page}` : null;
  };

  const server = new McpServer({ name: "agentdesk", version: "0.1.0" });

  server.registerTool(
    "list_documents",
    {
      title: "List knowledge-base documents",
      description:
        "List the fictional insurance product guides in the AgentDesk knowledge base, with page and chunk counts. All products are fictional demonstration data.",
      outputSchema: {
        documents: z.array(
          z.object({
            documentId: z.string(),
            documentName: z.string(),
            productName: z.string(),
            productCategory: z.string(),
            pages: z.number().int(),
            chunks: z.number().int(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const documents = catalog.products.map((p) => ({
        documentId: p.documentId,
        documentName: p.documentName,
        productName: p.productName,
        productCategory: p.productCategory,
        pages: p.pages,
        chunks: catalog.chunksByDocumentId[p.documentId]?.length ?? 0,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ documents }, null, 2) }],
        structuredContent: { documents },
      };
    },
  );

  server.registerTool(
    "search_knowledge_base",
    {
      title: "Search the product guides",
      description:
        "Keyword (BM25) search over the 45 frozen chunks of the fictional product guides. Chinese insurance terms are mapped to English with a fixed glossary. Returns verbatim excerpts with document, page and a PDF link. This is lexical search, not the web app's vector retrieval; use get_chunk for the full verbatim text before quoting.",
      inputSchema: {
        query: z.string().min(1).max(500).describe("Question or keywords, English or Chinese"),
        documentId: docIdSchema.optional().describe("Restrict to one document (see list_documents)"),
        limit: z.number().int().min(1).max(10).optional().describe("Max hits, default 5"),
      },
      outputSchema: {
        query: z.string(),
        searchedTerms: z.array(z.string()),
        hits: z.array(z.object(hitShape)),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, documentId, limit }) => {
      const result = searchChunks(index, query, { documentId, limit });
      const structured = {
        ...result,
        hits: result.hits.map((h) => ({ ...h, sourceUrl: pdfUrl(h.documentId, h.pageStart) })),
      };
      const text =
        structured.hits.length === 0
          ? `No chunk matched (searched terms: ${structured.searchedTerms.join(", ") || "none"}). The documents may not contain this.`
          : JSON.stringify(structured, null, 2);
      return { content: [{ type: "text", text }], structuredContent: structured };
    },
  );

  server.registerTool(
    "get_chunk",
    {
      title: "Get a chunk verbatim",
      description:
        "Return the full verbatim text of one chunk with its document and page range, so a quote can be checked against the source PDF.",
      inputSchema: { chunkId: z.string().regex(/^doc_[a-z0-9_]+:c\d{3}$/) },
      outputSchema: {
        chunkId: z.string(),
        documentId: z.string(),
        documentName: z.string(),
        pageStart: z.number().int(),
        pageEnd: z.number().int(),
        section: z.string().nullable(),
        content: z.string(),
        sourceUrl: z.string().nullable(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ chunkId }) => {
      const chunk = chunkById.get(chunkId);
      if (!chunk) {
        return { isError: true, content: [{ type: "text", text: `UNKNOWN_CHUNK: ${chunkId}` }] };
      }
      const structured = {
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        section: chunk.section ?? null,
        content: chunk.content,
        sourceUrl: pdfUrl(chunk.documentId, chunk.pageStart),
      };
      return { content: [{ type: "text", text: JSON.stringify(structured, null, 2) }], structuredContent: structured };
    },
  );

  server.registerTool(
    "compare_products",
    {
      title: "Deterministic product comparison draft",
      description:
        "Build the same 13-row comparison draft as the web app for two fictional products, optionally in the context of a synthetic client case (DEMO-2026-001..003). Generated entirely by code: every factual cell carries a document, page and verbatim quote. It never ranks the products or recommends one.",
      inputSchema: {
        productAId: docIdSchema,
        productBId: docIdSchema,
        clientCaseId: z.string().min(1).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ productAId, productBId, clientCaseId }) => {
      const productA = catalog.products.find((p) => p.documentId === productAId);
      const productB = catalog.products.find((p) => p.documentId === productBId);
      if (!productA || !productB) {
        return { isError: true, content: [{ type: "text", text: "UNKNOWN_PRODUCT: see list_documents" }] };
      }
      if (productA.documentId === productB.documentId) {
        return { isError: true, content: [{ type: "text", text: "DUPLICATE_PRODUCT: choose two different products" }] };
      }
      const syntheticCase = clientCaseId ? catalog.cases.find((c) => c.caseId === clientCaseId) : null;
      if (clientCaseId && !syntheticCase) {
        return { isError: true, content: [{ type: "text", text: `UNKNOWN_CLIENT: ${clientCaseId}` }] };
      }
      const draft = withCitationUrls(
        compareProducts({
          productA,
          productB,
          chunksByDocumentId: catalog.chunksByDocumentId,
          syntheticCase: syntheticCase ?? null,
        }),
        catalog.fileByDocumentId,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(draft, null, 2) }],
        structuredContent: draft as unknown as Record<string, unknown>,
      };
    },
  );

  return server;
}

async function main(): Promise<void> {
  const catalog = await readComparisonCatalog(process.cwd());
  const server = createAgentDeskMcpServer(catalog, process.env.AGENTDESK_BASE_URL ?? DEFAULT_BASE_URL);
  await server.connect(new StdioServerTransport());
  // stdout is the protocol channel; diagnostics go to stderr only.
  console.error("agentdesk MCP server ready (stdio, read-only)");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
