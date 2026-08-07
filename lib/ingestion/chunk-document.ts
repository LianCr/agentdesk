import { createHash } from "node:crypto";
import type { ProductDefinition } from "../schemas.js";
import { normalizeText } from "../pdf-text.js";
import { footerText } from "../../data/fictional-products/templates/layout.js";
import type { StructuredPage, ExtractedLine } from "./extract-pages.js";
import { cleanPage, type CleanedPage } from "./clean-page.js";
import type { ChunkRecord, ChunkType, PageRecord, SourceMetadata } from "./types.js";

// Heading/table/disclosure-aware chunking driven by deterministic font-size
// rules measured from the generated PDFs (page heading 15pt, subsection
// 11.5pt, body/table 10.5pt, fine print 8.5pt). No LLM, no generic splitter.
// Chunks are an ordered partition of each page's clean lines: content is
// verbatim, nothing is rewritten, and every line lands in exactly one chunk.

const PAGE_HEADING_MIN = 14;
const SUB_HEADING_MIN = 11.2;
const FINE_MAX = 9.5;
const MIN_CHUNK_CHARS = 40;
const MAX_CHUNK_CHARS = 2000;

type LineKind = "pageHeading" | "subHeading" | "body" | "fine";

function classifyLine(line: ExtractedLine): LineKind {
  if (line.height >= PAGE_HEADING_MIN) return "pageHeading";
  if (line.height >= SUB_HEADING_MIN) return "subHeading";
  if (line.height <= FINE_MAX) return "fine";
  return "body";
}

const NUMERIC_TOKEN = /^\$?\d[\d,]*(\.\d+)?%?\+?$/;

