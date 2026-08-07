import { LOW_RELEVANCE_TOP } from "../retrieval/thresholds.js";
import type { EvidenceStatus } from "./types.js";

// Deterministic evidence sufficiency. Calibration (docs/retrieval-
// calibration.md) proved similarity scores cannot decide answerability, so
// sufficiency is claim/evidence based:
//   strong       all factual claims validated, nothing requested is missing
//   partial      some validated facts + explicitly listed gaps
//   insufficient nothing validated (or clearly off-topic retrieval)
// A single accurate chunk is sufficient; chunk count is never an input.

export interface SufficiencyInput {
  supportedFactualClaims: number;
  unsupportedFactualClaims: number; // dropped by citation validation
  missingInformationCount: number;
  topSimilarityScore: number | null; // null when retrieval returned nothing
}

export function computeEvidenceStatus(input: SufficiencyInput): EvidenceStatus {
  if (input.supportedFactualClaims === 0) return "insufficient";
  if (input.topSimilarityScore !== null && input.topSimilarityScore < LOW_RELEVANCE_TOP) {
    return "insufficient"; // off-topic signal; never a sufficiency proof in reverse
  }
  if (input.unsupportedFactualClaims > 0 || input.missingInformationCount > 0) {
    return "partial";
  }
  return "strong";
}
