import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadComparisonCatalog } from "../../../lib/comparison/loader";
import { CreateReviewInputSchema, createReview } from "../../../lib/reviews/create-review";
import { buildReviewDetail } from "../../../lib/reviews/detail";
import { REVIEW_STATES } from "../../../lib/reviews/types";
import { createServiceClient } from "../../../lib/supabase/server";
import { listReviewSummaries } from "../../../lib/supabase/reviews-repository";

// Thin presentation boundary over the approved M5-B service. This route owns
// no review semantics: it does not decide routing, build a snapshot, choose a
// source key or write an event. It validates identifiers and calls createReview.
//
// The request schema is the trust boundary. A caller cannot submit facts,
// citations, flags, a workflow decision, an approval level, a checklist, a
// review state or a reviewer, because none of those are fields it accepts.

export const runtime = "nodejs";
export const maxDuration = 30;

const StateFilterSchema = z.enum(["all", ...REVIEW_STATES]);

export async function POST(request: Request): Promise<NextResponse> {
  let input: z.infer<typeof CreateReviewInputSchema>;
  try {
    const parsed = CreateReviewInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "请选择两个不同的演示产品。Please select two different demo products.",
        },
        { status: 400 },
      );
    }
    input = parsed.data;
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    const catalog = await loadComparisonCatalog();
    const db = createServiceClient();
    const result = await createReview(
      {
        db,
        products: catalog.products,
        chunksByDocumentId: catalog.chunksByDocumentId,
        cases: catalog.cases,
      },
      input,
    );
    // Finding an open review for the same work is a success, not a conflict:
    // the correct outcome is to send the reviewer to the work that exists.
    return NextResponse.json(
      { action: result.action, reviewItem: await buildReviewDetail(db, result.reviewItem) },
      { status: result.action === "created" ? 201 : 200 },
    );
  } catch (err) {
    return errorResponse(err, "review_create_error");
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const raw = new URL(request.url).searchParams.get("state") ?? "all";
  const parsed = StateFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_STATE", message: "未知的筛选条件。Unknown filter." },
      { status: 400 },
    );
  }
  try {
    const reviews = await listReviewSummaries(
      createServiceClient(),
      parsed.data === "all" ? {} : { reviewState: parsed.data },
    );
    return NextResponse.json({ reviews });
  } catch (err) {
    return errorResponse(err, "review_list_error");
  }
}

const CLIENT_ERRORS = new Set(["UNKNOWN_PRODUCT", "DUPLICATE_PRODUCT", "UNKNOWN_CLIENT"]);

function errorResponse(err: unknown, event: string): NextResponse {
  const message = err instanceof Error ? err.message : "";
  const code = message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? "REVIEW_REQUEST_FAILED";
  console.error(JSON.stringify({ event, code })); // sanitized: code only, never the error
  const isCallerError = CLIENT_ERRORS.has(code);
  return NextResponse.json(
    {
      error: code,
      message: isCallerError
        ? "未知的演示产品或客户。Unknown demo product or client."
        : "处理审核请求时出现问题，请重试。Something went wrong handling the review request.",
    },
    { status: isCallerError ? 400 : 500 },
  );
}
