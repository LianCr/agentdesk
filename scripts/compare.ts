import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { DerivedChunksFileSchema, type ChunkRecord } from "../lib/ingestion/types";
import { ProductCatalogSchema, SyntheticCaseSchema, type SyntheticCase } from "../lib/schemas";
import { compareProducts } from "../lib/comparison/compare";
import { attachNarrative } from "../lib/comparison/narrative";
import { REVIEW_FLAG_DEFINITIONS } from "../lib/comparison/review";
import { UNKNOWN, type ComparisonDraft } from "../lib/comparison/types";

// Gate B acceptance tool. The deterministic comparison needs no model and no
// database: pass --narrative to additionally ask the answer model for a
// neutral explanation, which is optional by design and never blocks the table.
//
// Usage:
//   npm run compare -- --a=doc_termplus20_v1 --b=doc_indexflex_ul_v1
//   npm run compare -- --a=doc_securerate5_v1 --b=doc_indexflex_ul_v1 --case=DEMO-2026-003
//   npm run compare -- --a=... --b=... --narrative

const ROOT = process.cwd();

interface Args {
  a: string;
  b: string;
  caseId: string | null;
  narrative: boolean;
  language: "zh" | "en" | null;
}

function parseArgs(argv: string[]): Args {
  const get = (key: string): string | null => {
    const found = argv.find((arg) => arg.startsWith(`--${key}=`));
    return found ? found.slice(key.length + 3) : null;
  };
  const a = get("a");
  const b = get("b");
  if (!a || !b) {
    throw new Error("usage: npm run compare -- --a=<documentId> --b=<documentId> [--case=<caseId>] [--narrative] [--language=zh|en]");
  }
  const language = get("language");
  return {
    a,
    b,
    caseId: get("case"),
    narrative: argv.includes("--narrative"),
    language: language === "zh" || language === "en" ? language : null,
  };
}

async function loadCase(caseId: string): Promise<SyntheticCase> {
  const dir = join(ROOT, "data/synthetic-cases");
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".json")) continue;
    const parsed = SyntheticCaseSchema.parse(JSON.parse(await readFile(join(dir, file), "utf8")));
    if (parsed.caseId === caseId) return parsed;
  }
  throw new Error(`unknown case ${caseId}`);
}

const STATUS_LABEL: Record<ComparisonDraft["comparisonStatus"], string> = {
  complete: "完整 complete",
  partial: "部分 partial — some non-core facts could not be verified",
  blocked: "已阻断 BLOCKED — a core fact could not be verified; do not rely on this table",
};

const AVAILABILITY_LABEL: Record<string, string> = {
  available: "有据 documented",
  not_applicable: "不适用 not applicable",
  not_provided: "资料未提供 not provided",
  conflict: "冲突 CONFLICT",
};

