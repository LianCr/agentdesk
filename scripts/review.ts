import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createServiceClient } from "../lib/supabase/server";
import { DerivedChunksFileSchema, type ChunkRecord } from "../lib/ingestion/types";
import { ProductCatalogSchema, SyntheticCaseSchema, type SyntheticCase } from "../lib/schemas";
import { createReview } from "../lib/reviews/create-review";
import { listReviewEvents } from "../lib/supabase/reviews-repository";
import { REVIEW_FLAG_DEFINITIONS } from "../lib/comparison/review";
import type { ReviewFlag } from "../lib/comparison/types";
import { UNKNOWN } from "../lib/comparison/types";

// Gate B acceptance tool: turn a product pair (and optionally a demo client)
// into a persisted review item, and print what a reviewer would be handed.
// No model is involved. The full snapshot is not dumped unless --debug asks,
// and even then only its structure summary — a terminal is not an audit log.
//
//   npm run review -- --a=doc_securerate5_v1 --b=doc_indexflex_ul_v1 --case=DEMO-2026-003

const ROOT = process.cwd();

function parseArgs(argv: string[]) {
  const get = (key: string): string | null => {
    const found = argv.find((a) => a.startsWith(`--${key}=`));
    return found ? found.slice(key.length + 3) : null;
  };
  const a = get("a");
  const b = get("b");
  if (!a || !b) {
    throw new Error("usage: npm run review -- --a=<documentId> --b=<documentId> [--case=<caseId>] [--debug]");
  }
  return { a, b, caseId: get("case"), debug: argv.includes("--debug") };
}

const APPROVAL_LABEL: Record<string, string> = {
  not_required_for_internal_view: "内部查看无需审批 No approval needed for internal viewing",
  standard_approval: "标准审批 Standard approval",
  enhanced_review: "强化审核 Enhanced review",
  licensed_agent_required: "需持牌经纪人 Licensed agent required",
  blocked: "无法批准 Blocked",
};

const DECISION_LABEL: Record<string, string> = {
  allow_internal_draft: "允许内部草稿 Internal draft allowed",
  allow_checklist_only: "仅允许核对清单 Checklist only",
  block_client_draft: "禁止对外草稿 Client-facing draft blocked",
};

const STATE_LABEL: Record<string, string> = {
  pending_review: "待审核 Pending review",
  approved: "已批准 Approved",
  rejected: "已拒绝 Rejected",
  revision_requested: "要求修改 Revision requested",
};

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  const catalog = ProductCatalogSchema.parse(
    JSON.parse(await readFile(join(ROOT, "data/fictional-products/products.json"), "utf8")),
  );
  const chunksByDocumentId: Record<string, ChunkRecord[]> = {};
  for (const product of catalog.products) {
    chunksByDocumentId[product.documentId] = DerivedChunksFileSchema.parse(
      JSON.parse(await readFile(join(ROOT, `data/derived/chunks/${product.documentId}.chunks.json`), "utf8")),
    ).chunks;
  }
  const caseDir = join(ROOT, "data/synthetic-cases");
  const cases: SyntheticCase[] = [];
  for (const file of (await readdir(caseDir)).sort()) {
    if (file.endsWith(".json")) {
      cases.push(SyntheticCaseSchema.parse(JSON.parse(await readFile(join(caseDir, file), "utf8"))));
    }
  }

  const db = createServiceClient();
  const result = await createReview(
    { db, products: catalog.products, chunksByDocumentId, cases },
    { productAId: args.a, productBId: args.b, clientCaseId: args.caseId },
  );
  const item = result.reviewItem;
  const snapshot = item.snapshot as {
    productA: { productName: string };
    productB: { productName: string };
    clientContext: { displayName: string; caseId: string; age: number | string; replacementContext: boolean } | null;
    comparisonStatus: string;
    dimensions: unknown[];
  };

  console.log(`\n审核项 Review item  ${item.reviewId}`);
  console.log(`结果 Action: ${result.action === "created" ? "新建 created" : "已存在待审 existing pending"}`);
  console.log(`来源键 Source key: ${item.sourceKey}`);
  console.log(`\nA: ${snapshot.productA.productName}`);
  console.log(`B: ${snapshot.productB.productName}`);
  if (snapshot.clientContext) {
    const c = snapshot.clientContext;
    console.log(
      `客户 Client: ${c.displayName} (${c.caseId})  年龄 age ${c.age === UNKNOWN ? "未知 unknown" : c.age}` +
        `${c.replacementContext ? "  · 替换情形 replacement context" : ""}`,
    );
  } else {
    console.log("客户 Client: 未绑定 none (product-only comparison)");
  }

  console.log(`\n事实状态 Comparison status: ${snapshot.comparisonStatus} (${snapshot.dimensions.length} dimensions)`);
  console.log(`工作流决策 Workflow decision: ${DECISION_LABEL[item.workflowDecision] ?? item.workflowDecision}`);
  console.log(`所需审批 Required approval: ${APPROVAL_LABEL[item.requiredApprovalLevel] ?? item.requiredApprovalLevel}`);
  console.log(`审核状态 Review state: ${STATE_LABEL[item.reviewState] ?? item.reviewState}`);

  console.log("\n触发理由 Review reasons");
  if (item.reviewReasons.length === 0) console.log("  (none)");
  for (const flag of item.reviewReasons as ReviewFlag[]) {
    const definition = REVIEW_FLAG_DEFINITIONS[flag];
    const kind = definition.kind === "demo_business_rule" ? "本 Demo 规则 demo policy" : "文档事实 document fact";
    console.log(`  ${flag} — ${definition.labelZh} / ${definition.labelEn}  (${kind})`);
  }

  console.log("\n核对清单 Review checklist");
  if (item.checklist.length === 0) console.log("  (none)");
  for (const entry of item.checklist) {
    console.log(`  [${entry.sourceKind}] ${entry.labelZh} / ${entry.labelEn}`);
  }

  console.log(`\n快照 Snapshot SHA-256: ${item.snapshotSha256}`);
  if (args.debug) {
    // Structure only. The snapshot itself belongs in the review UI, not stdout.
    console.log(`  dimensions: ${snapshot.dimensions.length}`);
    console.log(`  bytes: ${JSON.stringify(item.snapshot).length}`);
  }

  const events = await listReviewEvents(db, item.reviewId);
  console.log("\n审计事件 Audit events");
  for (const event of events) {
    console.log(`  ${event.occurredAt}  ${event.eventType}  ${event.actor}`);
  }

  console.log(
    "\n本审核项仅供内部工作流使用,不构成推荐、适合性判断、报价或法律税务意见。" +
      "\nThis review item is for the internal demo workflow only. It is not a recommendation, a suitability determination, a quote, or legal or tax advice.",
  );
  console.log("本演示没有登录,reviewer 仅为占位标识。No authentication exists in this demo; `reviewer` is a placeholder label.");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    // Codes only — never dump snapshots, prompts or environment values.
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
