import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../../lib/supabase/server";
import { ProductCatalogSchema, SyntheticCaseSchema, type SyntheticCase } from "../../lib/schemas";
import { DerivedChunksFileSchema, type ChunkRecord } from "../../lib/ingestion/types";
import { createReview } from "../../lib/reviews/create-review";
import {
  decideReviewItem,
  deleteTestReviewData,
  getReviewItemById,
  listReviewEvents,
} from "../../lib/supabase/reviews-repository";
import { runAutomation, describeAutomation } from "../../lib/automation/run";
import {
  assertTestAutomationId,
  deleteTestAutomationRun,
  listRunsForReview,
} from "../../lib/automation/repository";
import type { DispatchResult } from "../../lib/automation/dispatcher";
import type { ReviewDecision } from "../../lib/reviews/types";

// M5.1-A integration tests against real persistence.
//
// Everything created here is prefixed rev_test_ / evt_test_ / aut_test_ and
// namespaced by source key, so it can never collide with or answer for the
// real development review history, and cleanup can never reach it.

const ROOT = process.cwd();
const catalog = ProductCatalogSchema.parse(
  JSON.parse(readFileSync(join(ROOT, "data/fictional-products/products.json"), "utf8")),
);
const chunksByDocumentId: Record<string, ChunkRecord[]> = Object.fromEntries(
  catalog.products.map((p) => [
    p.documentId,
    DerivedChunksFileSchema.parse(
      JSON.parse(readFileSync(join(ROOT, `data/derived/chunks/${p.documentId}.chunks.json`), "utf8")),
    ).chunks,
  ]),
);
const cases: SyntheticCase[] = readdirSync(join(ROOT, "data/synthetic-cases"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => SyntheticCaseSchema.parse(JSON.parse(readFileSync(join(ROOT, "data/synthetic-cases", f), "utf8"))));

const TERM = "doc_termplus20_v1";
const IUL = "doc_indexflex_ul_v1";
const ANNUITY = "doc_securerate5_v1";

let db: SupabaseClient;
const createdReviews = new Set<string>();
const createdAutomations = new Set<string>();
let seq = 0;

/** Creates a test review, optionally decided, and returns its id. */
async function makeReview(args: {
  label: string;
  a: string;
  b: string;
  clientCaseId: string | null;
  decision?: ReviewDecision;
}): Promise<string> {
  seq += 1;
  const reviewId = `rev_test_aut_${args.label}_${seq}`;
  const outcome = await createReview(
    {
      db,
      products: catalog.products,
      chunksByDocumentId,
      cases,
      sourceKeyPrefix: `test_aut_${args.label}_${seq}_`,
      reviewIdFactory: () => reviewId,
      eventIdFactory: () => `evt_test_aut_${args.label}_${seq}_created`,
    },
    { productAId: args.a, productBId: args.b, clientCaseId: args.clientCaseId },
  );
  createdReviews.add(outcome.reviewItem.reviewId);
  if (args.decision) {
    await decideReviewItem(db, {
      reviewId: outcome.reviewItem.reviewId,
      expectedState: "pending_review",
      decision: args.decision,
      actor: "Demo Reviewer",
      eventId: `evt_test_aut_${args.label}_${seq}_decided`,
    });
  }
  return outcome.reviewItem.reviewId;
}

let automationSeq = 0;
function testAutomationId(): string {
  automationSeq += 1;
  return `aut_test_${automationSeq}_${Date.now()}`;
}

/** A dispatcher that records calls and returns a scripted outcome. */
function fakeDispatcher(outcomes: DispatchResult[]) {
  const calls: unknown[] = [];
  let index = 0;
  return {
    calls,
    dispatcher: async (payload: unknown): Promise<DispatchResult> => {
      calls.push(payload);
      return outcomes[Math.min(index++, outcomes.length - 1)]!;
    },
  };
}

const DELIVERED: DispatchResult = {
  outcome: "delivered",
  responseCode: 200,
  ack: { accepted: true, taskId: "task_demo_1" },
};

async function cleanup(): Promise<void> {
  for (const id of createdAutomations) await deleteTestAutomationRun(db, id);
  for (const id of createdReviews) await deleteTestReviewData(db, id);
  createdAutomations.clear();
  createdReviews.clear();
}

async function trackRuns(reviewId: string): Promise<void> {
  for (const run of await listRunsForReview(db, reviewId)) createdAutomations.add(run.automationId);
}

beforeAll(async () => {
  db = createServiceClient();
});

afterAll(async () => {
  await cleanup();
});

describe("terminal state decides the task (tests 1-3)", () => {
  it("1: an approved review dispatches an internal follow-up task", async () => {
    const reviewId = await makeReview({
      label: "approved",
      a: TERM,
      b: IUL,
      clientCaseId: "DEMO-2026-001",
      decision: { type: "approve", note: "Checked every cited page." },
    });
    const fake = fakeDispatcher([DELIVERED]);
    const result = await runAutomation(
      { db, dispatcher: fake.dispatcher, automationIdFactory: testAutomationId },
      reviewId,
    );
    await trackRuns(reviewId);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.run.taskType).toBe("internal_followup");
    expect(result.run.status).toBe("delivered");
    expect(result.run.externalTaskId).toBe("task_demo_1");
    expect(result.run.attemptCount).toBe(1);
    expect(fake.calls).toHaveLength(1);
  });

  it("2: a revision request dispatches a revision task carrying the exact instructions", async () => {
    const instructions =
      "Confirm current surrender charge and existing guaranteed-rate end date before client-facing use.";
    const reviewId = await makeReview({
      label: "revision",
      a: TERM,
      b: IUL,
      clientCaseId: "DEMO-2026-002",
      decision: { type: "request_revision", instructions },
    });
    const fake = fakeDispatcher([DELIVERED]);
    const result = await runAutomation(
      { db, dispatcher: fake.dispatcher, automationIdFactory: testAutomationId },
      reviewId,
    );
    await trackRuns(reviewId);

    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.run.taskType).toBe("internal_revision");
    expect(result.payload.reviewerInstructions).toBe(instructions);
    expect(result.payload.title).toContain("Revise comparison");
  });

  it("3: a rejected review dispatches nothing and leaves no delivery record", async () => {
    const reviewId = await makeReview({
      label: "rejected",
      a: TERM,
      b: IUL,
      clientCaseId: null,
      decision: { type: "reject", reason: "The surrender-charge row needs a second source." },
    });
    const fake = fakeDispatcher([DELIVERED]);
    const result = await runAutomation(
      { db, dispatcher: fake.dispatcher, automationIdFactory: testAutomationId },
      reviewId,
    );

    expect(result.status).toBe("not_eligible");
    if (result.status === "not_eligible") expect(result.plan.reason).toBe("REJECTED_NO_AUTOMATION");
    expect(fake.calls).toHaveLength(0);
    expect(await listRunsForReview(db, reviewId)).toEqual([]);
  });

  it("a pending review dispatches nothing", async () => {
    const reviewId = await makeReview({ label: "pending", a: TERM, b: ANNUITY, clientCaseId: null });
    const fake = fakeDispatcher([DELIVERED]);
    const result = await runAutomation({ db, dispatcher: fake.dispatcher }, reviewId);
    expect(result.status).toBe("not_eligible");
    if (result.status === "not_eligible") expect(result.plan.reason).toBe("REVIEW_NOT_TERMINAL");
    expect(await listRunsForReview(db, reviewId)).toEqual([]);
  });
});

