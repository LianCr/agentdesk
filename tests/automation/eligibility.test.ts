import { describe, expect, it } from "vitest";
import { computeAutomationPlan } from "../../lib/automation/eligibility";
import { buildAutomationPayload } from "../../lib/automation/payload";
import { AutomationPayloadSchema, TASK_TYPES } from "../../lib/automation/types";
import type { ReviewEvent, ReviewItemRecord } from "../../lib/reviews/types";

// Offline M5.1-A tests: eligibility and payload. No database, no network, no
// model.

const SNAPSHOT = {
  schemaVersion: 1,
  comparisonId: "cmp_test",
  productA: {
    documentId: "doc_securerate5_v1",
    documentName: "Demo SecureRate 5 Product Guide",
    productName: "Demo SecureRate 5",
    productCategory: "fixed_annuity",
  },
  productB: {
    documentId: "doc_indexflex_ul_v1",
    documentName: "Demo IndexFlex UL Product Guide",
    productName: "Demo IndexFlex UL",
    productCategory: "indexed_universal_life",
  },
  clientContext: { caseId: "DEMO-2026-003", displayName: "Demo Client C", replacementContext: true },
  dimensions: [],
  observations: [],
  missingClientInformation: [],
  comparisonStatus: "complete",
  reviewReasons: [],
  disclaimerZh: "…",
  disclaimerEn: "…",
  meta: { comparisonEngineVersion: 1, factRegistryVersion: 1 },
};

function item(overrides: Partial<ReviewItemRecord> = {}): ReviewItemRecord {
  return {
    reviewId: "rev_test_case_c",
    sourceType: "comparison_draft",
    sourceKey: "test_source",
    snapshot: SNAPSHOT,
    snapshotSha256: "a".repeat(64),
    workflowDecision: "block_client_draft",
    requiredApprovalLevel: "licensed_agent_required",
    reviewReasons: ["AGE_65_PLUS", "REPLACEMENT_CONTEXT"],
    checklist: [
      {
        key: "current contract surrender charge",
        labelZh: "现有合同的退保费用",
        labelEn: "Current contract surrender charge",
        sourceKind: "fixture_checklist",
      },
      {
        key: "state replacement forms",
        labelZh: "州替换申报表",
        labelEn: "State replacement forms",
        sourceKind: "fixture_checklist",
      },
    ],
    reviewState: "approved",
    reviewer: "Demo Reviewer",
    decisionNote: "Checked every cited page.",
    revisionInstructions: null,
    createdAt: "2026-08-01T10:00:00+00:00",
    updatedAt: "2026-08-02T11:00:00+00:00",
    ...overrides,
  } as ReviewItemRecord;
}

function events(...types: ReviewEvent["eventType"][]): ReviewEvent[] {
  return types.map((eventType, index) => ({
    eventId: `evt_test_${index}`,
    reviewId: "rev_test_case_c",
    eventType,
    actor: "Demo Reviewer",
    payload: {},
    occurredAt: `2026-08-0${index + 1}T10:00:00+00:00`,
  }));
}

describe("eligibility (tests 1-4)", () => {
  it("1: an approved review yields an internal follow-up task", () => {
    const plan = computeAutomationPlan(item(), events("REVIEW_CREATED", "APPROVED"));
    expect(plan.eligible).toBe(true);
    if (plan.eligible) {
      expect(plan.taskType).toBe("internal_followup");
      expect(plan.triggerEvent.eventType).toBe("APPROVED");
    }
  });

  it("2: a revision request yields an internal revision task", () => {
    const plan = computeAutomationPlan(
      item({ reviewState: "revision_requested", revisionInstructions: "Confirm the surrender charge." }),
      events("REVIEW_CREATED", "REVISION_REQUESTED"),
    );
    expect(plan.eligible).toBe(true);
    if (plan.eligible) expect(plan.taskType).toBe("internal_revision");
  });

  it("3: a rejected review produces no automation at all", () => {
    const plan = computeAutomationPlan(
      item({ reviewState: "rejected", decisionNote: "Needs a second source." }),
      events("REVIEW_CREATED", "REJECTED"),
    );
    expect(plan.eligible).toBe(false);
    if (!plan.eligible) expect(plan.reason).toBe("REJECTED_NO_AUTOMATION");
  });

  it("a pending review is not terminal, so nothing fires", () => {
    const plan = computeAutomationPlan(
      item({ reviewState: "pending_review", reviewer: null, decisionNote: null }),
      events("REVIEW_CREATED"),
    );
    expect(plan.eligible).toBe(false);
    if (!plan.eligible) expect(plan.reason).toBe("REVIEW_NOT_TERMINAL");
  });

  it("unverified facts fail closed even when a human approved anyway", () => {
    // M5's state machine keys only on reviewState, so an item whose comparison
    // could not be verified can still be approved. Nothing downstream of that
    // should become a task.
    const plan = computeAutomationPlan(
      item({ workflowDecision: "allow_checklist_only", requiredApprovalLevel: "blocked" }),
      events("REVIEW_CREATED", "APPROVED"),
    );
    expect(plan.eligible).toBe(false);
    if (!plan.eligible) expect(plan.reason).toBe("FACTS_UNVERIFIED");
  });

  it("a terminal state with no audit event refuses rather than inventing identity", () => {
    const plan = computeAutomationPlan(item(), events("REVIEW_CREATED"));
    expect(plan.eligible).toBe(false);
    if (!plan.eligible) expect(plan.reason).toBe("MISSING_TERMINAL_EVENT");
  });
});

