import type { DetectedLanguage } from "./language.js";
import type { RetrievalQueryKind } from "./types.js";

// Thresholds and route policy LOCKED from measured calibration —
// docs/retrieval-calibration.md, 2026-08-06, 45 live chunks,
// text-embedding-3-large@1536. Do not tune without re-running
// scripts/calibrate-retrieval.ts and bumping the version.
//
// Key measured finding: gold scores for answerable questions (min 0.395,
// P4 negative-fact probe) OVERLAP with the top scores of intentionally-
// missing questions (0.513–0.570, related-context-only). A score threshold
// therefore CANNOT decide answer sufficiency — that is owned by citation
// validation in M3-B. Scores serve only as weak floors:

export const RETRIEVAL_CALIBRATION_VERSION = 1;

// Chunks below this never enter the evidence pool (unrelated tail; the
// weakest measured gold chunk scored 0.395).
export const EVIDENCE_FLOOR = 0.3;

// If the best hit is below this, the query is likely off-topic for the
// corpus — an insufficient-evidence signal (never a sufficiency proof).
export const LOW_RELEVANCE_TOP = 0.35;

// Route policy per measured baseline comparison (A original / B +glossary /
// C +LLM rewrite):
// - zh:    C materially improves (P2: A missed hit@1 at 0.459; C hit@1 at
//          0.590; P6: 0.545 -> 0.595). Keep original+glossary+rewrite.
// - mixed: B suffices and C added rank noise (P3: C demoted gold to rank 2).
//          Keep original+glossary; no LLM rewrite.
// - en:    single-route (all en probes hit@1 >= 0.608 without help).
export function routesFor(language: DetectedLanguage): RetrievalQueryKind[] {
  switch (language) {
    case "zh":
      return ["original", "glossary", "rewrite"];
    case "mixed":
      return ["original", "glossary"];
    default:
      return ["original"];
  }
}
