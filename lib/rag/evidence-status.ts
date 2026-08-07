import type { EvidenceStatus, ValidatedFacet } from "./types.js";

// Deterministic evidence sufficiency, driven by requested-fact coverage
// (M3-B.1 audit fix): status measures whether the user's CORE request is
// supported by validated claims — not whether the model listed nice-to-know
// gaps, not how many chunks were retrieved, and not the similarity score
// (calibration proved scores cannot decide answerability; the off-topic
// gate runs before the model call).
//
//   strong        every required requested facet has a validated cited claim
//   partial       some required facets supported, at least one material gap
//   insufficient  no required facet supported (or nothing validated at all)
//
// A single accurate chunk backing a single direct (even negative) fact is
// strong. Ancillary missing information and discarded non-core draft claims
// never downgrade a fully supported core request.

export function computeEvidenceStatus(facets: ValidatedFacet[], validatedFactualClaims: number): EvidenceStatus {
  const required = facets.filter((f) => f.required);
  const supported = required.filter((f) => f.supported);
  if (validatedFactualClaims === 0 || supported.length === 0) return "insufficient";
  if (supported.length < required.length) return "partial";
  return "strong";
}

export function materialMissing(facets: ValidatedFacet[]): string[] {
  return facets.filter((f) => f.required && !f.supported).map((f) => f.description);
}
