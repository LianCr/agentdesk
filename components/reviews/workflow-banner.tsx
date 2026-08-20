import type { ComparisonStatus } from "../comparison/types";
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

const BLOCKED_TONE = "border-red-200 bg-red-50";
const NORMAL_TONE = "border-slate-200 bg-white";

function Axis({
  testId,
  caption,
  zh,
  en,
  emphasis,
}: {
  testId: string;
  caption: string;
  zh: string;
  en: string;
  emphasis?: boolean;
}) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-600">{caption}</span>
      <span
        data-register="zh"
        className={`block whitespace-nowrap text-sm ${emphasis ? "font-semibold text-red-800" : "font-medium text-slate-800"}`}
      >
        {zh}
      </span>
      <span
        data-register="en"
        className={`block text-xs ${emphasis ? "text-red-800/80" : "text-slate-600"}`}
      >
        {en}
      </span>
    </div>
  );
}

export function WorkflowBanner({
  comparisonStatus,
  workflowDecision,
  requiredApprovalLevel,
  reviewState,
}: {
  comparisonStatus: ComparisonStatus;
  workflowDecision: WorkflowDecision;
  requiredApprovalLevel: RequiredApprovalLevel;
  reviewState: ReviewState;
}) {
  const blocksClientUse = workflowDecision === "block_client_draft";
  return (
    <section
      data-testid="workflow-banner"
      data-workflow-decision={workflowDecision}
      data-required-approval-level={requiredApprovalLevel}
      data-review-state={reviewState}
      role="note"
      className={`rounded-lg border p-5 ${blocksClientUse ? BLOCKED_TONE : NORMAL_TONE}`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Axis
          testId="axis-comparison-status"
          caption="产品事实 Product facts"
          zh={`比较${STATUS_LABELS[comparisonStatus].zh}`}
          en={`Comparison: ${STATUS_LABELS[comparisonStatus].en}`}
        />
        <Axis
          testId="axis-workflow-decision"
          caption="可否对外使用 Client-facing use"
          zh={WORKFLOW_DECISION_LABELS[workflowDecision].zh}
          en={WORKFLOW_DECISION_LABELS[workflowDecision].en}
          emphasis={blocksClientUse}
        />
        <Axis
          testId="axis-required-approval"
          caption="所需审核 Required review"
          zh={APPROVAL_LEVEL_LABELS[requiredApprovalLevel].zh}
          en={APPROVAL_LEVEL_LABELS[requiredApprovalLevel].en}
          emphasis={requiredApprovalLevel === "licensed_agent_required"}
        />
        <Axis
          testId="axis-review-state"
          caption="人工进度 Human progress"
          zh={REVIEW_STATE_LABELS[reviewState].zh}
          en={REVIEW_STATE_LABELS[reviewState].en}
        />
      </div>

      {blocksClientUse && (
        <p data-testid="client-facing-restriction" className="mt-4 text-sm leading-relaxed text-red-900">
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
