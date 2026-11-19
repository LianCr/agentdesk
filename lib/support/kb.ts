import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { readComparisonCatalog } from "../comparison/catalog-files";
import { buildLexicalIndex, type LexicalIndex, type SearchableChunk } from "../knowledge/lexical-search";

// The triage knowledge base: the 45 frozen product-guide chunks plus a small,
// committed, SYNTHETIC help center (data/support-kb/articles.json) describing
// how AgentDesk itself behaves. Both go into one BM25 index — the same
// lexical search the MCP server uses — so triage is offline, deterministic and
// costs nothing. It is not the web app's pgvector retrieval.

export const SupportKbFileSchema = z.object({
  schemaVersion: z.literal(1),
  synthetic: z.literal(true),
  notice: z.string().min(1),
  articles: z
    .array(
      z.object({
        articleId: z.string().regex(/^kb_[a-z0-9_]+$/),
        title: z.string().min(1),
        sections: z.array(z.object({ heading: z.string().min(1), content: z.string().min(1) })).min(1),
      }),
    )
    .min(1),
});
export type SupportKbFile = z.infer<typeof SupportKbFileSchema>;

export type PassageSourceType = "product_guide" | "help_article";

export type Passage = SearchableChunk & {
  sourceType: PassageSourceType;
  /** Tables are quoted whole: a row torn out of its header misleads. */
  chunkType: "text" | "table" | "disclosure" | "help";
  url: string | null;
};

export interface TriageCorpus {
  index: LexicalIndex;
  passages: Map<string, Passage>;
}

export const HELP_CENTER_NAME = "AgentDesk Help Center (synthetic)";

export function helpArticlePassages(kb: SupportKbFile): Passage[] {
  return kb.articles.flatMap((article) =>
    article.sections.map((section, i) => ({
      chunkId: `${article.articleId}:s${String(i + 1).padStart(2, "0")}`,
      documentId: article.articleId,
      documentName: article.title,
      productName: HELP_CENTER_NAME,
      pageStart: 1,
      pageEnd: 1,
      // The title is indexed with the heading: it is how people phrase the question.
      section: `${article.title} ${section.heading}`,
      content: section.content,
      sourceType: "help_article" as const,
      chunkType: "help" as const,
      url: null,
    })),
  );
}

export function buildTriageCorpus(passages: Passage[]): TriageCorpus {
  return { index: buildLexicalIndex(passages), passages: new Map(passages.map((p) => [p.chunkId, p])) };
}

export async function readSupportKb(root: string): Promise<SupportKbFile> {
  return SupportKbFileSchema.parse(JSON.parse(await readFile(join(root, "data/support-kb/articles.json"), "utf8")));
}

/** Reads the committed product chunks and help center from disk. */
export async function loadTriageCorpus(root: string): Promise<TriageCorpus> {
  const [catalog, kb] = await Promise.all([readComparisonCatalog(root), readSupportKb(root)]);
  const product: Passage[] = Object.values(catalog.chunksByDocumentId)
    .flat()
    .map((c) => {
      const file = catalog.fileByDocumentId.get(c.documentId);
      return {
        chunkId: c.chunkId,
        documentId: c.documentId,
        documentName: c.documentName,
        productName: c.productName,
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
        section: c.section,
        content: c.content,
        sourceType: "product_guide" as const,
        chunkType: c.chunkType,
        url: file ? `/documents/${file}#page=${c.pageStart}` : null,
      };
    });
  return buildTriageCorpus([...product, ...helpArticlePassages(kb)]);
}

let cached: Promise<TriageCorpus> | null = null;

/** Process-cached corpus for the app (files are immutable at runtime). */
export function triageCorpus(): Promise<TriageCorpus> {
  cached ??= loadTriageCorpus(process.cwd()).catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}
