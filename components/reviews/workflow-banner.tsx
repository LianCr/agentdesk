import type { ComparisonStatus } from "../comparison/types";
import { ReviewBanner } from "../comparison/review-banner";
import { RailCell, StatusRail, type RailTone } from "../shell/status-rail";
import {
  APPROVAL_LEVEL_LABELS,
  REVIEW_STATE_LABELS,
  WORKFLOW_DECISION_LABELS,
  type RequiredApprovalLevel,
  type ReviewState,
  type WorkflowDecision,
} from "./types";

// Four separate questions, shown as four separate answers.
//
// Collapsing them into one "high risk" badge is exactly the mistake this
// project is trying not to make: "the facts check out", "this must not go to a
// client", "a licensed agent has to look at it" and "nobody has looked yet"
// are independent, and a reviewer who cannot tell them apart cannot act.

const STATUS_LABELS: Record<ComparisonStatus, { zh: string; en: string }> = {
  complete: { zh: "完整", en: "Complete" },
  partial: { zh: "部分完整", en: "Partial" },
  blocked: { zh: "无法核验", en: "Blocked" },
};

function Axis({
  testId,
  caption,
  zh,
  en,
  tone,
}: {
  testId: string;
  caption: string;
  zh: string;
  en: string;
  tone: RailTone;
}) {
  return (
    <RailCell testId={testId} caption={caption} tone={tone} className="sm:basis-1/4">
      <span data-register="zh" className="block whitespace-nowrap">
        {zh}
      </span>
      <span data-register="en" className="block text-xs font-normal text-slate-300">
        {en}
      </span>
    </RailCell>
  );
}

export function WorkflowBanner({
  comparisonStatus,
  workflowDecision,
  requiredApprovalLevel,
  reviewState,
  reasons = [],
}: {
  comparisonStatus: ComparisonStatus;
  workflowDecision: WorkflowDecision;
  requiredApprovalLevel: RequiredApprovalLevel;
  reviewState: ReviewState;
  /** Why this item is here. Rendered inside the banner, not as a second one. */
  reasons?: string[];
}) {
  const blocksClientUse = workflowDecision === "block_client_draft";
  const factsTone: RailTone =
    comparisonStatus === "complete" ? "ok" : comparisonStatus === "partial" ? "attention" : "stop";
  const approvalTone: RailTone =
    requiredApprovalLevel === "blocked"
      ? "stop"
      : requiredApprovalLevel === "licensed_agent_required" || requiredApprovalLevel === "enhanced_review"
        ? "attention"
        : "neutral";
  return (
    <section
      data-testid="workflow-banner"
      data-workflow-decision={workflowDecision}
      data-required-approval-level={requiredApprovalLevel}
      data-review-state={reviewState}
      role="note"
      className="flex flex-col gap-4"
    >
      <StatusRail aria-label="工作流状态 Workflow status">
        <Axis
          testId="axis-comparison-status"
          caption="产品事实 Product facts"
          zh={`比较${STATUS_LABELS[comparisonStatus].zh}`}
          en={`Comparison: ${STATUS_LABELS[comparisonStatus].en}`}
          tone={factsTone}
        />
        <Axis
          testId="axis-workflow-decision"
          caption="可否对外使用 Client-facing use"
          zh={WORKFLOW_DECISION_LABELS[workflowDecision].zh}
          en={WORKFLOW_DECISION_LABELS[workflowDecision].en}
          tone={blocksClientUse ? "stop" : "neutral"}
        />
        <Axis
          testId="axis-required-approval"
          caption="所需审核 Required review"
          zh={APPROVAL_LEVEL_LABELS[requiredApprovalLevel].zh}
          en={APPROVAL_LEVEL_LABELS[requiredApprovalLevel].en}
          tone={approvalTone}
        />
        <Axis
          testId="axis-review-state"
          caption="人工进度 Human progress"
          zh={REVIEW_STATE_LABELS[reviewState].zh}
          en={REVIEW_STATE_LABELS[reviewState].en}
          tone={reviewState === "pending_review" ? "attention" : "neutral"}
        />
      </StatusRail>

      {reasons.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <ReviewBanner reasons={reasons} />
        </div>
      )}

      {blocksClientUse && (
        <p data-testid="client-facing-restriction" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-900">
          此比较仍可用于内部审阅，但在审核流程完成前不得作为对外客户文案使用。这是本演示项目的业务政策，
          不是普遍法律义务。
          <br />
          This comparison remains available for internal review, but it should not be used as a
          client-facing draft until the review workflow is completed. This is this demonstration&apos;s
          business rule, not a universal legal requirement.
        </p>
      )}
    </section>
  );
}
