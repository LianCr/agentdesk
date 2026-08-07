import type { ComparisonObservation, ComparisonRow, ObservationType } from "./types";

// Deterministic documented observations.
//
// An observation may only restate relationships between facts that are
// already validated and cited. It never introduces a product fact, never
// introduces a number that is not in the cells it references, and never says
// which product is better — severity describes how much human attention the
// note deserves, not product quality.

interface Candidate {
  type: ObservationType;
  textZh: string;
  textEn: string;
  factRefs: Array<{ dimensionId: ComparisonRow["dimensionId"]; productId: string }>;
  citationIds: string[];
  severity: ComparisonObservation["severity"];
}

function cellsOf(rows: readonly ComparisonRow[], dimensionId: string) {
  const row = rows.find((r) => r.dimensionId === dimensionId);
  return row ? row.cells : null;
}

/**
 * The SecureRate mismatch this milestone exists to surface: the initial rate
 * is guaranteed for fewer contract years than the surrender-charge schedule
 * covers. Both numbers come from validated cells — the guarantee years from
 * the structured initialRate fact, the schedule length from the derived
 * LAST_NONZERO_SURRENDER_CHARGE_YEAR rule — and both carry their own
 * citations. The wording describes what the schedule shows; the guide never
 * writes "seven-year surrender period" and neither does this.
 */
function rateGuaranteeVsSurrender(rows: readonly ComparisonRow[]): Candidate[] {
  const guaranteed = cellsOf(rows, "guaranteed_elements");
  const liquidity = cellsOf(rows, "surrender_liquidity");
  if (!guaranteed || !liquidity) return [];

  const out: Candidate[] = [];
  for (const index of [0, 1] as const) {
    const guaranteeCell = guaranteed[index];
    const surrenderCell = liquidity[index];
    if (guaranteeCell.availability !== "available" || surrenderCell.availability !== "available") continue;
    if (surrenderCell.sourceKind !== "derived") continue;

    // Look the value up by its fact path. Only the annuity registry rule
    // produces `initialRate.guaranteeYears`, so an indexed product's floor or
    // guaranteed-minimum cap can never be mistaken for a guarantee period.
    const raw = guaranteeCell.rawValue;
    const guaranteeYears =
      raw !== null && typeof raw === "object"
        ? (raw as Record<string, unknown>)["initialRate.guaranteeYears"]
        : undefined;
    const surrenderYears = surrenderCell.rawValue;
    if (typeof guaranteeYears !== "number" || typeof surrenderYears !== "number") continue;
    if (guaranteeYears >= surrenderYears) continue;

    out.push({
      type: "RATE_GUARANTEE_SHORTER_THAN_SURRENDER",
      textZh:
        `初始利率保证期为 ${guaranteeYears} 个合同年;退保费用表在第 1–${surrenderYears} 个合同年收取费用,` +
        `第 ${surrenderYears + 1} 年起为 0。利率保证期结束时,合同可能仍处于退保费用表覆盖期间。`,
      textEn:
        `The initial rate-guarantee period runs for ${guaranteeYears} contract years. The surrender-charge ` +
        `schedule shows non-zero charges through contract year ${surrenderYears} and 0 beginning in year ` +
        `${surrenderYears + 1}. At the end of the rate-guarantee period, the contract may still be within ` +
        `the surrender-charge schedule.`,
      factRefs: [
        { dimensionId: "guaranteed_elements", productId: guaranteeCell.productId },
        { dimensionId: "surrender_liquidity", productId: surrenderCell.productId },
      ],
      citationIds: [
        ...guaranteeCell.citations.map((c) => c.citationId),
        ...surrenderCell.citations.map((c) => c.citationId),
      ],
      severity: "review_note",
    });
  }
  return out;
}

