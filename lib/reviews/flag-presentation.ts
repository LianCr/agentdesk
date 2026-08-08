import type { ReviewFlag } from "../comparison/types";

// Single presentation source for review flags.
//
// The comparison page, the review page and the CLI must not disagree about
// what a flag means -- a reviewer who sees one wording on the draft and a
// different one on the review is being shown two systems. This module is
// deliberately a leaf: a type-only import and plain data, so the browser can
// use it without pulling any server module or zod schema into the bundle.
//
// Two kinds of flag, and the distinction matters (CLAUDE.md red line 8): a
// Demo business rule is this project's policy for fictional products, not a
// universal legal requirement.

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