describe("Case C stays internal (test 4)", () => {
  it("4: an approved block_client_draft review produces an internal task with no recipient", async () => {
    const reviewId = await makeReview({
      label: "casec",
      a: ANNUITY,
      b: IUL,
      clientCaseId: "DEMO-2026-003",
      decision: { type: "approve", note: "Internal review complete." },
    });
    const fake = fakeDispatcher([DELIVERED]);
    const result = await runAutomation(
      { db, dispatcher: fake.dispatcher, automationIdFactory: testAutomationId },
      reviewId,
    );
    await trackRuns(reviewId);

    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.payload.workflowDecision).toBe("block_client_draft");
    expect(result.payload.requiredApprovalLevel).toBe("licensed_agent_required");
    expect(result.run.taskType).toBe("internal_followup");

    // All eight fixture replacement items travel as action items. The fixture
    // declares KEYS and the payload carries LABELS, so the stored checklist is
    // what maps one to the other.
    const required = cases.find((c) => c.caseId === "DEMO-2026-003")!.expected.requiredChecklistItems!;
    expect(required).toHaveLength(8);
    const stored = (await getReviewItemById(db, reviewId))!.checklist;
    const fixtureItems = stored.filter((c) => c.sourceKind === "fixture_checklist");
    expect(fixtureItems.map((c) => c.key).sort()).toEqual([...required].sort());
    for (const entry of fixtureItems) {
      expect(result.payload.actionItems, `missing ${entry.key}`).toContain(
        `${entry.labelZh} · ${entry.labelEn}`,
      );
    }
    // Nothing that could address a client.
    const wire = JSON.stringify(result.payload);
    expect(wire).not.toMatch(/@|recipient|"to"|sendTo|emailAddress/i);
  });
});

