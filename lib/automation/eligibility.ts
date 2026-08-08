import type { ReviewEvent, ReviewItemRecord } from "../reviews/types";
import type { EligibilityReason, TaskType } from "./types";

// Whether automation may fire, and which task it would be.
//
// Pure, no IO, no model. A model cannot decide whether a webhook fires, which
// workflow runs, or whether Case C is cleared -- those are the decisions that
// would matter if they were wrong, so they are made here from stored data.

export type AutomationPlan =
  | { eligible: false; reason: EligibilityReason }
  | { eligible: true; taskType: TaskType; triggerEvent: ReviewEvent };

const TERMINAL_EVENT_FOR: Record<string, string> = {
  approved: "APPROVED",
  revision_requested: "REVISION_REQUESTED",
};

export function computeAutomationPlan(
  item: ReviewItemRecord,
  events: readonly ReviewEvent[],
): AutomationPlan {
  // Fail closed on the fact layer first. `allow_checklist_only` means the
  // comparison could not be verified; M5's state machine keys only on
  // reviewState, so such an item can still be approved by a reviewer. Nothing
  // downstream of unverifiable facts should become a task.
  if (item.workflowDecision === "allow_checklist_only") {
    return { eligible: false, reason: "FACTS_UNVERIFIED" };
  }
  if (item.reviewState === "pending_review") {
    return { eligible: false, reason: "REVIEW_NOT_TERMINAL" };
  }
  // A rejection is a decision not to proceed. Creating follow-up work from it
  // would be automation noise, and there is no artifact to follow up on.
  if (item.reviewState === "rejected") {
    return { eligible: false, reason: "REJECTED_NO_AUTOMATION" };
  }

  // The decision's own audit event is the automation's identity (see
  // buildIdempotencyKey). Without it there is nothing stable to deduplicate on,
  // so refuse rather than invent one.
  const expected = TERMINAL_EVENT_FOR[item.reviewState];
  const triggerEvent = events.find((event) => event.eventType === expected);
  if (!triggerEvent) {
    return { eligible: false, reason: "MISSING_TERMINAL_EVENT" };
  }

  // block_client_draft lands here too, and gets the same INTERNAL task as any
  // other approval. It does not need excluding from a client-facing path
  // because no client-facing path exists.
  return {
    eligible: true,
    taskType: item.reviewState === "revision_requested" ? "internal_revision" : "internal_followup",
    triggerEvent,
  };
}

export const ELIGIBILITY_MESSAGES: Record<EligibilityReason, { zh: string; en: string }> = {
  REVIEW_NOT_TERMINAL: {
    zh: "尚未有人做出审核决定。",
    en: "No review decision has been made yet.",
  },
  REJECTED_NO_AUTOMATION: {
    zh: "该审核项已被拒绝,不产生后续任务。",
    en: "This review was rejected; no follow-up work is created.",
  },
  FACTS_UNVERIFIED: {
    zh: "比较事实无法核验,不产生后续任务。",
    en: "The comparison facts could not be verified; no follow-up work is created.",
  },
  MISSING_TERMINAL_EVENT: {
    zh: "缺少对应的审计事件,无法安全去重。",
    en: "The decision's audit event is missing, so the task cannot be safely deduplicated.",
  },
};
