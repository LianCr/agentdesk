import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "../../lib/supabase/server";
import { ProductCatalogSchema, SyntheticCaseSchema, type ProductDefinition, type SyntheticCase } from "../../lib/schemas";
import { DerivedChunksFileSchema, type ChunkRecord } from "../../lib/ingestion/types";
import {
  createReview,
  CreateReviewInputSchema,
  type CreateReviewDeps,
} from "../../lib/reviews/create-review";
import {
  decideReviewItem,
  deleteTestReviewData,
  getReviewItemById,
  listReviewEvents,
} from "../../lib/supabase/reviews-repository";
import { hashReviewSnapshot } from "../../lib/reviews/snapshot";

// M5-B database tests: the creation flow end to end against the live project.
// Every review id is rev_test_ prefixed and cleaned up before and after.

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
const created: string[] = [];

function deps(reviewId: string, products = catalog.products as readonly ProductDefinition[]): CreateReviewDeps {
  let issued = 0;
  return {
    db,
    products,
    chunksByDocumentId,
    cases,
    // Deterministic ids so cleanup can find every row this suite made, and a
    // namespaced source key so a demo review of the same pair (created by the
    // CLI, say) can never be mistaken for this suite's open work.
    sourceKeyPrefix: "test_",
    reviewIdFactory: () => (issued++ === 0 ? reviewId : `${reviewId}_extra`),
    eventIdFactory: () => `evt_test_${reviewId.slice(9)}_${issued}`,
  };
}

async function cleanup(): Promise<void> {
  for (const id of [...created, ...KNOWN]) await deleteTestReviewData(db, id);
}

const KNOWN = [
  "rev_test_case_a",
  "rev_test_case_a_extra",
  "rev_test_case_b",
  "rev_test_case_b_extra",
  "rev_test_case_c",
  "rev_test_case_c_extra",
  "rev_test_no_client",
  "rev_test_no_client_extra",
  "rev_test_dupe",
  "rev_test_dupe_extra",
  "rev_test_reverse",
  "rev_test_reverse_extra",
  "rev_test_recreate",
  "rev_test_recreate_extra",
  "rev_test_recreate_2",
  "rev_test_recreate_2_extra",
  "rev_test_concurrent",
  "rev_test_concurrent_extra",
  "rev_test_frozen",
  "rev_test_frozen_extra",
  "rev_test_blocked",
  "rev_test_blocked_extra",
  "rev_test_dupe_2",
  "rev_test_dupe_2_extra",
  "rev_test_concurrent_b",
  "rev_test_concurrent_b_extra",
  "rev_test_concurrent_c",
  "rev_test_concurrent_c_extra",
];

beforeAll(async () => {
  db = createServiceClient();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
});

describe("the server rebuilds everything from identifiers (1-2, 24)", () => {
  it("1: creation needs only product ids and an optional case", async () => {
    const result = await createReview(deps("rev_test_case_a"), {
      productAId: TERM,
      productBId: IUL,
      clientCaseId: "DEMO-2026-001",
    });
    created.push(result.reviewItem.reviewId);
    expect(result.action).toBe("created");

    const item = result.reviewItem;
    expect(item.reviewState).toBe("pending_review");
    expect(item.sourceType).toBe("comparison_draft");
    // The snapshot is a real comparison, rebuilt here.
    const snapshot = item.snapshot as { dimensions: unknown[]; clientContext: { caseId: string } };
    expect(snapshot.dimensions).toHaveLength(13);
    expect(snapshot.clientContext.caseId).toBe("DEMO-2026-001");
    expect(hashReviewSnapshot(item.snapshot as never)).toBe(item.snapshotSha256);
  });

  it("2, 24: the input schema accepts identifiers and nothing else", () => {
    for (const forged of [
      { productAId: TERM, productBId: IUL, snapshot: { dimensions: [] } },
      { productAId: TERM, productBId: IUL, reviewReasons: [] },
      { productAId: TERM, productBId: IUL, workflowDecision: "allow_internal_draft" },
      { productAId: TERM, productBId: IUL, requiredApprovalLevel: "not_required_for_internal_view" },
      { productAId: TERM, productBId: IUL, checklist: [] },
      { productAId: TERM, productBId: IUL, reviewState: "approved" },
      { productAId: TERM, productBId: IUL, citations: [] },
    ]) {
      expect(CreateReviewInputSchema.safeParse(forged).success, JSON.stringify(forged)).toBe(false);
    }
    expect(CreateReviewInputSchema.safeParse({ productAId: TERM, productBId: IUL }).success).toBe(true);
  });

  it("rejects unknown or duplicate products and unknown clients", async () => {
    const d = deps("rev_test_case_a");
    await expect(createReview(d, { productAId: TERM, productBId: TERM })).rejects.toThrow(/DUPLICATE_PRODUCT/);
    await expect(
      createReview(d, { productAId: TERM, productBId: "doc_nope_v1" }),
    ).rejects.toThrow(/UNKNOWN_PRODUCT/);
    await expect(
      createReview(d, { productAId: TERM, productBId: IUL, clientCaseId: "DEMO-9999-999" }),
    ).rejects.toThrow(/UNKNOWN_CLIENT/);
  });
});

