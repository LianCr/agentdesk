import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "../../lib/supabase/server";
import { canonicalJson } from "../../lib/reviews/types";
import {
  assertTestReviewId,
  decideReviewItem,
  deleteTestReviewData,
  findPendingReviewBySourceKey,
  getReviewItemById,
  insertReviewItem,
  listReviewEvents,
  listReviewItems,
  type NewReviewItem,
} from "../../lib/supabase/reviews-repository";

// M5-A database tests. Like the M2 suite, these run against the linked project
// and operate exclusively on rev_test_ / evt_test_ / test_ prefixed rows.
// Destructive helpers hard-fail on anything else, so a bug in a test can never
// touch a real review — and nothing here goes near the knowledge base.

let db: SupabaseClient;

const REVIEWS = [
  "rev_test_basic",
  "rev_test_stale",
  "rev_test_double",
  "rev_test_reject",
  "rev_test_revision",
  "rev_test_immutable",
  "rev_test_terminal",
  "rev_test_reuse_a",
  "rev_test_reuse_b",
  "rev_test_idempotent_a",
  "rev_test_idempotent_b",
  "rev_test_reuse_b_probe",
];

const SNAPSHOT = {
  comparisonId: "cmp_test",
  productA: { documentId: "doc_termplus20_v1" },
  productB: { documentId: "doc_indexflex_ul_v1" },
  dimensions: [{ dimensionId: "product_type" }],
};
const SNAPSHOT_SHA = createHash("sha256").update(canonicalJson(SNAPSHOT)).digest("hex");

function newItem(reviewId: string, overrides: Partial<NewReviewItem> = {}): NewReviewItem {
  return {
    reviewId,
    sourceType: "comparison_draft",
    sourceKey: `test_${reviewId}`,
    snapshot: SNAPSHOT,
    snapshotSha256: SNAPSHOT_SHA,
    workflowDecision: "block_client_draft",
    requiredApprovalLevel: "licensed_agent_required",
    reviewReasons: ["CLIENT_FACING_DRAFT", "AGE_65_PLUS"],
    checklist: [
      {
        key: "current_surrender_charge",
        labelZh: "现有合同退保费用",
        labelEn: "Current surrender charge",
        sourceKind: "fixture_checklist",
      },
    ],
    createdEventId: `evt_test_${reviewId}_created`,
    actor: "Demo Reviewer",
    ...overrides,
  };
}

async function cleanup(): Promise<void> {
  for (const reviewId of REVIEWS) await deleteTestReviewData(db, reviewId);
}

