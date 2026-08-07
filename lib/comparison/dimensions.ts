// The comparison dimensions, in the order a broker reads them. This list is
// deliberately curated rather than derived from a diff of `facts` objects:
// the three products are different contract types, so a mechanical diff would
// invent rows nobody asked about and silently drop the ones that matter.
//
// `core` marks the dimensions whose failure makes the whole draft unsafe. A
// conflict or unmappable value in a core dimension blocks the comparison; in
// a non-core dimension it degrades it to partial (see lib/comparison/compare
// in M4-B).

export const DIMENSION_IDS = [
  "product_type",
  "eligibility",
  "contract_size",
  "coverage_duration",
  "premium_structure",
  "cash_value",
  "guaranteed_elements",
  "non_guaranteed_elements",
  "crediting_mechanics",
  "surrender_liquidity",
  "riders",
  "illustration_documentation",
  "important_limitations",
] as const;

export type DimensionId = (typeof DIMENSION_IDS)[number];

export interface DimensionDefinition {
  dimensionId: DimensionId;
  labelZh: string;
  labelEn: string;
  core: boolean;
}

export const DIMENSIONS: readonly DimensionDefinition[] = [
  { dimensionId: "product_type", labelZh: "产品类型", labelEn: "Product type", core: true },
  { dimensionId: "eligibility", labelZh: "投保年龄", labelEn: "Issue ages", core: false },
  { dimensionId: "contract_size", labelZh: "保额 / 合同金额", labelEn: "Coverage amount / contract size", core: false },
  { dimensionId: "coverage_duration", labelZh: "保障期限", labelEn: "Coverage duration", core: true },
  { dimensionId: "premium_structure", labelZh: "保费 / 缴费结构", labelEn: "Premium / contribution structure", core: true },
  { dimensionId: "cash_value", labelZh: "现金价值 / 账户价值", labelEn: "Cash value / account value", core: true },
  { dimensionId: "guaranteed_elements", labelZh: "保证要素", labelEn: "Guaranteed elements", core: true },
  { dimensionId: "non_guaranteed_elements", labelZh: "非保证要素", labelEn: "Non-guaranteed elements", core: true },
  { dimensionId: "crediting_mechanics", labelZh: "计息 / 利率机制", labelEn: "Crediting / rate mechanics", core: false },
  { dimensionId: "surrender_liquidity", labelZh: "退保费用与流动性", labelEn: "Surrender charges and liquidity", core: true },
  { dimensionId: "riders", labelZh: "附加险 / 可选利益", labelEn: "Riders / optional benefits", core: true },
  { dimensionId: "illustration_documentation", labelZh: "illustration / 文件要求", labelEn: "Illustration / documentation", core: false },
  { dimensionId: "important_limitations", labelZh: "重要限制与披露", labelEn: "Important limitations and disclosures", core: false },
];

const BY_ID = new Map<DimensionId, DimensionDefinition>(DIMENSIONS.map((d) => [d.dimensionId, d]));

export function dimension(dimensionId: DimensionId): DimensionDefinition {
  const found = BY_ID.get(dimensionId);
  if (!found) throw new Error(`UNKNOWN_DIMENSION: ${dimensionId}`);
  return found;
}

export function isCoreDimension(dimensionId: DimensionId): boolean {
  return dimension(dimensionId).core;
}

// Fixed display text for the two non-value outcomes. They are different
// statements — "this contract type has no such concept" vs "the demo
// materials do not state it" — and must never collapse into one another, or
// into `false` / `0`.
export const NOT_APPLICABLE_DISPLAY = "不适用 Not applicable";
export const NOT_PROVIDED_DISPLAY = "演示资料未提供 Not provided in demo materials";
