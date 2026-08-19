import type { ComparisonDraft } from "../comparison/types";
import type { WorkflowDecision } from "../schemas";
import type { ReviewChecklistItem } from "./types";

// What a reviewer has to confirm before this draft goes anywhere.
//
// Deterministic, no model. Two sources only, and both are already established
// ground truth: the replacement-review items the synthetic Case C fixture has
// carried since M1, and the client information the comparison engine already
// says is missing. Nothing here is invented from general regulatory knowledge —
// a plausible-sounding compliance item nobody can trace is worse than no item.

// Case C's `expected.requiredChecklistItems`, verbatim as the keys, with the
// bilingual labels a reviewer reads. The fixture strings ARE the contract; the
// labels only render them.
const REPLACEMENT_CHECKLIST: ReadonlyArray<{ key: string; labelZh: string; labelEn: string }> = [
  {
    key: "current contract surrender charge",
    labelZh: "现有合同的退保费用",
    labelEn: "Current contract surrender charge",
  },
  {
    key: "current contract market value adjustment",
    labelZh: "现有合同的市场价值调整",
    labelEn: "Current contract market value adjustment",
  },
  {
    key: "existing guaranteed rate end date",
    labelZh: "现有保证利率的到期日",
    labelEn: "Existing guaranteed-rate end date",
  },
  {
    key: "new contract guaranteed rate period",
    labelZh: "新合同的保证利率期间",
    labelEn: "New contract guaranteed-rate period",
  },
  {
    key: "new contract surrender period",
    labelZh: "新合同的退保费用期间",
    labelEn: "New contract surrender-charge period",
  },
  {
    key: "benefits that may be forfeited",
    labelZh: "可能失去的既有利益",
    labelEn: "Benefits that may be forfeited",
  },
  {
    key: "state replacement forms",
    labelZh: "州替换申报表",
    labelEn: "State replacement forms",
  },
  {
    key: "age-based suitability review",
    labelZh: "基于年龄的适合性审核",
    labelEn: "Age-based suitability review",
  },
];

// Client gaps a reviewer should chase. Labels mirror the ones the comparison
// UI already uses, so the same gap reads the same way in both places.
const MISSING_INFO_LABELS: Record<string, { labelZh: string; labelEn: string }> = {
  desiredCoverageAmount: { labelZh: "期望身故保额", labelEn: "Desired death benefit" },
  tobaccoUse: { labelZh: "吸烟状况", labelEn: "Tobacco use" },
  underwritingClass: { labelZh: "核保分类", labelEn: "Underwriting class" },
  employerGroupCoverage: { labelZh: "团体/雇主保障", labelEn: "Employer or group coverage" },
  existingIndividualCoverage: { labelZh: "个人自购保障", labelEn: "Individually owned coverage" },
  plannedPremiumDuration: { labelZh: "计划缴费年限", labelEn: "Planned premium duration" },
  cashValueTimeHorizon: { labelZh: "现金价值时间目标", labelEn: "Cash-value time horizon" },
  withdrawalExpectations: { labelZh: "取用预期", labelEn: "Withdrawal expectations" },
  personalizedIllustration: { labelZh: "个性化 illustration", labelEn: "Personalized illustration" },
  currentSurrenderCharge: { labelZh: "现有合同退保费用", labelEn: "Existing surrender charge" },
  currentMarketValueAdjustment: { labelZh: "现有合同市场价值调整", labelEn: "Existing market value adjustment" },
  existingGuaranteedRateEndDate: { labelZh: "现有保证利率到期日", labelEn: "Existing guaranteed-rate end date" },
  currentAccountValue: { labelZh: "现有账户价值", labelEn: "Current account value" },
  benefitsThatMayBeLost: { labelZh: "可能失去的利益", labelEn: "Benefits that may be lost" },
};

// A missing-info field already covered by a replacement checklist item would
// otherwise appear twice under different wording. The checklist is for a
// person, not a dump of every internal signal.
const REPLACEMENT_DUPLICATES: Record<string, string> = {
  currentSurrenderCharge: "current contract surrender charge",
  currentMarketValueAdjustment: "current contract market value adjustment",
  existingGuaranteedRateEndDate: "existing guaranteed rate end date",
  benefitsThatMayBeLost: "benefits that may be forfeited",
};

/**
 * The replacement keys, exported so presentation layers can be checked for drift
 * against this file rather than re-listing the fixture strings by hand.
 */
export const REPLACEMENT_CHECKLIST_KEYS: ReadonlyArray<string> = REPLACEMENT_CHECKLIST.map(
  (entry) => entry.key,
);

export interface ChecklistInput {
  draft: ComparisonDraft;
  workflowDecision: WorkflowDecision;
}

export function buildReviewChecklist(input: ChecklistInput): ReviewChecklistItem[] {
  const items: ReviewChecklistItem[] = [];
  const replacement =
    input.draft.clientContext?.replacementContext === true &&
    input.workflowDecision === "block_client_draft";

  if (replacement) {
    for (const entry of REPLACEMENT_CHECKLIST) {
      items.push({ ...entry, sourceKind: "fixture_checklist" });
    }
  }

  const covered = new Set(replacement ? Object.keys(REPLACEMENT_DUPLICATES) : []);
  for (const missing of input.draft.missingClientInformation) {
    if (covered.has(missing.field)) continue;
    const label = MISSING_INFO_LABELS[missing.field];
    if (!label) continue; // no approved bilingual mapping — better absent than guessed
    items.push({ key: missing.field, labelZh: label.labelZh, labelEn: label.labelEn, sourceKind: "missing_client_info" });
  }

  return items;
}