// A table line has >=3 columns and is dominated by numeric cells. Prose with
// embedded figures ("10% of account value per contract year") stays text.
export function isTableLine(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return false;
  const numeric = tokens.filter((t) => NUMERIC_TOKEN.test(t)).length;
  return numeric / tokens.length >= 0.5;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function contentHashOf(content: string): string {
  return sha256(normalizeText(content));
}

interface Block {
  type: ChunkType;
  lineIdx: number[]; // indices into the page's clean lines (partition bookkeeping)
  section: string;
}

interface PageChunkingResult {
  blocks: Block[];
  hasTable: boolean;
  hasDisclosure: boolean;
}

function chunkCoverPage(cleaned: CleanedPage): PageChunkingResult {
  return {
    blocks: [
      { type: "text", lineIdx: cleaned.lines.map((_, i) => i), section: "Cover" },
    ],
    hasTable: false,
    hasDisclosure: cleaned.lines.some((l) => l.height <= FINE_MAX),
  };
}

function chunkContentPage(cleaned: CleanedPage, expectedHeading: string): PageChunkingResult {
  const lines = cleaned.lines;
  const kinds = lines.map(classifyLine);

  const headingIdx = kinds.flatMap((k, i) => (k === "pageHeading" ? [i] : []));
  if (headingIdx.length !== 1) {
    throw new Error(`page ${cleaned.page}: expected exactly 1 page heading, found ${headingIdx.length}`);
  }
  const h2Idx = headingIdx[0]!;
  const h2 = lines[h2Idx]!.text;
  if (h2 !== expectedHeading) {
    throw new Error(
      `page ${cleaned.page}: detected heading "${h2}" != page outline title "${expectedHeading}"`,
    );
  }

  // Guard against flowed content: the last line of a page must not look like
  // a cut-off continuation (fixed-page templates guarantee this today).
  const lastLine = lines[lines.length - 1]!.text;
  if (/[,\-–—(]$/.test(lastLine)) {
    throw new Error(`page ${cleaned.page}: last line looks like a truncated continuation: "${lastLine}"`);
  }

  // Identify table runs: >=2 consecutive numeric-dense body lines.
  const inTableRun = new Array<boolean>(lines.length).fill(false);
  for (let i = 0; i < lines.length; ) {
    if (kinds[i] === "body" && isTableLine(lines[i]!.text)) {
      let j = i;
      while (j < lines.length && kinds[j] === "body" && isTableLine(lines[j]!.text)) j++;
      if (j - i >= 2) for (let k = i; k < j; k++) inTableRun[k] = true;
      i = j;
    } else i++;
  }

  const blocks: Block[] = [];
  let currentSub: string | null = null;
  let current: Block | null = null;
  const sectionName = (): string => (currentSub ? `${h2} > ${currentSub}` : h2);

  for (let i = 0; i < lines.length; i++) {
    if (i === h2Idx) continue; // prepended to the page's first block below
    const kind = kinds[i]!;

    if (inTableRun[i]) {
      // Start of a table block: absorb an immediately preceding subheading as
      // caption (it may already be the open block's only line) and trailing
      // fine-print note lines.
      if (!inTableRun[i - 1]!) {
        const idx: number[] = [];
        if (current && current.type === "text" && current.lineIdx.length === 1 && kinds[current.lineIdx[0]!] === "subHeading") {
          idx.push(...current.lineIdx);
          blocks.pop();
        }
        current = { type: "table", lineIdx: idx, section: sectionName() };
        blocks.push(current);
      }
      current!.lineIdx.push(i);
      continue;
    }

    if (kind === "fine") {
      if (current?.type === "table") {
        current.lineIdx.push(i); // table note stays with its table
      } else if (current?.type === "disclosure") {
        current.lineIdx.push(i);
      } else {
        current = { type: "disclosure", lineIdx: [i], section: sectionName() };
        blocks.push(current);
      }
      continue;
    }

    if (kind === "subHeading") {
      currentSub = lines[i]!.text;
      current = { type: "text", lineIdx: [i], section: sectionName() };
      blocks.push(current);
      continue;
    }

    // body
    if (current?.type === "text") {
      current.lineIdx.push(i);
    } else {
      current = { type: "text", lineIdx: [i], section: sectionName() };
      blocks.push(current);
    }
  }

  if (blocks.length === 0) throw new Error(`page ${cleaned.page}: no content blocks`);
  blocks[0]!.lineIdx.unshift(h2Idx);

  // Merge undersized blocks into their neighbor (never splitting a table).
  const contentLen = (b: Block): number =>
    normalizeText(b.lineIdx.map((i) => lines[i]!.text).join("\n")).length;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks.length > 1 && contentLen(blocks[i]!) < MIN_CHUNK_CHARS && blocks[i]!.type !== "table") {
      const target = blocks[i - 1] ?? blocks[i + 1]!;
      if (i > 0) target.lineIdx.push(...blocks[i]!.lineIdx);
      else target.lineIdx.unshift(...blocks[i]!.lineIdx);
      blocks.splice(i, 1);
    }
  }

  // Oversized non-table blocks split at line boundaries (not triggered by the
  // current corpus, but the rule exists and is unit-tested).
  const finalBlocks: Block[] = [];
  for (const b of blocks) {
    if (b.type === "table" || contentLen(b) <= MAX_CHUNK_CHARS) {
      finalBlocks.push(b);
      continue;
    }
    let part: number[] = [];
    let partLen = 0;
    for (const idx of b.lineIdx) {
      const len = lines[idx]!.text.length + 1;
      if (partLen + len > MAX_CHUNK_CHARS && part.length > 0) {
        finalBlocks.push({ type: b.type, lineIdx: part, section: b.section });
        part = [];
        partLen = 0;
      }
      part.push(idx);
      partLen += len;
    }
    if (part.length > 0) finalBlocks.push({ type: b.type, lineIdx: part, section: b.section });
  }

  return {
    blocks: finalBlocks,
    hasTable: finalBlocks.some((b) => b.type === "table"),
    hasDisclosure: lines.some((l) => l.height <= FINE_MAX),
  };
}

export interface DocumentRecords {
  pageRecords: PageRecord[];
  chunkRecords: ChunkRecord[];
}