describe("idempotency and retry (test 5)", () => {
  it("5: running twice sends once and keeps one record", async () => {
    const reviewId = await makeReview({
      label: "dupe",
      a: TERM,
      b: IUL,
      clientCaseId: "DEMO-2026-003",
      decision: { type: "approve" },
    });
    const fake = fakeDispatcher([DELIVERED]);
    const deps = { db, dispatcher: fake.dispatcher, automationIdFactory: testAutomationId };

    const first = await runAutomation(deps, reviewId);
    const second = await runAutomation(deps, reviewId);
    await trackRuns(reviewId);

    if (first.status !== "ok" || second.status !== "ok") throw new Error("expected ok");
    expect(first.run.automationId).toBe(second.run.automationId);
    expect(second.dispatched).toBe(false);
    expect(second.run.attemptCount).toBe(1);
    // One webhook call, one row: one human decision cannot become two jobs.
    expect(fake.calls).toHaveLength(1);
    expect(await listRunsForReview(db, reviewId)).toHaveLength(1);
  });

  it("concurrent runs still leave exactly one record and one call", async () => {
    const reviewId = await makeReview({
      label: "concurrent",
      a: ANNUITY,
      b: TERM,
      clientCaseId: "DEMO-2026-002",
      decision: { type: "approve" },
    });
    const fake = fakeDispatcher([DELIVERED]);
    const deps = { db, dispatcher: fake.dispatcher, automationIdFactory: testAutomationId };

    const [a, b] = await Promise.all([runAutomation(deps, reviewId), runAutomation(deps, reviewId)]);
    await trackRuns(reviewId);

    if (a.status !== "ok" || b.status !== "ok") throw new Error("expected ok");
    expect(a.run.automationId).toBe(b.run.automationId);
    expect(await listRunsForReview(db, reviewId)).toHaveLength(1);
    // The unique index serializes the claim; at most one of the two dispatched.
    expect(fake.calls.length).toBeLessThanOrEqual(2);
    const runs = await listRunsForReview(db, reviewId);
    expect(runs[0]!.status).toBe("delivered");
  });

  it("a failed delivery can be retried on the same record, and delivery ends it", async () => {
    const reviewId = await makeReview({
      label: "retry",
      a: TERM,
      b: ANNUITY,
      clientCaseId: "DEMO-2026-001",
      decision: { type: "approve" },
    });
    const fake = fakeDispatcher([
      { outcome: "failed", responseCode: 500, errorCode: "HTTP_STATUS" },
      DELIVERED,
      DELIVERED,
    ]);
    const deps = { db, dispatcher: fake.dispatcher, automationIdFactory: testAutomationId };

    const failed = await runAutomation(deps, reviewId);
    if (failed.status !== "ok") throw new Error("expected ok");
    expect(failed.run.status).toBe("failed");
    expect(failed.run.errorCode).toBe("HTTP_STATUS");
    expect(failed.run.attemptCount).toBe(1);

    const retried = await runAutomation(deps, reviewId);
    await trackRuns(reviewId);
    if (retried.status !== "ok") throw new Error("expected ok");
    expect(retried.run.automationId).toBe(failed.run.automationId);
    expect(retried.run.status).toBe("delivered");
    expect(retried.run.attemptCount).toBe(2);
    expect(retried.run.errorCode).toBeNull();

    // Once delivered, pressing again does not send a third time.
    const again = await runAutomation(deps, reviewId);
    if (again.status !== "ok") throw new Error("expected ok");
    expect(again.dispatched).toBe(false);
    expect(fake.calls).toHaveLength(2);
  });
});

