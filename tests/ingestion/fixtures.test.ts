import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ProductCatalogSchema, ManifestSchema, type ProductDefinition } from "../../lib/schemas.js";
import {
  DerivedChunksFileSchema,
  DerivedPagesFileSchema,
  type ChunkRecord,
  type PageRecord,
} from "../../lib/ingestion/types.js";
import { extractStructuredPages } from "../../lib/ingestion/extract-pages.js";
import { buildDocumentRecords } from "../../lib/ingestion/chunk-document.js";
import { normalizeText } from "../../lib/pdf-text.js";
import { usd, intPercent } from "../../lib/format.js";
import { DEMO_MARK } from "../../data/fictional-products/templates/layout.js";

// Fixture tests against the committed data/derived output of the three real
// product PDFs (test matrix items 11-23 and 57).

const ROOT = join(import.meta.dirname, "../..");

let products: ProductDefinition[];
let manifest: ReturnType<typeof ManifestSchema.parse>;
const pagesById = new Map<string, PageRecord[]>();
const chunksById = new Map<string, ChunkRecord[]>();

beforeAll(() => {
  products = ProductCatalogSchema.parse(
    JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
  ).products;
  manifest = ManifestSchema.parse(
    JSON.parse(readFileSync(join(ROOT, "data/fictional-products/manifest.json"), "utf8")),
  );
  for (const p of products) {
    pagesById.set(
      p.documentId,
      DerivedPagesFileSchema.parse(
        JSON.parse(readFileSync(join(ROOT, `data/derived/pages/${p.documentId}.pages.json`), "utf8")),
      ).pages,
    );
    chunksById.set(
      p.documentId,
      DerivedChunksFileSchema.parse(
        JSON.parse(readFileSync(join(ROOT, `data/derived/chunks/${p.documentId}.chunks.json`), "utf8")),
      ).chunks,
    );
  }
});

function chunksOf(id: string): ChunkRecord[] {
  return chunksById.get(id)!;
}
function tableChunk(id: string, page: number): ChunkRecord {
  const t = chunksOf(id).filter((c) => c.chunkType === "table" && c.pageStart === page);
  expect(t).toHaveLength(1);
  return t[0]!;
}
function someChunkContains(id: string, needle: string, page?: number): ChunkRecord {
  const hit = chunksOf(id).find(
    (c) =>
      (page === undefined || c.pageStart === page) &&
      normalizeText(c.content).includes(normalizeText(needle)),
  );
  expect(hit, `no chunk of ${id}${page ? ` on page ${page}` : ""} contains "${needle}"`).toBeDefined();
  return hit!;
}

describe("derived fixtures vs manifest", () => {
  it("page counts match the manifest for all three documents", () => {
    for (const p of products) {
      const entry = manifest.find((m) => m.documentId === p.documentId)!;
      expect(pagesById.get(p.documentId)).toHaveLength(entry.pages);
    }
  });

  it("every page keeps its correct 1-based page number", () => {
    for (const p of products) {
      expect(pagesById.get(p.documentId)!.map((pg) => pg.page)).toEqual(
        Array.from({ length: p.pages }, (_, i) => i + 1),
      );
    }
  });
});

