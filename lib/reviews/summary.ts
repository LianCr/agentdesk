import type { ReviewItemRecord } from "./types";
import type { ReviewSnapshot } from "./snapshot";

// Queue projection.
//
// A stored snapshot is 30–60 KB. Sending one per row would make the queue tens
// of times larger than the page that actually shows a comparison, for data the
// queue never renders. So the queue gets exactly the columns it draws, and the
// snapshot stays behind the detail endpoint.

export interface ReviewSummary {
  reviewId: string;
  reviewState: ReviewItemRecord["reviewState"];
  workflowDecision: ReviewItemRecord["workflowDecision"];
  requiredApprovalLevel: ReviewItemRecord["requiredApprovalLevel"];
  clientDisplayName: string | null;
  clientCaseId: string | null;
  productAName: string;
  productBName: string;
  reviewReasonCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toReviewSummary(item: ReviewItemRecord): ReviewSummary {
  const snapshot = item.snapshot as ReviewSnapshot;
  return {
    reviewId: item.reviewId,
    reviewState: item.reviewState,
    workflowDecision: item.workflowDecision,
    requiredApprovalLevel: item.requiredApprovalLevel,
    clientDisplayName: snapshot.clientContext?.displayName ?? null,
    clientCaseId: snapshot.clientContext?.caseId ?? null,
    productAName: snapshot.productA.productName,
    productBName: snapshot.productB.productName,
    reviewReasonCount: item.reviewReasons.length,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