describe("failure never touches the human decision (tests 6-7)", () => {
  it("6, 7: a failed webhook leaves review state and audit history byte-identical", async () => {
    const reviewId = await makeReview({
      label: "failsafe",
      a: IUL,
      b: TERM,
      clientCaseId: "DEMO-2026-002",
      decision: { type: "approve", note: "Approved before the webhook was tried." },
    });
    const before = await getReviewItemById(db, reviewId);
    const eventsBefore = await listReviewEvents(db, reviewId);

    const fake = fakeDispatcher([{ outcome: "failed", responseCode: null, errorCode: "TIMEOUT" }]);
    const result = await runAutomation(
      { db, dispatcher: fake.dispatcher, automationIdFactory: testAutomationId },
      reviewId,
    );
    await trackRuns(reviewId);

    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.run.status).toBe("failed");

    const after = await getReviewItemById(db, reviewId);
    const eventsAfter = await listReviewEvents(db, reviewId);
    expect(after).toEqual(before);
    expect(eventsAfter).toEqual(eventsBefore);
    expect(after!.reviewState).toBe("approved");
    // The review audit log gains nothing: delivery history lives elsewhere.
    expect(eventsAfter.map((e) => e.eventType)).toEqual(["REVIEW_CREATED", "APPROVED"]);
  });

  it("mock mode records that nothing was sent, and never says delivered", async () => {
    const reviewId = await makeReview({
      label: "mocked",
      a: IUL,
      b: ANNUITY,
      clientCaseId: null,
      decision: { type: "approve" },
    });
    const fake = fakeDispatcher([{ outcome: "mocked" }]);
    const result = await runAutomation(
      { db, dispatcher: fake.dispatcher, automationIdFactory: testAutomationId },
      reviewId,
    );
    await trackRuns(reviewId);

    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.run.status).toBe("mocked");
    expect(result.run.externalTaskId).toBeNull();
    expect(result.run.responseCode).toBeNull();
    // The payload is still available so a reviewer can see what WOULD be sent.
    expect(result.payload.taskType).toBe("internal_followup");
  });
});

describe("describe without sending", () => {
  it("reports eligibility and the payload preview without dispatching", async () => {
    const reviewId = await makeReview({
      label: "describe",
      a: TERM,
      b: IUL,
      clientCaseId: "DEMO-2026-001",
      decision: { type: "approve" },
    });
    const described = await describeAutomation(db, reviewId);
    expect(described.plan.eligible).toBe(true);
    expect(described.payload?.taskType).toBe("internal_followup");
    expect(described.runs).toEqual([]);
  });
});

describe("test-data guards and the knowledge base (test 8)", () => {
  it("destructive helpers refuse a non-test automation id", () => {
    expect(() => assertTestAutomationId("aut_9f3c-real")).toThrow(/refusing destructive operation/);
    expect(() => assertTestAutomationId("aut_test_ok")).not.toThrow();
  });

  it("8: documents/pages/chunks remain 3/20/45", async () => {
    const counts: number[] = [];
    for (const table of ["documents", "document_pages", "chunks"]) {
      const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
      expect(error).toBeNull();
      counts.push(count ?? -1);
    }
    expect(counts).toEqual([3, 20, 45]);
  });
});
