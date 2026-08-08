import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChunkRecord } from "../ingestion/types";
import type { ProductDefinition, SyntheticCase } from "../schemas";
import { compareProducts } from "../comparison/compare";
import { computeWorkflowRouting } from "../guardrails/rules";
import { insertReviewItem, type CreateOutcome } from "../supabase/reviews-repository";
import { buildReviewChecklist } from "./checklist";
import { buildReviewSnapshot, hashReviewSnapshot } from "./snapshot";
import { DEMO_REVIEWER, type ReviewItemRecord } from "./types";

// Creating a review item.
//
// The caller supplies IDENTIFIERS ONLY. Everything a reviewer will rely on —
// the facts, the citations, the flags, the routing, the checklist — is rebuilt
// here from committed data. That is not defensive coding for its own sake: if
// a browser could hand us a draft to "review", the review would be of whatever
// the caller invented, and the audit trail would record a decision about it.

export const CreateReviewInputSchema = z
  .object({
    productAId: z.string().regex(/^doc_[a-z0-9_]+$/),
    productBId: z.string().regex(/^doc_[a-z0-9_]+$/),
    clientCaseId: z.string().min(1).nullable().optional(),
  })
  .strict();
export type CreateReviewInput = z.infer<typeof CreateReviewInputSchema>;

export interface CreateReviewDeps {
  db: SupabaseClient;
  products: readonly ProductDefinition[];
  chunksByDocumentId: Readonly<Record<string, readonly ChunkRecord[]>>;
  cases: readonly SyntheticCase[];
  reviewIdFactory?: () => string;
  eventIdFactory?: () => string;
  actor?: string;
  /**
   * Namespaces the idempotency key. Integration tests set this so their
   * pending reviews can never collide with real demo rows for the same
   * product pair — the same reason reviewIdFactory is injectable.
   */
  sourceKeyPrefix?: string;
}

export interface CreateReviewResult {
  action: CreateOutcome["action"];
  reviewItem: ReviewItemRecord;
}

/**
 * Idempotency key for open review work. Product order is presentation — M4
 * proved the facts are symmetric — so reversing the columns must not create a
 * second pending review of the same thing. The stored snapshot still keeps the
 * orientation the first caller chose.
 */
export function buildSourceKey(input: {
  productAId: string;
  productBId: string;
  clientCaseId: string | null;
}): string {
  const [first, second] = [input.productAId, input.productBId].sort();
  return `comparison_draft:${first}+${second}:${input.clientCaseId ?? "no_client"}`;
}

export async function createReview(
  deps: CreateReviewDeps,
  rawInput: CreateReviewInput,
): Promise<CreateReviewResult> {
  const input = CreateReviewInputSchema.parse(rawInput);

  const productA = deps.products.find((p) => p.documentId === input.productAId);
  const productB = deps.products.find((p) => p.documentId === input.productBId);
  if (!productA || !productB) throw new Error("UNKNOWN_PRODUCT: no such demo product");
  if (productA.documentId === productB.documentId) {
    throw new Error("DUPLICATE_PRODUCT: a product cannot be compared with itself");
  }
  const clientCaseId = input.clientCaseId ?? null;
  const syntheticCase = clientCaseId ? deps.cases.find((c) => c.caseId === clientCaseId) : null;
  if (clientCaseId && !syntheticCase) throw new Error("UNKNOWN_CLIENT: no such demo client");

  // Deterministic, and no model: creating a review never asks for a narrative.
  const draft = compareProducts({
    productA,
    productB,
    chunksByDocumentId: deps.chunksByDocumentId,
    syntheticCase: syntheticCase ?? null,
  });

  const routing = computeWorkflowRouting({
    reviewReasons: draft.reviewReasons,
    comparisonStatus: draft.comparisonStatus,
    client: draft.clientContext,
  });

  const checklist = buildReviewChecklist({ draft, workflowDecision: routing.workflowDecision });
  const snapshot = buildReviewSnapshot(draft);
  const snapshotSha256 = hashReviewSnapshot(snapshot);

  const outcome = await insertReviewItem(deps.db, {
    reviewId: (deps.reviewIdFactory ?? (() => `rev_${randomUUID()}`))(),
    sourceType: "comparison_draft",
    sourceKey: `${deps.sourceKeyPrefix ?? ""}${buildSourceKey({
      productAId: input.productAId,
      productBId: input.productBId,
      clientCaseId,
    })}`,
    snapshot,
    snapshotSha256,
    workflowDecision: routing.workflowDecision,
    requiredApprovalLevel: routing.requiredApprovalLevel,
    reviewReasons: draft.reviewReasons,
    checklist,
    createdEventId: (deps.eventIdFactory ?? (() => `evt_${randomUUID()}`))(),
    actor: deps.actor ?? DEMO_REVIEWER,
  });

  return { action: outcome.action, reviewItem: outcome.item };
}
