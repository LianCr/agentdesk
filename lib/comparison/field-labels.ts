// The single home for the missing-information field vocabulary.
//
// These labels used to live in three places (the missing-info cards, the review
// checklist, the client roster) with a comment promising to keep them in sync
// by hand. One map, three importers.
//
// Wording policy, decided with the user: the audience is Chinese-speaking
// insurance agents. Chinese is written in plain speech — what a person would
// say across a desk — while English keeps the standard industry terms, because
// the English label is what the agent searches for in the English source PDFs.

export interface FieldLabel {
  zh: string;
  en: string;
}

export const MISSING_FIELD_LABELS: Record<string, FieldLabel> = {
  desiredCoverageAmount: { zh: "期望身故保额", en: "Desired death benefit" },
  tobaccoUse: { zh: "吸烟状况", en: "Tobacco use" },
  underwritingClass: { zh: "健康定价等级", en: "Underwriting class" },
  employerGroupCoverage: { zh: "公司/单位给上的保险", en: "Employer or group coverage" },
  existingIndividualCoverage: { zh: "自己另外买的保单", en: "Individually owned coverage" },
  plannedPremiumDuration: { zh: "计划缴费年限", en: "Planned premium duration" },
  cashValueTimeHorizon: { zh: "现金价值打算存几年", en: "Cash-value time horizon" },
  withdrawalExpectations: { zh: "取钱／用钱的计划", en: "Withdrawal expectations" },
  personalizedIllustration: { zh: "正式利益演示（illustration）", en: "Personalized illustration" },
  currentSurrenderCharge: { zh: "现有合同退保要扣的钱", en: "Existing surrender charge" },
  currentMarketValueAdjustment: { zh: "现有合同的市值调整（MVA）", en: "Existing market value adjustment" },
  existingGuaranteedRateEndDate: { zh: "现有保证利率到期日", en: "Existing guaranteed-rate end date" },
  currentAccountValue: { zh: "现有合同的账户余额", en: "Current account value" },
  benefitsThatMayBeLost: { zh: "换保单会失去什么", en: "Benefits that may be lost" },
};

/** What a gap blocks, shown as 影响 Affects on the cards and the checklist. */
export const REQUIRED_FOR_LABELS: Record<string, FieldLabel> = {
  coverage_need: { zh: "保障需求评估", en: "Coverage-need assessment" },
  cost_comparison: { zh: "价格比较", en: "Cost comparison" },
  illustration: { zh: "正式利益演示与不保证的数字", en: "Illustration and non-guaranteed elements" },
  replacement_review: { zh: "换保单前的审核", en: "Replacement review" },
};
