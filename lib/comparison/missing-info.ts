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
    reasonZh: "还不知道客户想要多少身故保额,算不出保障缺口。",
    reasonEn: "The desired death-benefit amount is not stated, so the coverage gap cannot be worked out.",
    relevantTo: ["contract_size", "premium_structure"],
    requiredFor: "coverage_need",
    applies: (c) => hasLife(c) && c.client.desiredCoverageAmount === UNKNOWN,
  },
  {
    field: "tobaccoUse",
    reasonZh: "还不知道客户是否吸烟——寿险价格按吸烟与否分档。",
    reasonEn: "Whether the client uses tobacco is not stated; life-insurance pricing is tiered on it.",
    relevantTo: ["premium_structure", "eligibility"],
    requiredFor: "cost_comparison",
    applies: (c) => hasLife(c) && c.client.tobaccoUse === UNKNOWN,
  },
  {
    field: "underwritingClass",
    reasonZh: "保险公司体检核保后才会定价格档次;资料里的价格只是样本,不是这位客户的最终价格。",
    reasonEn: "The carrier sets the price class after underwriting; the rates in the materials are samples, not this client's final rate.",
    relevantTo: ["premium_structure"],
    requiredFor: "cost_comparison",
    applies: hasLife,
  },
  {
    field: "employerGroupCoverage",
    reasonZh: "还不知道客户公司或单位有没有已经给上的保险。",
    reasonEn: "Whether the client already has coverage through an employer or group is not confirmed.",
    relevantTo: ["contract_size"],
    requiredFor: "coverage_need",
    applies: (c) => hasLife(c) && !mentionsGroupCoverage(c),
  },
  {
    field: "existingIndividualCoverage",
    reasonZh: "已知有单位团体保障,但客户自己另外买过什么保单、保额多少,还不清楚。",
    reasonEn: "Group coverage is known to exist, but what the client owns individually, and for how much, is not.",
    relevantTo: ["contract_size"],
    requiredFor: "coverage_need",
    applies: (c) => hasLife(c) && mentionsGroupCoverage(c),
  },
  {
    field: "plannedPremiumDuration",
    reasonZh: "还不知道客户打算缴多少年保费;灵活缴费的产品要靠这个来算。",
    reasonEn: "How many years the client plans to pay premiums is not stated, and a flexible-premium product depends on it.",
    relevantTo: ["premium_structure"],
    requiredFor: "illustration",
    applies: hasIul,
  },
  {
    field: "cashValueTimeHorizon",
    reasonZh: "还不知道客户打算把现金价值放多少年再用。",
    reasonEn: "How many years the client intends to leave the cash value in place is not stated.",
    relevantTo: ["cash_value"],
    requiredFor: "illustration",
    applies: hasIul,
  },
  {
    field: "withdrawalExpectations",
    reasonZh: "还不知道客户以后想不想取钱、大概什么时候取。",
    reasonEn: "Whether and roughly when the client expects to take money out is not stated.",
    relevantTo: ["cash_value", "surrender_liquidity"],
    requiredFor: "illustration",
    applies: hasIul,
  },
  {
    field: "personalizedIllustration",
    reasonZh: "还没有保险公司出具的正式利益演示(illustration);哪些数字有保证、哪些不保证,都以那份文件为准。",
    reasonEn: "No carrier-issued illustration yet; which figures are guaranteed and which are not is settled by that document.",
    relevantTo: ["illustration_documentation", "non_guaranteed_elements"],
    requiredFor: "illustration",
    applies: hasIul,
  },
  // Replacement-specific gaps. These come from Demo Client C's fixture, which
  // is the only ground truth for what a replacement review needs here.
  {
    field: "currentSurrenderCharge",
    reasonZh: "还不知道客户现有合同现在退保要扣多少钱。",
    reasonEn: "What the existing contract would charge on surrender today is not known.",
    relevantTo: ["surrender_liquidity"],
    requiredFor: "replacement_review",
    applies: (c) => c.client.replacementContext,
  },
  {
    field: "currentMarketValueAdjustment",
    reasonZh: "还不知道现有合同退保时有没有市值调整(MVA)——它会让客户实际拿到的钱变多或变少。",
    reasonEn: "Whether the existing contract applies a market value adjustment is not known; an MVA changes the amount actually received on surrender.",
    relevantTo: ["surrender_liquidity"],
    requiredFor: "replacement_review",
    applies: (c) => c.client.replacementContext,
  },
  {
    field: "existingGuaranteedRateEndDate",
    reasonZh: "还不知道现有合同的保证利率哪一年到期。",
    reasonEn: "When the existing contract's guaranteed rate ends is not known.",
    relevantTo: ["guaranteed_elements"],
    requiredFor: "replacement_review",
    applies: (c) => c.client.replacementContext,
  },
  {
    field: "currentAccountValue",
    reasonZh: "还不知道现有合同现在账户里有多少钱。",
    reasonEn: "How much is in the existing contract's account today is not known.",
    relevantTo: ["contract_size"],
    requiredFor: "replacement_review",
    applies: (c) => c.client.replacementContext,
  },
  {
    field: "benefitsThatMayBeLost",
    reasonZh: "还没有列清楚:换掉现有合同后,客户会失去哪些已有的利益或保证。",
    reasonEn: "What the client would give up from the existing contract by replacing it has not been identified.",
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
