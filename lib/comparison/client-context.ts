import type { SyntheticCase } from "../schemas";
import { UNKNOWN, type ClientContext } from "./types";

// Normalizes a synthetic case into the shape the comparison engine reads.
//
// The fixtures type `client` and `input` as open records, so this module is
// the only place that decides what a field means. Two rules govern it:
//   1. a field the fixture does not state stays `unknown` — M4 never invents
//      tobacco status, health, income, jurisdiction or desired coverage;
//   2. replacement is an explicit signal, not an inference from the mere
//      existence of some coverage.

function str(value: unknown): string | typeof UNKNOWN {
  return typeof value === "string" && value.trim().length > 0 ? value : UNKNOWN;
}

function num(value: unknown): number | typeof UNKNOWN {
  return typeof value === "number" && Number.isFinite(value) ? value : UNKNOWN;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// An existing contract the client may give up. "employer group term" is
// coverage the client has, not a contract being replaced, so it must not
// trigger replacement handling on its own.
const EXISTING_CONTRACT = /\b(annuity|policy|contract)\b|年金|保单|合同/i;
const REPLACEMENT_SIGNAL =
  /\b(surrender period|surrender charge|replace|replacement|exchange|1035|roll over|rollover|switch)\b|退保|转换|替换|换一个|换成|更换/i;

/**
 * True only when the case describes an EXISTING individual contract AND
 * language that points at giving it up (an in-force surrender period, or an
 * explicit replace/exchange intent). Employer group coverage alone, or any
 * coverage merely existing, is not replacement.
 */
export function detectReplacementContext(input: {
  existingCoverage?: unknown;
  goal?: unknown;
  clientQuestions?: unknown;
}): boolean {
  const coverage = typeof input.existingCoverage === "string" ? input.existingCoverage : "";
  if (!EXISTING_CONTRACT.test(coverage)) return false;
  const intent = [coverage, typeof input.goal === "string" ? input.goal : "", ...stringList(input.clientQuestions)].join(" ");
  return REPLACEMENT_SIGNAL.test(intent);
}

export function normalizeClientContext(syntheticCase: SyntheticCase): ClientContext {
  const client = syntheticCase.client as Record<string, unknown>;
  const input = syntheticCase.input as Record<string, unknown>;
  const language = typeof client.language === "string" && client.language.startsWith("zh") ? "zh" : "en";

  return {
    caseId: syntheticCase.caseId,
    displayName: typeof client.name === "string" ? client.name : syntheticCase.caseId,
    language,
    age: num(client.age),
    dependents: num(client.dependents),
    primaryGoal: syntheticCase.goal,
    budgetMonthly: num(input.budgetMonthly),
    coverageHorizon: str(input.coveragePeriodYears),
    existingCoverageNote: str(input.existingCoverage),
    riskTolerance: str(input.riskTolerance),
    // No fixture states tobacco use or a desired amount; both stay unknown
    // rather than being guessed from age, budget or goal.
    tobaccoUse: str(client.tobaccoUse ?? input.tobaccoUse),
    desiredCoverageAmount: num(input.desiredCoverageAmount ?? client.desiredCoverageAmount),
    replacementContext: detectReplacementContext({
      existingCoverage: input.existingCoverage,
      goal: syntheticCase.goal,
      clientQuestions: input.clientQuestions,
    }),
    clientQuestions: stringList(input.clientQuestions),
  };
}
