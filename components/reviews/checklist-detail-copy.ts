// Per-item detail for the review checklist, keyed by the item's `key`.
//
// Scope discipline, in the same spirit as lib/reviews/checklist.ts: nothing here
// states a legal or regulatory requirement, a product fact, a number, or a
// suitability judgement. Every line says what the reviewer needs to OBTAIN or
// CONFIRM for this demo's fictional Case C scenario. Product facts stay where
// they can carry a citation — the comparison table.
//
// `missing_client_info` items deliberately have no entry here: their reason text
// is already computed server-side (UiMissingInfo.reasonZh/reasonEn) and shipped
// in the snapshot, so the checklist reuses it rather than writing a second copy
// that can drift.

export interface ChecklistDetailCopy {
  whyZh: string;
  whyEn: string;
  verifyZh: string;
  verifyEn: string;
  /** Comparison dimension holding evidence for this item, when one honestly does. */
  relatedDimensionId?: string;
}

/**
 * Keys are the Case C fixture strings verbatim (lib/reviews/checklist.ts:16-57).
 * They are ground truth, not slugs — do not tidy the spacing or casing.
 */
export const FIXTURE_CHECKLIST_DETAIL: Record<string, ChecklistDetailCopy> = {
  "current contract surrender charge": {
    whyZh: "本演示的替换情形要求先弄清客户在现有合同下的处境。",
    whyEn: "This demo's replacement scenario requires the client's position under the existing contract to be established first.",
    verifyZh: "向现有合同的承保方取得当前退保费用的书面金额及其计算方式。",
    verifyEn: "Obtain from the existing contract's carrier a written statement of the current surrender charge and how it is calculated.",
  },
  "current contract market value adjustment": {
    whyZh: "市场价值调整可能在退保时改变客户实际拿到的金额。",
    whyEn: "A market value adjustment can change what the client actually receives on surrender.",
    verifyZh: "确认现有合同是否含市场价值调整条款；若有，取得其当前方向与影响的书面说明。",
    verifyEn: "Confirm whether the existing contract carries a market value adjustment; if it does, obtain a written statement of its current direction and effect.",
  },
  "existing guaranteed rate end date": {
    whyZh: "现有保证何时结束，决定了这次替换的时点是否被正确理解。",
    whyEn: "When the existing guarantee ends determines whether the timing of this replacement is correctly understood.",
    verifyZh: "向现有承保方取得现有保证利率的确切到期日，以及到期后适用的计息方式说明。",
    verifyEn: "Obtain from the existing carrier the exact end date of the current guaranteed rate, and a statement of what crediting applies afterwards.",
  },
  "new contract guaranteed rate period": {
    whyZh: "新合同的保证期间需要与现有保证的到期日对照后才有意义。",
    whyEn: "The new contract's guarantee period only means something once it is set against the existing guarantee's end date.",
    verifyZh: "在下方比较表中核对新合同的保证要素期间，并与现有合同的到期日对照。表内每个数值都带页码引用。",
    verifyEn: "Check the new contract's guaranteed-elements period in the comparison table below and set it against the existing contract's end date. Every figure in the table carries a page citation.",
    relatedDimensionId: "guaranteed_elements",
  },
  "new contract surrender period": {
    whyZh: "退保费用期间与保证利率期间不一致时，客户可能在失去保证后仍被退保费用锁住。",
    whyEn: "When the surrender-charge period and the guaranteed-rate period do not line up, the client can still be inside surrender charges after the guarantee has ended.",
    verifyZh: "在下方比较表中核对新合同的退保费用期间与流动性条款，并与保证利率期间逐项对照。",
    verifyEn: "Check the new contract's surrender-charge period and liquidity terms in the comparison table below, and set them against the guaranteed-rate period.",
    relatedDimensionId: "surrender_liquidity",
  },
  "benefits that may be forfeited": {
    whyZh: "替换会放弃现有合同上已经积累的东西，这部分不会出现在新合同的资料里。",
    whyEn: "Replacing gives up what has already accrued under the existing contract, and none of that appears in the new contract's document.",
    verifyZh: "逐项列出客户在现有合同下已积累、可能因替换而失去的利益，并取得承保方的书面确认。",
    verifyEn: "List each benefit accrued under the existing contract that the client could lose by replacing it, and obtain written confirmation from the carrier.",
  },
  "state replacement forms": {
    whyZh: "本演示的替换情形要求逐条核对，表单是其中一条。",
    whyEn: "This demo's replacement scenario requires each item to be checked, and the forms are one of them.",
    verifyZh: "确认适用司法辖区所需的替换相关申报表已备齐并由客户签署。",
    verifyEn: "Confirm the replacement-related forms required in the applicable jurisdiction are on file and signed by the client.",
  },
  "age-based suitability review": {
    whyZh: "本演示的情形设定把这一条列为必须由人复核的项目。",
    whyEn: "This demo's scenario lists this as an item that a person must review.",
    verifyZh: "由持牌经纪人按其所属机构的适合性流程复核本案并留存记录。本演示不作任何适合性判断，也不设定年龄标准。",
    verifyEn: "Have a licensed agent review this case under their own firm's suitability process and keep a record of it. This demo makes no suitability determination and sets no age standard.",
  },
};

/** Shown when an item has no entry and no server-computed reason to fall back on. */
export const NO_DETAIL_COPY = {
  zh: "本条无附加说明。",
  en: "No additional detail for this item.",
} as const;

/** Footer note for the whole checklist. Demo policy is not a legal conclusion. */
export const CHECKLIST_PROVENANCE_NOTE = {
  zh: "本清单来自本演示的虚构情形设定与比较引擎的输出，不是法律或合规结论。",
  en: "This checklist comes from the demo's fictional scenario and the comparison engine's output. It is not a legal or compliance conclusion.",
} as const;