describe("Case C stays internal by construction (test 4)", () => {
  it("4: block_client_draft still produces an internal task, and nothing else exists", () => {
    const plan = computeAutomationPlan(item(), events("REVIEW_CREATED", "APPROVED"));
    expect(plan.eligible).toBe(true);
    if (!plan.eligible) return;
    expect(plan.taskType).toBe("internal_followup");

    const payload = buildAutomationPayload({
      item: item(),
      taskType: plan.taskType,
      triggerEvent: plan.triggerEvent,
      now: "2026-08-02T12:00:00+00:00",
    });
    expect(payload.workflowDecision).toBe("block_client_draft");

    // The safety property is structural: there is no client-facing task type
    // to exclude, and no field to put a recipient in.
    expect(TASK_TYPES).toEqual(["internal_followup", "internal_revision"]);
    const keys = Object.keys(AutomationPayloadSchema.shape);
    for (const forbidden of ["to", "recipient", "email", "emailAddress", "phone", "cc", "bcc", "sendTo"]) {
      expect(keys, `payload exposes ${forbidden}`).not.toContain(forbidden);
    }
    const serialized = JSON.stringify(payload).toLowerCase();
    expect(serialized).not.toContain("@");
    // The eight replacement items travel as the task's action items.
    expect(payload.actionItems.some((i) => i.includes("State replacement forms"))).toBe(true);
  });
});

describe("payload minimization", () => {
  it("carries what a task needs and nothing from the snapshot's internals", () => {
    const plan = computeAutomationPlan(item(), events("REVIEW_CREATED", "APPROVED"));
    if (!plan.eligible) throw new Error("expected eligible");
    const payload = buildAutomationPayload({
      item: item(),
      taskType: plan.taskType,
      triggerEvent: plan.triggerEvent,
      now: "2026-08-02T12:00:00+00:00",
    });

    expect(payload.products).toEqual(["Demo SecureRate 5", "Demo IndexFlex UL"]);
    expect(payload.clientDisplayName).toBe("Demo Client C");
    expect(payload.reviewUrl).toBe("/review/rev_test_case_c");
    expect(payload.idempotencyKey).toBe("rev_test_case_c:evt_test_1");

    const serialized = JSON.stringify(payload);
    for (const leak of ["dimensions", "citations", "chunkId", "snapshotSha256", "sourceKey", "embedding"]) {
      expect(serialized, `payload leaks ${leak}`).not.toContain(leak);
    }
    // Strict schema: an added review field cannot ride along silently.
    expect(() =>
      AutomationPayloadSchema.parse({ ...payload, snapshot: { dimensions: [] } }),
    ).toThrow();
  });

  it("the revision task carries the reviewer's exact words, and the follow-up task does not", () => {
    const instructions = "Confirm current surrender charge before client-facing use.";
    const revisionItem = item({
      reviewState: "revision_requested",
      revisionInstructions: instructions,
      decisionNote: null,
    });
    const plan = computeAutomationPlan(revisionItem, events("REVIEW_CREATED", "REVISION_REQUESTED"));
    if (!plan.eligible) throw new Error("expected eligible");
    const payload = buildAutomationPayload({
      item: revisionItem,
      taskType: plan.taskType,
      triggerEvent: plan.triggerEvent,
      now: "2026-08-02T12:00:00+00:00",
    });
    expect(payload.reviewerInstructions).toBe(instructions);
    expect(payload.title).toContain("Revise comparison");

    const approved = buildAutomationPayload({
      item: item(),
      taskType: "internal_followup",
      triggerEvent: events("REVIEW_CREATED", "APPROVED")[1]!,
      now: "2026-08-02T12:00:00+00:00",
    });
    expect(approved.reviewerInstructions).toBeNull();
    expect(approved.title).toContain("Follow up");
  });

  it("a product-only comparison needs no client name", () => {
    const noClient = item({
      snapshot: { ...SNAPSHOT, clientContext: null },
    });
    const payload = buildAutomationPayload({
      item: noClient,
      taskType: "internal_followup",
      triggerEvent: events("REVIEW_CREATED", "APPROVED")[1]!,
      now: "2026-08-02T12:00:00+00:00",
    });
    expect(payload.clientDisplayName).toBeNull();
    expect(payload.title).toBe("Follow up: Demo SecureRate 5 × Demo IndexFlex UL");
  });
});