describe("runtime routing comes from actual M4 flags (11, 13-15)", () => {
  it("13-14: Case A's real pairing routes on the flags the products actually raise", async () => {
    const item = (await getReviewItemById(db, "rev_test_case_a"))!;
    // The client is low risk, but the IUL genuinely carries non-guaranteed
    // elements — the pairing, not the fixture baseline, decides.
    expect(item.workflowDecision).toBe("allow_internal_draft");
    expect(item.requiredApprovalLevel).toBe("enhanced_review");
    expect(item.reviewReasons).toContain("NON_GUARANTEED_ELEMENTS");
  });

  it("13: Case B routes to enhanced review", async () => {
    const result = await createReview(deps("rev_test_case_b"), {
      productAId: TERM,
      productBId: IUL,
      clientCaseId: "DEMO-2026-002",
    });
    created.push(result.reviewItem.reviewId);
    expect(result.reviewItem.workflowDecision).toBe("allow_internal_draft");
    expect(result.reviewItem.requiredApprovalLevel).toBe("enhanced_review");
    expect(result.reviewItem.reviewReasons).toContain("SPECIFIC_VALUE_REQUEST");
  });

  it("11, 15: Case C blocks the client draft and requires a licensed agent", async () => {
    const result = await createReview(deps("rev_test_case_c"), {
      productAId: ANNUITY,
      productBId: IUL,
      clientCaseId: "DEMO-2026-003",
    });
    created.push(result.reviewItem.reviewId);
    const item = result.reviewItem;
    expect(item.workflowDecision).toBe("block_client_draft");
    expect(item.requiredApprovalLevel).toBe("licensed_agent_required");
    expect(item.reviewState).toBe("pending_review");
    expect(item.reviewReasons).toEqual(expect.arrayContaining(["AGE_65_PLUS", "REPLACEMENT_CONTEXT"]));

    // 12: every fixture-required replacement item is on the checklist.
    const required = cases.find((c) => c.caseId === "DEMO-2026-003")!.expected.requiredChecklistItems!;
    const keys = new Set(item.checklist.map((c) => c.key));
    for (const entry of required) expect(keys.has(entry), entry).toBe(true);

    // The snapshot stays internally readable — blocking is about client-facing
    // use, not about hiding the draft from the reviewer.
    const snapshot = item.snapshot as { dimensions: unknown[]; comparisonStatus: string };
    expect(snapshot.dimensions).toHaveLength(13);
    expect(snapshot.comparisonStatus).toBe("complete");
  });

  it("14: no client creates a valid item with no invented client checklist", async () => {
    const result = await createReview(deps("rev_test_no_client"), {
      productAId: TERM,
      productBId: IUL,
    });
    created.push(result.reviewItem.reviewId);
    expect(result.reviewItem.checklist).toEqual([]);
    expect((result.reviewItem.snapshot as { clientContext: unknown }).clientContext).toBeNull();
    expect(result.reviewItem.workflowDecision).toBe("allow_internal_draft");
  });

  it("15: a blocked comparison routes to checklist-only and keeps that status visible", async () => {
    // Injected fixture only: the committed data always reconciles.
    const broken = JSON.parse(JSON.stringify(catalog.products)) as ProductDefinition[];
    const annuity = broken.find((p) => p.productCategory === "fixed_annuity")!;
    (annuity.facts as { surrenderPeriodYears: number }).surrenderPeriodYears = 99;

    const result = await createReview(deps("rev_test_blocked", broken), {
      productAId: ANNUITY,
      productBId: TERM,
    });
    created.push(result.reviewItem.reviewId);
    expect(result.reviewItem.workflowDecision).toBe("allow_checklist_only");
    expect(result.reviewItem.requiredApprovalLevel).toBe("blocked");
    expect((result.reviewItem.snapshot as { comparisonStatus: string }).comparisonStatus).toBe("blocked");
  });
});

