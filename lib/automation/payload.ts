import type { ReviewEvent, ReviewItemRecord } from "../reviews/types";
import type { ReviewSnapshot } from "../reviews/snapshot";
import {
  AUTOMATION_SCHEMA_VERSION,
  AutomationPayloadSchema,
  buildIdempotencyKey,
  type AutomationPayload,
  type TaskType,
} from "./types";

// What leaves the building.
//
// Every field is named explicitly. The review record is never spread in, so a
// field added to the review contract later cannot start leaving on its own.
// Deliberately absent: the 30-60 KB snapshot, chunk ids, embeddings, database
// UUIDs, the source key, environment values, secrets, and any recipient or
// address field.
//
// The wording is a deterministic template. A model here would add nothing --
// the action items already exist as the reviewer's checklist and the
// reviewer's own instructions -- while adding a way to say something the
// documents do not.

export function buildAutomationPayload(args: {
  item: ReviewItemRecord;
  taskType: TaskType;
  triggerEvent: ReviewEvent;
  now: string;
}): AutomationPayload {
  const snapshot = args.item.snapshot as ReviewSnapshot;
  const productA = snapshot.productA.productName;
  const productB = snapshot.productB.productName;
  const clientDisplayName = snapshot.clientContext?.displayName ?? null;
  const pair = `${productA} × ${productB}`;

  const title =
    args.taskType === "internal_revision"
      ? `Revise comparison: ${pair}`
      : `Follow up: ${pair}`;

  return AutomationPayloadSchema.parse({
    schemaVersion: AUTOMATION_SCHEMA_VERSION,
    idempotencyKey: buildIdempotencyKey(args.item.reviewId, args.triggerEvent.eventId),
    reviewId: args.item.reviewId,
    taskType: args.taskType,
    reviewState: args.item.reviewState,
    workflowDecision: args.item.workflowDecision,
    requiredApprovalLevel: args.item.requiredApprovalLevel,
    clientDisplayName,
    products: [productA, productB],
    title: clientDisplayName ? `${title} (${clientDisplayName})` : title,
    // The checklist the reviewer was actually shown, verbatim. Case C's eight
    // replacement items arrive here unchanged; nothing regulatory is invented.
    actionItems: args.item.checklist.map((entry) => `${entry.labelZh} · ${entry.labelEn}`),
    reviewerInstructions:
      args.taskType === "internal_revision" ? args.item.revisionInstructions : null,
    reviewUrl: `/review/${args.item.reviewId}`,
    createdAt: args.now,
  });
}
