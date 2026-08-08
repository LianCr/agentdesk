// Client-side mirrors of the review contracts, following the same convention
// as components/comparison/types.ts: the browser never imports a zod schema or
// any server module.

import type {
  ComparisonStatus,
  UiClientContext,
  UiMissingInfo,
  UiObservation,
  UiProductRef,
  UiRow,
} from "../comparison/types";

export type ReviewState = "pending_review" | "approved" | "rejected" | "revision_requested";
export type WorkflowDecision =
  | "allow_internal_draft"
  | "allow_checklist_only"
  | "block_client_draft";
export type RequiredApprovalLevel =
  | "not_required_for_internal_view"
  | "standard_approval"
  | "enhanced_review"
  | "licensed_agent_required"
  | "blocked";

export interface ReviewSummaryView {
  reviewId: string;
  reviewState: ReviewState;
  workflowDecision: WorkflowDecision;
  requiredApprovalLevel: RequiredApprovalLevel;
  clientDisplayName: string | null;
  clientCaseId: string | null;
  productAName: string;
  productBName: string;
  reviewReasonCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UiChecklistItem {
  key: string;
  labelZh: string;
  labelEn: string;
  sourceKind: "fixture_checklist" | "missing_client_info" | "review_flag";
}

export interface UiReviewEvent {
  eventId: string;
  reviewId: string;
  eventType: "REVIEW_CREATED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  actor: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/** The frozen artifact, exactly as stored. */
export interface ReviewSnapshotView {
  schemaVersion: number;
  comparisonId: string;
  productA: UiProductRef;
  productB: UiProductRef;
  clientContext: UiClientContext | null;
  dimensions: UiRow[];
  observations: UiObservation[];
  missingClientInformation: UiMissingInfo[];
  comparisonStatus: ComparisonStatus;
  reviewReasons: string[];
  disclaimerZh: string;
  disclaimerEn: string;
}

export interface ReviewDetailView {
  reviewId: string;
  sourceType: string;
  snapshot: ReviewSnapshotView;
  snapshotSha256: string;
  workflowDecision: WorkflowDecision;
  requiredApprovalLevel: RequiredApprovalLevel;
  reviewReasons: string[];
  checklist: UiChecklistItem[];
  reviewState: ReviewState;
  reviewer: string | null;
  decisionNote: string | null;
  revisionInstructions: string | null;
  createdAt: string;
  updatedAt: string;
  citationUrls: Record<string, string>;
  events: UiReviewEvent[];
}

export const REVIEW_STATE_LABELS: Record<ReviewState, { zh: string; en: string }> = {
  pending_review: { zh: "待审核", en: "Pending review" },
  approved: { zh: "已批准", en: "Approved" },
  rejected: { zh: "已拒绝", en: "Rejected" },
  revision_requested: { zh: "要求修改", en: "Revision requested" },
};

export const WORKFLOW_DECISION_LABELS: Record<WorkflowDecision, { zh: string; en: string }> = {
  allow_internal_draft: { zh: "可用于内部草稿", en: "Internal draft allowed" },
  allow_checklist_only: { zh: "仅可输出核对清单", en: "Checklist only" },
  block_client_draft: { zh: "不得用于对外文案", en: "Client-facing use blocked" },
};

export const APPROVAL_LEVEL_LABELS: Record<RequiredApprovalLevel, { zh: string; en: string }> = {
  not_required_for_internal_view: { zh: "内部查看无需审批", en: "No approval needed to view internally" },
  standard_approval: { zh: "标准审批", en: "Standard approval" },
  enhanced_review: { zh: "强化审核", en: "Enhanced review" },
  licensed_agent_required: { zh: "需持牌经纪人审核", en: "Licensed agent review required" },
  blocked: { zh: "无法批准", en: "Cannot be approved" },
};