describe("idempotent open work (7-10, 19-20, 22)", () => {
  it("7-9: a duplicate create returns the open item and appends no second event", async () => {
    const first = await createReview(deps("rev_test_dupe"), {
      productAId: TERM,
      productBId: ANNUITY,
      clientCaseId: "DEMO-2026-001",
    });
    created.push(first.reviewItem.reviewId);
    expect(first.action).toBe("created");

    const second = await createReview(deps("rev_test_dupe_2"), {
      productAId: TERM,
      productBId: ANNUITY,
      clientCaseId: "DEMO-2026-001",
    });
    expect(second.action).toBe("existing_pending");
    expect(second.reviewItem.reviewId).toBe(first.reviewItem.reviewId);

    const events = await listReviewEvents(db, first.reviewItem.reviewId);
    expect(events.filter((e) => e.eventType === "REVIEW_CREATED")).toHaveLength(1);
    expect(await getReviewItemById(db, "rev_test_dupe_2")).toBeNull();
  });

  it("22: reversing the columns reuses the open review instead of duplicating work", async () => {
    const reversed = await createReview(deps("rev_test_reverse"), {
      productAId: ANNUITY,
      productBId: TERM,
      clientCaseId: "DEMO-2026-001",
    });
    expect(reversed.action).toBe("existing_pending");
    expect(reversed.reviewItem.reviewId).toBe("rev_test_dupe");
    // The stored snapshot keeps the orientation the first caller chose.
    const snapshot = reversed.reviewItem.snapshot as { productA: { documentId: string } };
    expect(snapshot.productA.documentId).toBe(TERM);
  });

  it("19: the item and its REVIEW_CREATED event appear together", async () => {
    const events = await listReviewEvents(db, "rev_test_case_c");
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe("REVIEW_CREATED");
    expect(events[0]!.payload).toMatchObject({
      workflowDecision: "block_client_draft",
      requiredApprovalLevel: "licensed_agent_required",
    });
  });

  it("10: once the open item is terminal, the same source may be reviewed again", async () => {
    const first = await createReview(deps("rev_test_recreate"), { productAId: IUL, productBId: ANNUITY });
    created.push(first.reviewItem.reviewId);
    await decideReviewItem(db, {
      reviewId: first.reviewItem.reviewId,
      expectedState: "pending_review",
      decision: { type: "approve" },
      actor: "Demo Reviewer",
      eventId: "evt_test_recreate_decide",
    });

    const second = await createReview(deps("rev_test_recreate_2"), { productAId: IUL, productBId: ANNUITY });
    created.push(second.reviewItem.reviewId);
    expect(second.action).toBe("created");
    expect(second.reviewItem.reviewId).not.toBe(first.reviewItem.reviewId);

    const secondEvents = await listReviewEvents(db, second.reviewItem.reviewId);
    expect(secondEvents.map((e) => e.eventType)).toEqual(["REVIEW_CREATED"]);
  });

  it("20: concurrent identical creates leave exactly one pending item", async () => {
    const input = { productAId: ANNUITY, productBId: IUL, clientCaseId: "DEMO-2026-002" as string | null };
    const results = await Promise.all([
      createReview(deps("rev_test_concurrent"), input),
      createReview(deps("rev_test_concurrent_b"), input),
      createReview(deps("rev_test_concurrent_c"), input),
    ]);
    for (const r of results) created.push(r.reviewItem.reviewId);
    const ids = new Set(results.map((r) => r.reviewItem.reviewId));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.action === "created")).toHaveLength(1);

    const events = await listReviewEvents(db, [...ids][0]!);
    expect(events.filter((e) => e.eventType === "REVIEW_CREATED")).toHaveLength(1);
  });
});

describe("the snapshot outlives its source (18, 23)", () => {
  it("18: a later source change does not touch what was reviewed", async () => {
    const result = await createReview(deps("rev_test_frozen"), {
      productAId: TERM,
      productBId: IUL,
      clientCaseId: "DEMO-2026-001",
    });
    created.push(result.reviewItem.reviewId);
    const originalHash = result.reviewItem.snapshotSha256;
    const originalValue = (
      result.reviewItem.snapshot as { dimensions: Array<{ cells: Array<{ displayValue: string }> }> }
    ).dimensions[0]!.cells[0]!.displayValue;

    // Move the source on — in memory only; the committed fixtures are untouched.
    const changed = JSON.parse(JSON.stringify(catalog.products)) as ProductDefinition[];
    const term = changed.find((p) => p.documentId === TERM)!;
    (term.facts as { productType: string }).productType = "Something Completely Different";

    const stored = (await getReviewItemById(db, result.reviewItem.reviewId))!;
    expect(stored.snapshotSha256).toBe(originalHash);
    expect(
      (stored.snapshot as { dimensions: Array<{ cells: Array<{ displayValue: string }> }> })
        .dimensions[0]!.cells[0]!.displayValue,
    ).toBe(originalValue);
    expect(hashReviewSnapshot(stored.snapshot as never)).toBe(originalHash);
  });
});

describe("the knowledge base is untouched (28)", () => {
  it("documents/pages/chunks remain 3/20/45", async () => {
    const counts: number[] = [];
    for (const table of ["documents", "document_pages", "chunks"]) {
      const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
      expect(error).toBeNull();
      counts.push(count ?? -1);
    }
    expect(counts).toEqual([3, 20, 45]);
  });
});
