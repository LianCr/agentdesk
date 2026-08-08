import { createHash } from "node:crypto";
import type { ComparisonDraft } from "../comparison/types";
import { canonicalJson } from "./types";

// The frozen artifact a reviewer actually reviews.
//
// It is the DETERMINISTIC core of a comparison draft and nothing else. The
// optional narrative is deliberately excluded: it is model-generated
// presentation that may differ run to run, and a reviewer signing off on
// "these facts, from these pages" should not be signing off on prose that was
// never part of the decision. Stripping it also keeps the hash meaningful —
// the same comparison always snapshots identically.

export interface ReviewSnapshot {
  schemaVersion: 1;
  comparisonId: string;
  productA: ComparisonDraft["productA"];
  productB: ComparisonDraft["productB"];
  clientContext: ComparisonDraft["clientContext"];
  dimensions: ComparisonDraft["dimensions"];
  observations: ComparisonDraft["observations"];
  missingClientInformation: ComparisonDraft["missingClientInformation"];
  comparisonStatus: ComparisonDraft["comparisonStatus"];
  reviewReasons: ComparisonDraft["reviewReasons"];
  disclaimerZh: string;
  disclaimerEn: string;
  meta: {
    comparisonEngineVersion: number;
    factRegistryVersion: number;
  };
}

/**
 * Freezes the deterministic core. Cells keep their availability, raw and
 * display values, provenance and citations, so the reviewer sees exactly the
 * table that was generated — including which facts were derived and which
 * pages back them.
 */
export function buildReviewSnapshot(draft: ComparisonDraft): ReviewSnapshot {
  return {
    schemaVersion: 1,
    comparisonId: draft.comparisonId,
    productA: draft.productA,
    productB: draft.productB,
    clientContext: draft.clientContext,
    dimensions: draft.dimensions,
    observations: draft.observations,
    missingClientInformation: draft.missingClientInformation,
    comparisonStatus: draft.comparisonStatus,
    reviewReasons: draft.reviewReasons,
    disclaimerZh: draft.disclaimerZh,
    disclaimerEn: draft.disclaimerEn,
    // Latency and narrative model are runtime facts about one execution, not
    // properties of the artifact, so they are not part of what was reviewed.
    meta: {
      comparisonEngineVersion: draft.meta.comparisonEngineVersion,
      factRegistryVersion: draft.meta.factRegistryVersion,
    },
  };
}

/**
 * Hashes the canonical form, so key insertion order cannot change the hash
 * while any change to a fact, a citation, a page or the client context does.
 * Arrays keep their order: dimension order, citation order and observation
 * order are all meaningful.
 */
export function hashReviewSnapshot(snapshot: ReviewSnapshot): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}
