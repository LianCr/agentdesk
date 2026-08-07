import type { DerivationRuleId } from "./types";

// Named deterministic derivations. There are no free-form calculations: a
// derived fact may only come from one of these rules, and each rule states
// exactly which structured inputs it consumes.
//
// LAST_NONZERO_SURRENDER_CHARGE_YEAR exists because of a real gap in the
// corpus: the annuity guide never writes "seven-year surrender period" in
// prose. The only evidence is the surrender-charge table, whose last column
// with a non-zero charge is contract year 7. So the fact is computed from the
// table and phrased as a statement about the schedule — never quoted as a
// sentence the document does not contain.

export interface DerivationResult {
  rawValue: number;
  displayZh: string;
  displayEn: string;
  scheduleLength: number;
}

export function lastNonZeroChargeYear(charges: readonly number[]): number {
  let last = 0;
  charges.forEach((charge, index) => {
    if (charge !== 0) last = index + 1;
  });
  return last;
}

export function runDerivation(
  ruleId: DerivationRuleId,
  inputs: readonly unknown[],
): DerivationResult {
  switch (ruleId) {
    case "LAST_NONZERO_SURRENDER_CHARGE_YEAR": {
      const charges = inputs[0];
      if (!Array.isArray(charges) || charges.length === 0 || charges.some((c) => typeof c !== "number")) {
        throw new Error("DERIVATION_INPUT_INVALID: charge schedule must be a non-empty number array");
      }
      const year = lastNonZeroChargeYear(charges as number[]);
      if (year === 0) {
        throw new Error("DERIVATION_INPUT_INVALID: charge schedule has no non-zero year");
      }
      return {
        rawValue: year,
        // Phrased as what the table shows. Deliberately NOT "the document
        // states a N-year surrender period" — the document says no such thing.
        displayZh: `退保费用表在第 1–${year} 个合同年收取费用,第 ${year + 1} 年起为 0。`,
        displayEn: `The surrender-charge schedule applies charges through contract year ${year}; from year ${year + 1} the charge is 0.`,
        scheduleLength: charges.length,
      };
    }
    default: {
      const exhaustive: never = ruleId;
      throw new Error(`UNKNOWN_DERIVATION_RULE: ${String(exhaustive)}`);
    }
  }
}