describe("table chunks", () => {
  it("TermPlus premium table keeps all headers and cells", () => {
    const p = products.find((x) => x.documentId === "doc_termplus20_v1")!;
    const sp = (p.facts as any).samplePremiums;
    const t = tableChunk(p.documentId, sp.tablePage);
    for (const amount of sp.faceAmounts) expect(t.content).toContain(usd(amount));
    for (const row of sp.rows) {
      expect(t.content).toContain(String(row.issueAge));
      for (const premium of row.monthlyPremiums) expect(t.content).toContain(usd(premium));
    }
    expect(normalizeText(t.content)).toContain(
      normalizeText("Rates after the level period are not shown here"),
    );
  });

  it("IndexFlex surrender charge schedule is complete", () => {
    const p = products.find((x) => x.documentId === "doc_indexflex_ul_v1")!;
    const s = (p.facts as any).surrenderChargeSchedule;
    const t = tableChunk(p.documentId, s.tablePage);
    for (const charge of s.chargesByYear) expect(t.content).toContain(usd(charge));
    expect(t.content).toContain(usd(s.afterYear10));
    expect(t.content).toContain("11+");
  });

  it("SecureRate surrender charge schedule is complete", () => {
    const p = products.find((x) => x.documentId === "doc_securerate5_v1")!;
    const s = (p.facts as any).surrenderChargeSchedule;
    const t = tableChunk(p.documentId, s.tablePage);
    for (const charge of s.chargesByYearPercent) expect(t.content).toContain(intPercent(charge));
    expect(t.content).toContain(intPercent(s.afterYear7Percent));
    expect(t.content).toContain("8+");
  });
});

describe("critical facts survive chunking intact", () => {
  it("negative fact: SecureRate offers no optional riders", () => {
    const c = someChunkContains("doc_securerate5_v1", "This product does not offer optional riders.");
    expect(c.pageStart).toBe(5);
  });

  it("negative fact: TermPlus does not accumulate cash value", () => {
    someChunkContains("doc_termplus20_v1", "does not accumulate cash value", 2);
  });

  it("TermPlus attained-age renewal explanation is intact", () => {
    const c = someChunkContains(
      "doc_termplus20_v1",
      "annually renewable at attained-age rates that increase each year",
      4,
    );
    expect(normalizeText(c.content)).toContain("level and guaranteed for 20 years");
  });

  it("IndexFlex current vs guaranteed values share one chunk", () => {
    const c = someChunkContains("doc_indexflex_ul_v1", "9.50% current", 5);
    const text = normalizeText(c.content);
    expect(text).toContain("guaranteed minimum cap 3.00%");
    expect(text).toContain("100% current");
    expect(text).toContain("guaranteed minimum 50%");
    expect(text).toContain("0.00% guaranteed");
  });

  it("SecureRate 5-year rate guarantee and 7-year surrender schedule both survive", () => {
    someChunkContains("doc_securerate5_v1", "guaranteed for the first five contract years", 3);
    const t = tableChunk("doc_securerate5_v1", 4);
    expect(t.content).toContain("Contract Year 1 2 3 4 5 6 7 8+");
  });
});

describe("cleaning boundaries", () => {
  it("the per-page footer never enters any chunk", () => {
    const footerMark = normalizeText(DEMO_MARK) + " |";
    for (const p of products) {
      for (const c of chunksOf(p.documentId)) {
        expect(normalizeText(c.content)).not.toContain(footerMark);
      }
    }
  });

  it("intentional omissions do not appear in any chunk", () => {
    for (const p of products) {
      for (const om of p.omissionPatterns) {
        const flags = om.flags ?? "";
        const re = new RegExp(om.pattern, flags.includes("g") ? flags : flags + "g");
        for (const c of chunksOf(p.documentId)) {
          expect(normalizeText(c.content)).not.toMatch(re);
        }
      }
    }
  });

  it(".env is git-ignored (never trackable)", () => {
    const out = execSync("git check-ignore .env || true", { cwd: ROOT }).toString().trim();
    expect(out).toBe(".env");
  });
});

describe("reproducibility", () => {
  it("re-deriving from the PDF matches the committed fixtures", async () => {
    const p = products.find((x) => x.documentId === "doc_termplus20_v1")!;
    const structured = await extractStructuredPages(
      join(ROOT, "data/fictional-products/generated", p.fileName),
    );
    const a = buildDocumentRecords(p, structured);
    const b = buildDocumentRecords(p, structured);
    expect(a).toEqual(b);
    expect(a.chunkRecords.map((c) => ({ id: c.chunkId, hash: c.contentHash }))).toEqual(
      chunksOf(p.documentId).map((c) => ({ id: c.chunkId, hash: c.contentHash })),
    );
  });
});