function printDraft(draft: ComparisonDraft): void {
  console.log(`\n产品比较草稿 Comparison draft  ${draft.comparisonId}`);
  console.log(`A: ${draft.productA.productName} (${draft.productA.productCategory})`);
  console.log(`B: ${draft.productB.productName} (${draft.productB.productCategory})`);
  console.log(`状态 Status: ${STATUS_LABEL[draft.comparisonStatus]}`);

  if (draft.clientContext) {
    const c = draft.clientContext;
    console.log(`\n客户 Client: ${c.displayName} (${c.caseId})`);
    const fields: Array<[string, unknown]> = [
      ["age", c.age],
      ["dependents", c.dependents],
      ["goal", c.primaryGoal],
      ["budget/month", c.budgetMonthly],
      ["coverage horizon", c.coverageHorizon],
      ["existing coverage", c.existingCoverageNote],
      ["replacement context", c.replacementContext],
    ];
    for (const [label, value] of fields) {
      console.log(`  ${label.padEnd(20)} ${value === UNKNOWN ? "未知 unknown" : String(value)}`);
    }
  } else {
    console.log("\n客户 Client: 未绑定 (纯产品比较) none — product-only comparison");
  }

  console.log("\n比较表 Comparison table");
  for (const row of draft.dimensions) {
    console.log(`\n  ${row.labelZh} / ${row.labelEn}${row.core ? "  [core]" : ""}`);
    for (const cell of row.cells) {
      const product = cell.productId === draft.productA.documentId ? draft.productA : draft.productB;
      const value = cell.availability === "conflict" ? `(${cell.conflictReason ?? "conflict"})` : cell.displayValue;
      console.log(`    ${product.productName}: [${AVAILABILITY_LABEL[cell.availability]}] ${value ?? "—"}`);
      for (const citation of cell.citations) {
        console.log(`        ↳ ${citation.documentName}, page ${citation.pageStart} — "${citation.quote.slice(0, 90)}"`);
      }
    }
  }

  console.log("\n已记录的观察 Documented observations");
  if (draft.observations.length === 0) console.log("  (none)");
  for (const observation of draft.observations) {
    console.log(`  [${observation.severity}] ${observation.type}`);
    console.log(`    ${observation.textZh}`);
    console.log(`    ${observation.textEn}`);
    console.log(`    sources: ${observation.citationIds.join(", ")}`);
  }

  console.log("\n缺失的客户信息 Missing client information");
  if (draft.missingClientInformation.length === 0) console.log("  (none)");
  for (const item of draft.missingClientInformation) {
    console.log(`  ${item.field} (${item.requiredFor})`);
    console.log(`    ${item.reasonZh}`);
    console.log(`    ${item.reasonEn}`);
  }

  console.log("\n需要人工审核 Review flags");
  for (const flag of draft.reviewReasons) {
    const definition = REVIEW_FLAG_DEFINITIONS[flag];
    const kind = definition.kind === "demo_business_rule" ? "Demo 业务规则 demo policy" : "文档事实 document fact";
    console.log(`  ${flag} — ${definition.labelZh} / ${definition.labelEn}  (${kind})`);
  }

  console.log(`\n说明 Narrative: ${draft.narrativeStatus}${draft.narrativeRejectionReason ? ` (${draft.narrativeRejectionReason})` : ""}`);
  for (const section of draft.narrativeSections) {
    console.log(`\n  ${section.headingZh} / ${section.headingEn}`);
    console.log(`    ${section.text}`);
  }

  console.log(`\n${draft.disclaimerZh}`);
  console.log(draft.disclaimerEn);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const catalog = ProductCatalogSchema.parse(
    JSON.parse(await readFile(join(ROOT, "data/fictional-products/products.json"), "utf8")),
  );
  const find = (documentId: string) => {
    const product = catalog.products.find((p) => p.documentId === documentId);
    if (!product) throw new Error(`unknown product ${documentId}`);
    return product;
  };
  const productA = find(args.a);
  const productB = find(args.b);

  const chunksByDocumentId: Record<string, ChunkRecord[]> = {};
  for (const product of [productA, productB]) {
    chunksByDocumentId[product.documentId] = DerivedChunksFileSchema.parse(
      JSON.parse(await readFile(join(ROOT, `data/derived/chunks/${product.documentId}.chunks.json`), "utf8")),
    ).chunks;
  }

  const syntheticCase = args.caseId ? await loadCase(args.caseId) : null;
  let draft = compareProducts({ productA, productB, chunksByDocumentId, syntheticCase });

  if (args.narrative) {
    const { createAnswerModel, answerModelId } = await import("../lib/ai/client");
    const language = args.language ?? draft.clientContext?.language ?? "zh";
    draft = await attachNarrative(draft, [productA, productB], { model: createAnswerModel() }, language);
    draft = { ...draft, meta: { ...draft.meta, narrativeModel: answerModelId() } };
  }

  printDraft(draft);
  return draft.comparisonStatus === "blocked" ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    // Codes only — never dump chunk content, prompts or environment.
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
