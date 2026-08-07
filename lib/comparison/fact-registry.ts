import type { ProductCategory } from "../schemas";
import type { ChunkRecord } from "../ingestion/types";
import type { DimensionId } from "./dimensions";
import type { DerivationRuleId, ValueFormat } from "./types";
import type { Anchor } from "./source-map";

// The comparable-fact registry.
//
// It declares WHERE a fact lives and HOW to render it — paths into
// products.json, category rules, labels, anchors, formats. It contains no
// product values: no rate, no age, no year count, no amount. A test asserts
// this by scanning the module source for numeric literals.
//
// Three fact kinds:
//   direct         — structured value in products.json + matching document text
//   derived        — computed by a named rule from other validated facts
//   not_applicable — the concept does not exist for this contract type
//   not_provided   — the demo materials do not state it
//
// `valuePath` and `quotePath` are deliberately separate. The structured value
// (0.095) is what comparison logic reads; the quote ("9.50%") is what must
// appear in the document. Assuming they are the same string is how a display
// convenience turns into a fabricated citation.

export interface FactPart {
  labelZh?: string;
  labelEn?: string;
  valuePath: string; // raw structured value
  displayPath: string; // human-readable rendering
  quotePath?: string; // evidence text; defaults to displayPath
  anchor: Anchor;
  expectedSectionIncludes?: string;
  expectedChunkType?: ChunkRecord["chunkType"];
}

// Expands over an array in products.json (riders, exclusions, …) so the
// registry never hardcodes how many items a product has.
export interface FactPartList {
  arrayPath: string;
  itemValuePath?: string; // relative to the item; omitted ⇒ the item itself
  itemDisplayPath?: string; // relative to the item; omitted ⇒ the item itself
  anchor: Anchor;
  expectedSectionIncludes?: string;
}

export type DirectRule = {
  kind: "direct";
  dimensionId: DimensionId;
  productCategory: ProductCategory;
  format: ValueFormat;
  parts?: FactPart[];
  list?: FactPartList;
};

export type DerivedRule = {
  kind: "derived";
  dimensionId: DimensionId;
  productCategory: ProductCategory;
  format: ValueFormat;
  ruleId: DerivationRuleId;
  inputPaths: string[];
  // Structured counterpart to reconcile the derivation against. A mismatch is
  // a conflict — neither side silently wins.
  reconcileWithPath?: string;
  evidence: FactPart[];
  // Supporting context rendered alongside the derived value (e.g. free
  // withdrawal, MVA), each with its own evidence.
  parts?: FactPart[];
};

export type NotApplicableRule = {
  kind: "not_applicable";
  dimensionId: DimensionId;
  productCategory: ProductCategory;
  reasonZh: string;
  reasonEn: string;
};

export type NotProvidedRule = {
  kind: "not_provided";
  dimensionId: DimensionId;
  productCategory: ProductCategory;
  reasonZh: string;
  reasonEn: string;
};

export type FactRule = DirectRule | DerivedRule | NotApplicableRule | NotProvidedRule;

const TERM = "term_life" as const;
const IUL = "indexed_universal_life" as const;
const ANNUITY = "fixed_annuity" as const;

// Anchors reference expectedFactLocations factIds (page-level) or a schedule's
// declared tablePage. Both already exist in products.json.
const at = (factId: string): Anchor => ({ kind: "factId", factId });
const table = (path: string): Anchor => ({ kind: "tablePage", path });

