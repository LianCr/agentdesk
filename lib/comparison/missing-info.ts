import type { ProductCategory } from "../schemas";
import type { DimensionId } from "./dimensions";
import { UNKNOWN, type ClientContext, type MissingClientInfo, type MissingInfoField } from "./types";

// Deterministic gaps in what the agent knows about the client, given which
// product categories are being compared.
//
// The rules were reconciled against the synthetic-case fixtures rather than
// invented: every `expected.missingInformation` entry in Demo Client A/B/C
// maps onto a field below. Nothing was added merely because it sounded
// professional — notably there is no unconditional annuity "liquidity needs"
// rule, because no fixture asks for one.

interface Rule {
  field: MissingInfoField;
  reasonZh: string;
  reasonEn: string;
  relevantTo: DimensionId[];
  requiredFor: MissingClientInfo["requiredFor"];
  applies: (ctx: Context) => boolean;
}

interface Context {
  categories: Set<ProductCategory>;
  client: ClientContext;
}

const hasLife = (c: Context) =>
  c.categories.has("term_life") || c.categories.has("indexed_universal_life");
const hasIul = (c: Context) => c.categories.has("indexed_universal_life");

// Employer/group coverage is a different question from an individual policy:
// a case that mentions group coverage still needs the individual picture, and
// a case that mentions none still needs the group picture confirmed.
const mentionsGroupCoverage = (c: Context) =>
  c.client.existingCoverageNote !== UNKNOWN && /employer|group|团体|团险/i.test(c.client.existingCoverageNote);

const RULES: readonly Rule[] = [
  {
    field: "desiredCoverageAmount",
    reasonZh: "尚未确认客户期望的身故保额,无法评估保障缺口。",
    reasonEn: "The desired death-benefit amount is not stated, so coverage need cannot be evaluated.",
    relevantTo: ["contract_size", "premium_structure"],
    requiredFor: "coverage_need",
    applies: (c) => hasLife(c) && c.client.desiredCoverageAmount === UNKNOWN,
  },
  {
    field: "tobaccoUse",
    reasonZh: "尚未确认吸烟状况,寿险费率分档取决于此。",
    reasonEn: "Tobacco use is not stated; life-insurance rate classes depend on it.",
    relevantTo: ["premium_structure", "eligibility"],
    requiredFor: "cost_comparison",
    applies: (c) => hasLife(c) && c.client.tobaccoUse === UNKNOWN,
  },
  {
    field: "underwritingClass",
    reasonZh: "核保分类由承保方在核保时决定,资料中的样本费率不等于实际费率。",
    reasonEn: "The underwriting class is set by the carrier at underwriting; sample rates are not actual rates.",
    relevantTo: ["premium_structure"],
    requiredFor: "cost_comparison",
    applies: hasLife,
  },
  {
    field: "employerGroupCoverage",
    reasonZh: "尚未确认是否已有团体或雇主提供的保障。",
    reasonEn: "Whether employer or group coverage already exists has not been confirmed.",
    relevantTo: ["contract_size"],
    requiredFor: "coverage_need",
    applies: (c) => hasLife(c) && !mentionsGroupCoverage(c),
  },
  {
    field: "existingIndividualCoverage",
    reasonZh: "已知存在团体保障,但尚未确认个人自购保单的额度与条款。",
    reasonEn: "Group coverage is known, but individually owned coverage and its terms are not.",
    relevantTo: ["contract_size"],
    requiredFor: "coverage_need",
    applies: (c) => hasLife(c) && mentionsGroupCoverage(c),
  },
  {
    field: "plannedPremiumDuration",
    reasonZh: "灵活保费产品需要确认计划缴费年限。",
    reasonEn: "A flexible-premium product requires the planned premium-paying duration.",
    relevantTo: ["premium_structure"],
    requiredFor: "illustration",
    applies: hasIul,
  },
  {
    field: "cashValueTimeHorizon",
    reasonZh: "尚未确认现金价值积累的时间目标。",
    reasonEn: "The time horizon for cash-value accumulation is not stated.",
    relevantTo: ["cash_value"],
    requiredFor: "illustration",
    applies: hasIul,
  },
  {
    field: "withdrawalExpectations",
    reasonZh: "尚未确认取用或提取资金的预期。",
    reasonEn: "Expectations about access to or withdrawal of funds are not stated.",
    relevantTo: ["cash_value", "surrender_liquidity"],
    requiredFor: "illustration",
    applies: hasIul,
  },
  {
    field: "personalizedIllustration",
    reasonZh: "资料未提供个性化 illustration;保证与非保证栏必须由承保方出具。",
    reasonEn: "No personalized illustration is available; guaranteed and non-guaranteed columns must come from the carrier.",
    relevantTo: ["illustration_documentation", "non_guaranteed_elements"],
    requiredFor: "illustration",
    applies: hasIul,
  },
  // Replacement-specific gaps. These come from Demo Client C's fixture, which
  // is the only ground truth for what a replacement review needs here.
  {
    field: "currentSurrenderCharge",
    reasonZh: "尚未确认现有合同的退保费用。",
    reasonEn: "The surrender charge on the existing contract is not known.",
    relevantTo: ["surrender_liquidity"],
    requiredFor: "replacement_review",
    applies: (c) => c.client.replacementContext,
  },
  {
    field: "currentMarketValueAdjustment",
    reasonZh: "尚未确认现有合同的市场价值调整。",
    reasonEn: "The market value adjustment on the existing contract is not known.",
    relevantTo: ["surrender_liquidity"],
    requiredFor: "replacement_review",
    applies: (c) => c.client.replacementContext,
  },
  {
    field: "existingGuaranteedRateEndDate",
    reasonZh: "尚未确认现有合同的保证利率何时结束。",
    reasonEn: "The end date of the existing contract's guaranteed rate is not known.",
    relevantTo: ["guaranteed_elements"],
    requiredFor: "replacement_review",
    applies: (c) => c.client.replacementContext,
  },
  {
    field: "currentAccountValue",
    reasonZh: "尚未确认现有合同的当前账户价值。",
    reasonEn: "The current account value of the existing contract is not known.",
    relevantTo: ["contract_size"],
    requiredFor: "replacement_review",
    applies: (c) => c.client.replacementContext,
  },
  {
    field: "benefitsThatMayBeLost",
    reasonZh: "尚未确认转换后可能失去的既有利益或保证。",
    reasonEn: "Benefits or guarantees that may be forfeited on replacement have not been identified.",
    relevantTo: ["guaranteed_elements", "important_limitations"],
    requiredFor: "replacement_review",
    applies: (c) => c.client.replacementContext,
  },
];

export function computeMissingClientInformation(
  client: ClientContext | null,
  categories: readonly ProductCategory[],
): MissingClientInfo[] {
  // With no client there is no client information to be missing. Product-level
  // gaps are expressed as not_provided cells, not as client questions.
  if (client === null) return [];
  const context: Context = { categories: new Set(categories), client };
  return RULES.filter((rule) => rule.applies(context)).map((rule) => ({
    field: rule.field,
    reasonZh: rule.reasonZh,
    reasonEn: rule.reasonEn,
    relevantTo: rule.relevantTo,
    requiredFor: rule.requiredFor,
  }));
}