function cashValueDiffers(rows: readonly ComparisonRow[]): Candidate[] {
  const cells = cellsOf(rows, "cash_value");
  if (!cells) return [];
  const [a, b] = cells;
  // Only meaningful when both sides state something and they disagree about
  // whether cash value accumulates at all.
  if (a.availability !== "available" || b.availability !== "available") return [];
  const accumulates = (raw: unknown) => raw !== false;
  if (accumulates(a.rawValue) === accumulates(b.rawValue)) return [];

  return [
    {
      type: "CASH_VALUE_FEATURE_DIFFERS",
      textZh: "两款产品在是否积累现金价值这一点上不同,资料对各自的表述见对应引用。",
      textEn:
        "The two products differ on whether the policy accumulates cash value; each side's documented wording is cited.",
      factRefs: [
        { dimensionId: "cash_value", productId: a.productId },
        { dimensionId: "cash_value", productId: b.productId },
      ],
      citationIds: [...a.citations, ...b.citations].map((c) => c.citationId),
      severity: "informational",
    },
  ];
}

function coverageStructureDiffers(rows: readonly ComparisonRow[]): Candidate[] {
  const cells = cellsOf(rows, "coverage_duration");
  if (!cells) return [];
  const [a, b] = cells;
  // One contract type carries a coverage duration and the other has no such
  // concept — worth stating plainly, with no judgement attached.
  const stated = (availability: string) => availability === "available";
  if (stated(a.availability) === stated(b.availability)) return [];
  const documented = stated(a.availability) ? a : b;
  const other = stated(a.availability) ? b : a;
  if (other.availability !== "not_applicable") return [];

  return [
    {
      type: "COVERAGE_STRUCTURE_DIFFERS",
      textZh: "两款产品的合同结构不同:一方有寿险保障期限,另一方不适用该概念。",
      textEn:
        "The contract structures differ: one carries a life-insurance coverage duration, the other has no such concept.",
      factRefs: [
        { dimensionId: "coverage_duration", productId: documented.productId },
        { dimensionId: "coverage_duration", productId: other.productId },
      ],
      citationIds: documented.citations.map((c) => c.citationId),
      severity: "informational",
    },
  ];
}

function nonGuaranteedPresent(rows: readonly ComparisonRow[]): Candidate[] {
  const cells = cellsOf(rows, "non_guaranteed_elements");
  if (!cells) return [];
  const withElements = cells.filter((c) => c.availability === "available");
  if (withElements.length === 0) return [];

  return [
    {
      type: "NON_GUARANTEED_ELEMENTS_PRESENT",
      textZh: "本次比较涉及非保证要素;这些数值由承保方宣告,可能随时间变化,需持牌经纪人复核。",
      textEn:
        "This comparison involves non-guaranteed elements; those values are declared by the carrier, can change over time, and require licensed-agent review.",
      factRefs: withElements.map((c) => ({ dimensionId: "non_guaranteed_elements" as const, productId: c.productId })),
      citationIds: withElements.flatMap((c) => c.citations.map((x) => x.citationId)),
      severity: "review_note",
    },
  ];
}

function illustrationRequiredDiffers(rows: readonly ComparisonRow[]): Candidate[] {
  const cells = cellsOf(rows, "illustration_documentation");
  if (!cells) return [];
  const [a, b] = cells;
  if (a.availability === b.availability) return [];
  const documented = a.availability === "available" ? a : b;
  if (documented.availability !== "available") return [];

  return [
    {
      type: "ILLUSTRATION_REQUIRED_DIFFERS",
      textZh: "只有其中一款产品在资料中说明了个性化 illustration 的要求;另一款资料未提供该说明。",
      textEn:
        "Only one of the products documents a personalized-illustration requirement; the other's materials state none.",
      factRefs: [{ dimensionId: "illustration_documentation", productId: documented.productId }],
      citationIds: documented.citations.map((c) => c.citationId),
      severity: "review_note",
    },
  ];
}

const RULES = [
  rateGuaranteeVsSurrender,
  cashValueDiffers,
  coverageStructureDiffers,
  nonGuaranteedPresent,
  illustrationRequiredDiffers,
];

export function computeObservations(rows: readonly ComparisonRow[]): ComparisonObservation[] {
  const candidates = RULES.flatMap((rule) => rule(rows));
  return candidates.map((candidate, index) => ({
    observationId: `obs_${String(index + 1).padStart(3, "0")}`,
    type: candidate.type,
    textZh: candidate.textZh,
    textEn: candidate.textEn,
    factRefs: candidate.factRefs,
    citationIds: [...new Set(candidate.citationIds)],
    severity: candidate.severity,
  }));
}
