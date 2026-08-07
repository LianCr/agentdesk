import { classifyRedlines } from "../rag/redlines";
import type { ProductCategory } from "../schemas";
import { UNKNOWN, type ClientContext, type ComparisonRow, type ReviewFlag } from "./types";

// Code-owned review flags. M4 only RAISES flags; approve / request-changes /
// reject and the workflow decision that can block a client-facing draft are
// M5. A model cannot add, remove or downgrade anything here.
//
// Two kinds of flag, and the distinction matters for how they are described
// to a user (CLAUDE.md red line 8): a Demo business rule is this project's
// policy for fictional products, not a universal legal requirement.

export interface ReviewFlagDefinition {
  flag: ReviewFlag;
  kind: "demo_business_rule" | "document_fact_driven";
  labelZh: string;
  labelEn: string;
}

export const REVIEW_FLAG_DEFINITIONS: Record<ReviewFlag, ReviewFlagDefinition> = {
  CLIENT_FACING_DRAFT: {
    flag: "CLIENT_FACING_DRAFT",
    kind: "demo_business_rule",
    labelZh: "对外文案需人工批准",
    labelEn: "Client-facing use requires human approval",
  },
  NON_GUARANTEED_ELEMENTS: {
    flag: "NON_GUARANTEED_ELEMENTS",
    kind: "document_fact_driven",
    labelZh: "涉及非保证要素",
    labelEn: "Non-guaranteed elements involved",
  },
  ILLUSTRATION_REQUIRED: {
    flag: "ILLUSTRATION_REQUIRED",
    kind: "document_fact_driven",
    labelZh: "需要个性化 illustration",
    labelEn: "Personalized illustration required",
  },
  ANNUITY_CONTEXT: {
    flag: "ANNUITY_CONTEXT",
    kind: "demo_business_rule",
    labelZh: "涉及年金合同",
    labelEn: "Annuity contract involved",
  },
  AGE_65_PLUS: {
    flag: "AGE_65_PLUS",
    kind: "demo_business_rule",
    labelZh: "客户年龄 65 岁及以上(本 Demo 规则)",
    labelEn: "Client age 65+ (Demo policy)",
  },
  REPLACEMENT_CONTEXT: {
    flag: "REPLACEMENT_CONTEXT",
    kind: "demo_business_rule",
    labelZh: "涉及替换现有合同",
    labelEn: "Replacement of an existing contract",
  },
  SURRENDER_CHARGE_EXPOSURE: {
    flag: "SURRENDER_CHARGE_EXPOSURE",
    kind: "document_fact_driven",
    labelZh: "存在退保费用敞口",
    labelEn: "Surrender-charge exposure",
  },
  MARKET_VALUE_ADJUSTMENT_EXPOSURE: {
    flag: "MARKET_VALUE_ADJUSTMENT_EXPOSURE",
    kind: "document_fact_driven",
    labelZh: "存在市场价值调整敞口",
    labelEn: "Market-value-adjustment exposure",
  },
  SPECIFIC_VALUE_REQUEST: {
    flag: "SPECIFIC_VALUE_REQUEST",
    kind: "demo_business_rule",
    labelZh: "客户询问具体收益或价值数字",
    labelEn: "Client asked for specific return or value figures",
  },
};

// Demo-policy age threshold. It comes from the fictional annuity's own
// suitability fact, so it is read from the product rather than hardcoded as a
// legal rule.
function heightenedReviewAge(products: readonly { facts: unknown }[]): number | null {
  for (const product of products) {
    const suitability = (product.facts as { suitability?: { heightenedReviewAge?: unknown } }).suitability;
    if (typeof suitability?.heightenedReviewAge === "number") return suitability.heightenedReviewAge;
  }
  return null;
}

export function computeReviewFlags(args: {
  rows: readonly ComparisonRow[];
  client: ClientContext | null;
  categories: readonly ProductCategory[];
  products: readonly { facts: unknown }[];
}): ReviewFlag[] {
  const flags = new Set<ReviewFlag>();

  // Every comparison draft is internal until a licensed agent approves it.
  flags.add("CLIENT_FACING_DRAFT");

  const available = (dimensionId: string) =>
    args.rows
      .find((r) => r.dimensionId === dimensionId)
      ?.cells.some((c) => c.availability === "available") ?? false;

  if (available("non_guaranteed_elements")) flags.add("NON_GUARANTEED_ELEMENTS");
  if (available("illustration_documentation")) flags.add("ILLUSTRATION_REQUIRED");
  if (args.categories.includes("fixed_annuity")) flags.add("ANNUITY_CONTEXT");
  if (available("surrender_liquidity")) flags.add("SURRENDER_CHARGE_EXPOSURE");

  // MVA is a documented annuity feature, not an inference.
  const mvaDocumented = args.products.some((p) =>
    typeof (p.facts as { marketValueAdjustment?: { display?: unknown } }).marketValueAdjustment?.display === "string",
  );
  if (mvaDocumented) flags.add("MARKET_VALUE_ADJUSTMENT_EXPOSURE");

  if (args.client !== null) {
    const threshold = heightenedReviewAge(args.products);
    if (threshold !== null && args.client.age !== UNKNOWN && args.client.age >= threshold) {
      flags.add("AGE_65_PLUS");
    }
    if (args.client.replacementContext) flags.add("REPLACEMENT_CONTEXT");
    // Reuse the M3 production classifier rather than writing a second set of
    // patterns: a client asking "how much cash value after 20 years" is the
    // same illustration/estimation request the answer pipeline already knows.
    for (const question of args.client.clientQuestions) {
      const redline = classifyRedlines(question);
      if (redline.hard !== null || redline.softFlags.length > 0) {
        flags.add("SPECIFIC_VALUE_REQUEST");
        break;
      }
    }
  }

  // Stable order for deterministic output.
  const ORDER: ReviewFlag[] = [
    "CLIENT_FACING_DRAFT",
    "NON_GUARANTEED_ELEMENTS",
    "ILLUSTRATION_REQUIRED",
    "ANNUITY_CONTEXT",
    "SURRENDER_CHARGE_EXPOSURE",
    "MARKET_VALUE_ADJUSTMENT_EXPOSURE",
    "AGE_65_PLUS",
    "REPLACEMENT_CONTEXT",
    "SPECIFIC_VALUE_REQUEST",
  ];
  return ORDER.filter((flag) => flags.has(flag));
}
