import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadComparisonCatalog } from "../comparison/loader";
import { listReviewEvents } from "../supabase/reviews-repository";
import type { ReviewSnapshot } from "./snapshot";
import type { ReviewEvent, ReviewItemRecord } from "./types";

// What a reviewer is shown.
//
// The snapshot is returned VERBATIM. Nothing here recomputes a comparison from
// today's product data: the whole point of the frozen artifact is that a
// decision recorded six months ago still refers to the table that was on
// screen when it was made. The only thing reconstructed is the PDF link for
// each citation, and that is derived from the snapshot's own documentId and
// page — code-owned, never a stored URL.

export interface ReviewDetail {
  reviewId: string;
  sourceType: string;
  snapshot: ReviewSnapshot;
  snapshotSha256: string;
  workflowDecision: ReviewItemRecord["workflowDecision"];
  requiredApprovalLevel: ReviewItemRecord["requiredApprovalLevel"];
  reviewReasons: ReviewItemRecord["reviewReasons"];
  checklist: ReviewItemRecord["checklist"];
  reviewState: ReviewItemRecord["reviewState"];
  reviewer: string | null;
  decisionNote: string | null;
  revisionInstructions: string | null;
  createdAt: string;
  updatedAt: string;
  citationUrls: Record<string, string>;
  events: ReviewEvent[];
}

export async function buildReviewDetail(
  db: SupabaseClient,
  item: ReviewItemRecord,
): Promise<ReviewDetail> {
  const snapshot = item.snapshot as ReviewSnapshot;
  const { fileByDocumentId } = await loadComparisonCatalog();

  const citationUrls: Record<string, string> = {};
  for (const row of snapshot.dimensions) {
    for (const cell of row.cells) {
      for (const citation of cell.citations) {
        const file = fileByDocumentId.get(citation.documentId);
        if (file) citationUrls[citation.citationId] = `/documents/${file}#page=${citation.pageStart}`;
      }
    }
  }

  return {
    reviewId: item.reviewId,
    sourceType: item.sourceType,
    snapshot,
    snapshotSha256: item.snapshotSha256,
    workflowDecision: item.workflowDecision,
    requiredApprovalLevel: item.requiredApprovalLevel,
    reviewReasons: item.reviewReasons,
    checklist: item.checklist,
    reviewState: item.reviewState,
    reviewer: item.reviewer,
    decisionNote: item.decisionNote,
    revisionInstructions: item.revisionInstructions,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    citationUrls,
    events: await listReviewEvents(db, item.reviewId),
  };
}