export function sourceMetadataOf(product: ProductDefinition): SourceMetadata {
  return {
    documentId: product.documentId,
    documentName: product.documentName,
    productName: product.productName,
    productCategory: product.productCategory,
    carrierId: product.carrier.id,
    carrierName: product.carrier.legalName,
    jurisdiction: product.jurisdiction,
    effectiveDate: product.effectiveDate,
    sourceFile: product.fileName,
  };
}

// Table pages declared in products.json — the chunker's output must produce
// exactly one table chunk on each of these pages and nowhere else.
export function declaredTablePages(product: ProductDefinition): number[] {
  const f = product.facts as Record<string, any>;
  return [f.samplePremiums?.tablePage, f.surrenderChargeSchedule?.tablePage]
    .filter((p): p is number => typeof p === "number")
    .sort((a, b) => a - b);
}

export function buildDocumentRecords(
  product: ProductDefinition,
  structuredPages: StructuredPage[],
): DocumentRecords {
  if (structuredPages.length !== product.pages) {
    throw new Error(
      `${product.documentId}: extracted ${structuredPages.length} pages, products.json declares ${product.pages}`,
    );
  }
  const meta = sourceMetadataOf(product);
  const outlineByPage = new Map(product.pageOutline.map((p) => [p.page, p.title]));

  const pageRecords: PageRecord[] = [];
  const chunkRecords: ChunkRecord[] = [];
  let chunkIndex = 0;
  const tablePagesFound: number[] = [];

  for (const structured of structuredPages) {
    const expectedFooter = footerText(product.carrier.displayName, structured.page, product.pages);
    const cleaned = cleanPage(structured, expectedFooter);
    const isCover = structured.page === 1;
    const outlineTitle = outlineByPage.get(structured.page);
    if (!outlineTitle) throw new Error(`${product.documentId}: no outline entry for page ${structured.page}`);

    const result = isCover ? chunkCoverPage(cleaned) : chunkContentPage(cleaned, outlineTitle);

    // Partition invariant: every clean line lands in exactly one block.
    const consumed = result.blocks.flatMap((b) => b.lineIdx).sort((a, b) => a - b);
    const expected = cleaned.lines.map((_, i) => i);
    if (JSON.stringify(consumed) !== JSON.stringify(expected)) {
      throw new Error(
        `${product.documentId} page ${structured.page}: chunk line partition broken ` +
          `(consumed ${consumed.length}/${expected.length} lines)`,
      );
    }

    const cleanTextHash = sha256(normalizeText(cleaned.cleanText));
    pageRecords.push({
      schemaVersion: 1,
      ...meta,
      page: structured.page,
      rawText: cleaned.rawText,
      cleanText: cleaned.cleanText,
      detectedHeading: isCover ? null : outlineTitle,
      hasTable: result.hasTable,
      hasDisclosure: result.hasDisclosure,
      rawTextHash: sha256(normalizeText(cleaned.rawText)),
      cleanTextHash,
      excludedText: cleaned.excludedText,
    });

    if (result.hasTable) tablePagesFound.push(structured.page);

    for (const block of result.blocks) {
      const content = block.lineIdx.map((i) => cleaned.lines[i]!.text).join("\n");
      chunkRecords.push({
        schemaVersion: 1,
        ...meta,
        chunkId: `${product.documentId}:c${String(chunkIndex).padStart(3, "0")}`,
        pageStart: structured.page,
        pageEnd: structured.page,
        section: block.section,
        chunkIndex,
        chunkType: block.type,
        content,
        contentHash: contentHashOf(content),
        sourcePageHashes: [cleanTextHash],
      });
      chunkIndex++;
    }
  }

  const declared = declaredTablePages(product);
  if (JSON.stringify(tablePagesFound) !== JSON.stringify(declared)) {
    throw new Error(
      `${product.documentId}: table chunks on pages [${tablePagesFound}] but products.json declares [${declared}]`,
    );
  }
  const tableChunkCount = chunkRecords.filter((c) => c.chunkType === "table").length;
  if (tableChunkCount !== declared.length) {
    throw new Error(
      `${product.documentId}: ${tableChunkCount} table chunks != ${declared.length} declared tables`,
    );
  }

  return { pageRecords, chunkRecords };
}