export const FACT_RULES: readonly FactRule[] = [
  // ---- product_type -------------------------------------------------------
  { kind: "direct", dimensionId: "product_type", productCategory: TERM, format: "text",
    parts: [{ valuePath: "productType", displayPath: "productType", anchor: at("term_product_type") }] },
  { kind: "direct", dimensionId: "product_type", productCategory: IUL, format: "text",
    parts: [{ valuePath: "productType", displayPath: "productType", anchor: at("iul_product_type_and_dbo") }] },
  { kind: "direct", dimensionId: "product_type", productCategory: ANNUITY, format: "text",
    parts: [{ valuePath: "productType", displayPath: "productType", anchor: at("annuity_overview") }] },

  // ---- eligibility --------------------------------------------------------
  { kind: "direct", dimensionId: "eligibility", productCategory: TERM, format: "text",
    parts: [{ valuePath: "issueAges", displayPath: "issueAges.display", anchor: at("term_issue_ages_and_face") }] },
  { kind: "direct", dimensionId: "eligibility", productCategory: IUL, format: "text",
    parts: [{ valuePath: "issueAges", displayPath: "issueAges.display", anchor: at("iul_no_lapse") }] },
  { kind: "direct", dimensionId: "eligibility", productCategory: ANNUITY, format: "text",
    parts: [{ valuePath: "issueAges", displayPath: "issueAges.display", anchor: at("annuity_overview") }] },

  // ---- contract_size ------------------------------------------------------
  { kind: "direct", dimensionId: "contract_size", productCategory: TERM, format: "currency",
    parts: [{ labelZh: "身故保额", labelEn: "Face amount", valuePath: "faceAmounts",
      displayPath: "faceAmounts.display", anchor: at("term_issue_ages_and_face") }] },
  { kind: "direct", dimensionId: "contract_size", productCategory: IUL, format: "currency",
    parts: [{ labelZh: "最低身故保额", labelEn: "Minimum face amount", valuePath: "minimumFaceAmount",
      displayPath: "minimumFaceAmount.display", anchor: at("iul_product_type_and_dbo") }] },
  { kind: "direct", dimensionId: "contract_size", productCategory: ANNUITY, format: "currency",
    parts: [
      { labelZh: "最低保费", labelEn: "Minimum premium", valuePath: "minimumPremium",
        displayPath: "minimumPremium.display", anchor: at("annuity_overview") },
      { labelZh: "最高保费", labelEn: "Maximum premium", valuePath: "maximumPremium",
        displayPath: "maximumPremium.display", anchor: at("annuity_overview") },
    ] },

  // ---- coverage_duration --------------------------------------------------
  { kind: "direct", dimensionId: "coverage_duration", productCategory: TERM, format: "text",
    parts: [{ valuePath: "premiums", displayPath: "premiums.display",
      anchor: at("term_renewal_after_level_period") }] },
  { kind: "direct", dimensionId: "coverage_duration", productCategory: IUL, format: "text",
    parts: [{ labelZh: "无失效保证", labelEn: "No-lapse guarantee", valuePath: "noLapseGuarantee",
      displayPath: "noLapseGuarantee.display", anchor: at("iul_no_lapse") }] },
  { kind: "not_applicable", dimensionId: "coverage_duration", productCategory: ANNUITY,
    reasonZh: "递延年金合同不提供寿险保障期限。",
    reasonEn: "A deferred annuity contract has no life-insurance coverage duration." },

  // ---- premium_structure --------------------------------------------------
  { kind: "direct", dimensionId: "premium_structure", productCategory: TERM, format: "text",
    parts: [{ valuePath: "premiums", displayPath: "premiums.display",
      anchor: at("term_renewal_after_level_period") }] },
  { kind: "direct", dimensionId: "premium_structure", productCategory: IUL, format: "text",
    parts: [{ valuePath: "premiums", displayPath: "premiums.display", anchor: at("iul_no_lapse") }] },
  { kind: "direct", dimensionId: "premium_structure", productCategory: ANNUITY, format: "currency",
    parts: [
      { labelZh: "最低保费", labelEn: "Minimum premium", valuePath: "minimumPremium",
        displayPath: "minimumPremium.display", anchor: at("annuity_overview") },
      { labelZh: "最高保费", labelEn: "Maximum premium", valuePath: "maximumPremium",
        displayPath: "maximumPremium.display", anchor: at("annuity_overview") },
    ] },

  // ---- cash_value ---------------------------------------------------------
  // Term states the negative explicitly (hasCashValue === false); that is a
  // documented fact and still requires a citation.
  { kind: "direct", dimensionId: "cash_value", productCategory: TERM, format: "boolean",
    parts: [{ valuePath: "cashValue.hasCashValue", displayPath: "cashValue.display",
      anchor: at("term_no_cash_value") }] },
  { kind: "direct", dimensionId: "cash_value", productCategory: IUL, format: "text",
    parts: [
      { labelZh: "指数账户", labelEn: "Indexed account", valuePath: "indexedAccount",
        displayPath: "indexedAccount.display", anchor: at("iul_indexed_mechanics") },
      { labelZh: "提取", labelEn: "Withdrawals", valuePath: "withdrawals",
        displayPath: "withdrawals.display", anchor: at("iul_loans_withdrawals") },
    ] },
  // An annuity carries an account value, not life-insurance cash value. The
  // demo materials never state a cash-value feature, and forcing the two into
  // one row would assert a false equivalence.
  { kind: "not_applicable", dimensionId: "cash_value", productCategory: ANNUITY,
    reasonZh: "现金价值是寿险保单概念;本合同为年金,资料以账户价值表述。",
    reasonEn: "Cash value is a life-insurance concept; this contract is an annuity and the materials describe an account value." },

  // ---- guaranteed_elements ------------------------------------------------
  { kind: "direct", dimensionId: "guaranteed_elements", productCategory: TERM, format: "text",
    parts: [{ labelZh: "保费保证", labelEn: "Premium guarantee", valuePath: "premiums.levelYears",
      displayPath: "premiums.display", anchor: at("term_renewal_after_level_period") }] },
  { kind: "direct", dimensionId: "guaranteed_elements", productCategory: IUL, format: "percent",
    parts: [
      { labelZh: "指数账户保证下限", labelEn: "Indexed account floor", valuePath: "floor.rate",
        displayPath: "floor.display", anchor: at("iul_indexed_mechanics") },
      { labelZh: "保证最低 cap", labelEn: "Guaranteed minimum cap", valuePath: "cap.guaranteedMinimumRate",
        displayPath: "cap.guaranteedMinimumRateDisplay", anchor: at("iul_indexed_mechanics") },
      { labelZh: "保证最低参与率", labelEn: "Guaranteed minimum participation rate",
        valuePath: "participation.guaranteedMinimumRate",
        displayPath: "participation.guaranteedMinimumRateDisplay", anchor: at("iul_indexed_mechanics") },
      { labelZh: "固定账户保证最低利率", labelEn: "Fixed account guaranteed minimum rate",
        valuePath: "fixedAccount.guaranteedMinimumRate",
        displayPath: "fixedAccount.guaranteedMinimumRateDisplay", anchor: at("iul_fixed_account_and_charges") },
    ] },
  { kind: "direct", dimensionId: "guaranteed_elements", productCategory: ANNUITY, format: "percent",
    parts: [
      { labelZh: "初始利率保证", labelEn: "Initial rate guarantee", valuePath: "initialRate.guaranteeYears",
        displayPath: "initialRate.guaranteeDisplay", anchor: at("annuity_rates") },
      { labelZh: "保证最低利率", labelEn: "Guaranteed minimum rate", valuePath: "guaranteedMinimumRate.rate",
        displayPath: "guaranteedMinimumRate.display", anchor: at("annuity_rates") },
    ] },

  // ---- non_guaranteed_elements -------------------------------------------
  { kind: "not_applicable", dimensionId: "non_guaranteed_elements", productCategory: TERM,
    reasonZh: "该定期寿险的保费在保证期内固定,资料未列出非保证要素。",
    reasonEn: "This term policy's premiums are guaranteed for the level period; the materials list no non-guaranteed elements." },
  // Current cap / participation belong here and NEVER in guaranteed_elements.
  { kind: "direct", dimensionId: "non_guaranteed_elements", productCategory: IUL, format: "percent",
    parts: [
      { labelZh: "当前 cap", labelEn: "Current cap", valuePath: "cap.currentRate",
        displayPath: "cap.currentRateDisplay", anchor: at("iul_indexed_mechanics") },
      { labelZh: "当前参与率", labelEn: "Current participation rate", valuePath: "participation.currentRate",
        displayPath: "participation.currentRateDisplay", anchor: at("iul_indexed_mechanics") },
      { labelZh: "费率变更", labelEn: "Rate changes", valuePath: "rateChanges",
        displayPath: "rateChanges.display", anchor: at("iul_indexed_mechanics") },
    ] },
  { kind: "direct", dimensionId: "non_guaranteed_elements", productCategory: ANNUITY, format: "text",
    parts: [{ labelZh: "续期利率", labelEn: "Renewal rates", valuePath: "renewalRates",
      displayPath: "renewalRates.display", anchor: at("annuity_rates") }] },

  // ---- crediting_mechanics ------------------------------------------------
  { kind: "not_applicable", dimensionId: "crediting_mechanics", productCategory: TERM,
    reasonZh: "定期寿险不积累账户价值,资料未描述计息机制。",
    reasonEn: "Term life accumulates no account value; the materials describe no crediting mechanics." },
  { kind: "direct", dimensionId: "crediting_mechanics", productCategory: IUL, format: "text",
    parts: [{ valuePath: "indexedAccount", displayPath: "indexedAccount.display",
      anchor: at("iul_indexed_mechanics") }] },
  { kind: "direct", dimensionId: "crediting_mechanics", productCategory: ANNUITY, format: "percent",
    parts: [
      { labelZh: "初始利率", labelEn: "Initial rate", valuePath: "initialRate.rate",
        displayPath: "initialRate.display", anchor: at("annuity_rates") },
      { labelZh: "续期利率", labelEn: "Renewal rates", valuePath: "renewalRates",
        displayPath: "renewalRates.display", anchor: at("annuity_rates") },
    ] },

  // ---- surrender_liquidity ------------------------------------------------
  { kind: "not_applicable", dimensionId: "surrender_liquidity", productCategory: TERM,
    reasonZh: "该定期寿险没有现金价值,资料未列出退保费用。",
    reasonEn: "This term policy has no cash value; the materials state no surrender charge." },
  { kind: "derived", dimensionId: "surrender_liquidity", productCategory: IUL, format: "years",
    ruleId: "LAST_NONZERO_SURRENDER_CHARGE_YEAR",
    inputPaths: ["surrenderChargeSchedule.chargesByYear", "surrenderChargeSchedule.basis"],
    reconcileWithPath: "surrenderCharge.years",
    evidence: [{ valuePath: "surrenderChargeSchedule", displayPath: "surrenderChargeSchedule.tableTitle",
      anchor: table("surrenderChargeSchedule"), expectedChunkType: "table" }],
    parts: [{ labelZh: "提取", labelEn: "Withdrawals", valuePath: "withdrawals",
      displayPath: "withdrawals.display", anchor: at("iul_loans_withdrawals") }] },
  { kind: "derived", dimensionId: "surrender_liquidity", productCategory: ANNUITY, format: "years",
    ruleId: "LAST_NONZERO_SURRENDER_CHARGE_YEAR",
    inputPaths: ["surrenderChargeSchedule.chargesByYearPercent", "surrenderChargeSchedule.basis"],
    reconcileWithPath: "surrenderPeriodYears",
    evidence: [{ valuePath: "surrenderChargeSchedule", displayPath: "surrenderChargeSchedule.tableTitle",
      anchor: table("surrenderChargeSchedule"), expectedChunkType: "table" }],
    parts: [
      { labelZh: "免费提取", labelEn: "Free withdrawal", valuePath: "freeWithdrawal",
        displayPath: "freeWithdrawal.display", anchor: at("annuity_access") },
      { labelZh: "市场价值调整", labelEn: "Market value adjustment", valuePath: "marketValueAdjustment",
        displayPath: "marketValueAdjustment.display", anchor: at("annuity_access") },
    ] },

  // ---- riders -------------------------------------------------------------
  { kind: "direct", dimensionId: "riders", productCategory: TERM, format: "textList",
    list: { arrayPath: "riders", itemValuePath: "name", itemDisplayPath: "display", anchor: at("term_riders") } },
  { kind: "direct", dimensionId: "riders", productCategory: IUL, format: "textList",
    list: { arrayPath: "riders", itemValuePath: "name", itemDisplayPath: "display", anchor: at("iul_riders") } },
  // Explicitly documented negative: offered === false, with a citation.
  { kind: "direct", dimensionId: "riders", productCategory: ANNUITY, format: "boolean",
    parts: [{ valuePath: "optionalRiders.offered", displayPath: "optionalRiders.display",
      anchor: at("annuity_options_no_riders") }] },

  // ---- illustration_documentation ----------------------------------------
  { kind: "not_provided", dimensionId: "illustration_documentation", productCategory: TERM,
    reasonZh: "演示资料未说明该产品的 illustration 要求。",
    reasonEn: "The demo materials state no illustration requirement for this product." },
  { kind: "direct", dimensionId: "illustration_documentation", productCategory: IUL, format: "text",
    parts: [{ valuePath: "illustration", displayPath: "illustration.display",
      anchor: at("iul_required_illustration_sentence") }] },
  { kind: "not_provided", dimensionId: "illustration_documentation", productCategory: ANNUITY,
    reasonZh: "演示资料未说明该产品的 illustration 要求。",
    reasonEn: "The demo materials state no illustration requirement for this product." },

  // ---- important_limitations ---------------------------------------------
  { kind: "direct", dimensionId: "important_limitations", productCategory: TERM, format: "textList",
    list: { arrayPath: "exclusions", anchor: at("term_exclusions") } },
  { kind: "direct", dimensionId: "important_limitations", productCategory: IUL, format: "textList",
    list: { arrayPath: "disclosures", anchor: at("iul_disclosures") } },
  { kind: "direct", dimensionId: "important_limitations", productCategory: ANNUITY, format: "text",
    parts: [
      { labelZh: "税务提示", labelEn: "Tax note", valuePath: "taxNote", displayPath: "taxNote.display",
        anchor: at("annuity_tax_replacement_suitability") },
      { labelZh: "转保披露", labelEn: "Replacement disclosure", valuePath: "replacement",
        displayPath: "replacement.display", anchor: at("annuity_tax_replacement_suitability") },
      { labelZh: "适合性审核", labelEn: "Suitability review", valuePath: "suitability",
        displayPath: "suitability.display", anchor: at("annuity_tax_replacement_suitability") },
    ] },
];

export function findFactRule(
  dimensionId: DimensionId,
  productCategory: ProductCategory,
): FactRule | undefined {
  return FACT_RULES.find(
    (r) => r.dimensionId === dimensionId && r.productCategory === productCategory,
  );
}