beforeAll(async () => {
  db = createServiceClient();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("schema (1-3)", () => {
  it("1-2: both review tables exist with RLS enabled", async () => {
    const { data, error } = await db.rpc("schema_diagnostics");
    expect(error).toBeNull();
    const rls = (data as { rls: Record<string, boolean> }).rls;
    expect(rls).toHaveProperty("review_items", true);
    expect(rls).toHaveProperty("review_events", true);
    // The M2 tables are untouched.
    for (const table of ["documents", "document_pages", "chunks", "ingestion_runs"]) {
      expect(rls).toHaveProperty(table, true);
    }
  });

  it("3: forbidden table names remain absent", async () => {
    const { data } = await db.rpc("schema_diagnostics");
    const tables = Object.keys((data as { rls: Record<string, boolean> }).rls);
    for (const banned of ["reviews", "audit_log", "followup_tasks", "cases", "comparisons", "users"]) {
      expect(tables).not.toContain(banned);
    }
  });
});

describe("creation and reads (4-5)", () => {
  it("4-5: an item round-trips with its snapshot and hash intact", async () => {
    const created = await insertReviewItem(db, newItem("rev_test_basic"));
    expect(created.action).toBe("created");
    expect(created.item.reviewState).toBe("pending_review");
    expect(created.item.reviewer).toBeNull();
    expect(created.item.snapshotSha256).toBe(SNAPSHOT_SHA);

    const fetched = await getReviewItemById(db, "rev_test_basic");
    expect(fetched).not.toBeNull();
    expect(fetched!.snapshot).toEqual(SNAPSHOT);
    // The stored snapshot still hashes to what was recorded at creation —
    // canonical form, because jsonb does not preserve key order.
    expect(createHash("sha256").update(canonicalJson(fetched!.snapshot)).digest("hex")).toBe(
      SNAPSHOT_SHA,
    );
    expect(fetched!.workflowDecision).toBe("block_client_draft");
    expect(fetched!.requiredApprovalLevel).toBe("licensed_agent_required");
    expect(fetched!.reviewReasons).toEqual(["CLIENT_FACING_DRAFT", "AGE_65_PLUS"]);

    const listed = await listReviewItems(db, { reviewState: "pending_review" });
    expect(listed.some((i) => i.reviewId === "rev_test_basic")).toBe(true);

    const events = await listReviewEvents(db, "rev_test_basic");
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe("REVIEW_CREATED");
    expect(events[0]!.actor).toBe("Demo Reviewer");
  });
});

describe("decisions mutate only what they may (6-9, 18)", () => {
  it("6-7: a decision updates the decision fields and appends exactly one event", async () => {
    await insertReviewItem(db, newItem("rev_test_double"));
    const outcome = await decideReviewItem(db, {
      reviewId: "rev_test_double",
      expectedState: "pending_review",
      decision: { type: "approve", note: "Checked against the cited pages." },
      actor: "Demo Reviewer",
      eventId: "evt_test_double_1",
    });
    expect(outcome).toEqual({ action: "decided", reviewState: "approved" });

    const item = (await getReviewItemById(db, "rev_test_double"))!;
    expect(item.reviewState).toBe("approved");
    expect(item.reviewer).toBe("Demo Reviewer");
    expect(item.decisionNote).toBe("Checked against the cited pages.");
    // Artifact untouched.
    expect(item.snapshot).toEqual(SNAPSHOT);
    expect(item.snapshotSha256).toBe(SNAPSHOT_SHA);
    expect(item.workflowDecision).toBe("block_client_draft");
    expect(item.requiredApprovalLevel).toBe("licensed_agent_required");
    expect(item.sourceKey).toBe("test_rev_test_double");

    const events = await listReviewEvents(db, "rev_test_double");
    expect(events.map((e) => e.eventType)).toEqual(["REVIEW_CREATED", "APPROVED"]);
  });

  it("8: reject stores the reason", async () => {
    await insertReviewItem(db, newItem("rev_test_reject"));
    await decideReviewItem(db, {
      reviewId: "rev_test_reject",
      expectedState: "pending_review",
      decision: { type: "reject", reason: "Cited page does not support the surrender figure." },
      actor: "Demo Reviewer",
      eventId: "evt_test_reject_1",
    });
    const item = (await getReviewItemById(db, "rev_test_reject"))!;
    expect(item.reviewState).toBe("rejected");
    expect(item.decisionNote).toBe("Cited page does not support the surrender figure.");
    const events = await listReviewEvents(db, "rev_test_reject");
    expect(events.map((e) => e.eventType)).toEqual(["REVIEW_CREATED", "REJECTED"]);
    expect(events[1]!.payload).toMatchObject({
      reason: "Cited page does not support the surrender figure.",
    });
  });

  it("9: request_revision stores the instructions", async () => {
    await insertReviewItem(db, newItem("rev_test_revision"));
    await decideReviewItem(db, {
      reviewId: "rev_test_revision",
      expectedState: "pending_review",
      decision: {
        type: "request_revision",
        instructions: "Confirm the current surrender charge before client-facing use.",
      },
      actor: "Demo Reviewer",
      eventId: "evt_test_revision_1",
    });
    const item = (await getReviewItemById(db, "rev_test_revision"))!;
    expect(item.reviewState).toBe("revision_requested");
    expect(item.revisionInstructions).toBe(
      "Confirm the current surrender charge before client-facing use.",
    );
  });

  it("18: the database refuses to let a decision rewrite the artifact", async () => {
    await insertReviewItem(db, newItem("rev_test_immutable"));
    // The repository exposes no generic update, so this reaches past it — and
    // the trigger still refuses.
    const { error } = await db
      .from("review_items")
      .update({ snapshot: { tampered: true } })
      .eq("review_id", "rev_test_immutable");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("REVIEW_ARTIFACT_IMMUTABLE");

    const { error: hashError } = await db
      .from("review_items")
      .update({ snapshot_sha256: "0".repeat(64) })
      .eq("review_id", "rev_test_immutable");
    expect(hashError).not.toBeNull();

    const { error: routingError } = await db
      .from("review_items")
      .update({ workflow_decision: "allow_internal_draft" })
      .eq("review_id", "rev_test_immutable");
    expect(routingError).not.toBeNull();

    const item = (await getReviewItemById(db, "rev_test_immutable"))!;
    expect(item.snapshot).toEqual(SNAPSHOT);
    expect(item.workflowDecision).toBe("block_client_draft");
  });
});

describe("concurrency and idempotency (10-13)", () => {
  it("10, 12: a stale decision conflicts and changes nothing", async () => {
    await insertReviewItem(db, newItem("rev_test_stale"));
    // Two tabs both read pending_review.
    const first = await decideReviewItem(db, {
      reviewId: "rev_test_stale",
      expectedState: "pending_review",
      decision: { type: "approve" },
      actor: "Demo Reviewer",
      eventId: "evt_test_stale_1",
    });
    expect(first.action).toBe("decided");

    const second = await decideReviewItem(db, {
      reviewId: "rev_test_stale",
      expectedState: "pending_review", // stale: someone approved first
      decision: { type: "reject", reason: "Disagree." },
      actor: "Demo Reviewer",
      eventId: "evt_test_stale_2",
    });
    expect(second).toEqual({ action: "conflict", reviewState: "approved" });

    const item = (await getReviewItemById(db, "rev_test_stale"))!;
    expect(item.reviewState).toBe("approved");
    const events = await listReviewEvents(db, "rev_test_stale");
    expect(events.map((e) => e.eventType)).toEqual(["REVIEW_CREATED", "APPROVED"]);
    expect(events.some((e) => e.eventType === "REJECTED")).toBe(false);
  });

  it("11: a double approve yields exactly one APPROVED event", async () => {
    const again = await decideReviewItem(db, {
      reviewId: "rev_test_double",
      expectedState: "pending_review",
      decision: { type: "approve" },
      actor: "Demo Reviewer",
      eventId: "evt_test_double_2",
    });
    expect(again.action).toBe("conflict");
    const events = await listReviewEvents(db, "rev_test_double");
    expect(events.filter((e) => e.eventType === "APPROVED")).toHaveLength(1);
  });

  it("13: a terminal item cannot transition, and the guard fires before the database", async () => {
    await insertReviewItem(db, newItem("rev_test_terminal"));
    await decideReviewItem(db, {
      reviewId: "rev_test_terminal",
      expectedState: "pending_review",
      decision: { type: "approve" },
      actor: "Demo Reviewer",
      eventId: "evt_test_terminal_1",
    });
    await expect(
      decideReviewItem(db, {
        reviewId: "rev_test_terminal",
        expectedState: "approved",
        decision: { type: "reject", reason: "Changed my mind." },
        actor: "Demo Reviewer",
        eventId: "evt_test_terminal_2",
      }),
    ).rejects.toThrow(/REVIEW_ALREADY_DECIDED/);
    const events = await listReviewEvents(db, "rev_test_terminal");
    expect(events).toHaveLength(2);
  });
});

describe("one open review per source (14-15)", () => {
  it("14: a second create for the same source returns the open item, not a new one", async () => {
    const sourceKey = "test_source_shared";
    const first = await insertReviewItem(db, newItem("rev_test_idempotent_a", { sourceKey }));
    expect(first.action).toBe("created");

    const second = await insertReviewItem(db, newItem("rev_test_idempotent_b", { sourceKey }));
    expect(second.action).toBe("existing_pending");
    expect(second.item.reviewId).toBe("rev_test_idempotent_a");

    // No second review, and no second creation event.
    expect(await getReviewItemById(db, "rev_test_idempotent_b")).toBeNull();
    const events = await listReviewEvents(db, "rev_test_idempotent_a");
    expect(events.filter((e) => e.eventType === "REVIEW_CREATED")).toHaveLength(1);

    const pending = await findPendingReviewBySourceKey(db, sourceKey);
    expect(pending?.reviewId).toBe("rev_test_idempotent_a");
  });

  it("15: once terminal, the same source key may be reviewed again", async () => {
    const sourceKey = "test_source_reusable";
    await insertReviewItem(db, newItem("rev_test_reuse_a", { sourceKey }));
    await decideReviewItem(db, {
      reviewId: "rev_test_reuse_a",
      expectedState: "pending_review",
      decision: { type: "request_revision", instructions: "Add the missing surrender detail." },
      actor: "Demo Reviewer",
      eventId: "evt_test_reuse_a_1",
    });
    // History is not a lock on the future.
    const second = await insertReviewItem(db, newItem("rev_test_reuse_b", { sourceKey }));
    expect(second.action).toBe("created");
    expect(second.item.reviewState).toBe("pending_review");
    expect((await findPendingReviewBySourceKey(db, sourceKey))?.reviewId).toBe("rev_test_reuse_b");
  });
});

describe("audit history is append-only (16-17)", () => {
  it("16: events are returned oldest first", async () => {
    const events = await listReviewEvents(db, "rev_test_reject");
    expect(events).toHaveLength(2);
    expect(new Date(events[0]!.occurredAt).getTime()).toBeLessThanOrEqual(
      new Date(events[1]!.occurredAt).getTime(),
    );
  });

  it("17: the database refuses to update a review event", async () => {
    const { error } = await db
      .from("review_events")
      .update({ actor: "Someone Else" })
      .eq("review_id", "rev_test_reject");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("REVIEW_EVENTS_APPEND_ONLY");

    const events = await listReviewEvents(db, "rev_test_reject");
    expect(events.every((e) => e.actor === "Demo Reviewer")).toBe(true);
  });
});

describe("test-data safety (18-20)", () => {
  it("18: cleanup helpers refuse a non-test review id", async () => {
    expect(() => assertTestReviewId("rev_prod_something")).toThrow(/refusing destructive/);
    await expect(deleteTestReviewData(db, "rev_prod_something")).rejects.toThrow(/refusing/);
  });

  it("19: cleanup removes only the rev_test_ rows it targets", async () => {
    await insertReviewItem(db, newItem("rev_test_reuse_b_probe", { sourceKey: "test_probe" }));
    await deleteTestReviewData(db, "rev_test_reuse_b_probe");
    expect(await getReviewItemById(db, "rev_test_reuse_b_probe")).toBeNull();
    // A different test's rows are untouched.
    expect(await getReviewItemById(db, "rev_test_basic")).not.toBeNull();
  });

  it("20: the knowledge base is untouched by the review workflow", async () => {
    const counts: number[] = [];
    for (const table of ["documents", "document_pages", "chunks"]) {
      const { count, error } = await db
        .from(table)
        .select("*", { count: "exact", head: true })
        .not(table === "documents" ? "document_id" : "id", "is", null);
      expect(error).toBeNull();
      counts.push(count ?? -1);
    }
    expect(counts).toEqual([3, 20, 45]);
  });
});
