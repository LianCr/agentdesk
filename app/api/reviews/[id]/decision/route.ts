import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildReviewDetail } from "../../../../../lib/reviews/detail";
import { DEMO_REVIEWER, ReviewDecisionSchema } from "../../../../../lib/reviews/types";
import { createServiceClient } from "../../../../../lib/supabase/server";
import { decideReviewItem, getReviewItemById } from "../../../../../lib/supabase/reviews-repository";

// The one place a review changes state.
//
// The actor is written by the server. A browser that could name the reviewer
// could sign someone else's name to a decision, which would make the audit
// trail worse than having none. There is no authentication in this demo, so
// the actor is a fixed placeholder rather than a claim about identity.
//
// Staleness is decided by the database, not here: the expected state travels
// into a compare-and-set inside the same transaction that appends the event,
// so a second decision from another tab changes nothing and appends nothing.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  let decision: ReturnType<typeof ReviewDecisionSchema.parse>;
  try {
    const parsed = ReviewDecisionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_DECISION",
          message:
            "拒绝需填写原因，要求修改需填写说明。A rejection needs a reason and a revision request needs instructions.",
        },
        { status: 400 },
      );
    }
    decision = parsed.data;
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    const db = createServiceClient();
    const item = await getReviewItemById(db, id);
    if (!item) {
      return NextResponse.json(
        { error: "REVIEW_NOT_FOUND", message: "找不到该审核项。Review not found." },
        { status: 404 },
      );
    }

    if (item.reviewState !== "pending_review") {
      return conflict(await buildReviewDetail(db, item));
    }

    const outcome = await decideReviewItem(db, {
      reviewId: id,
      expectedState: "pending_review",
      decision,
      actor: DEMO_REVIEWER,
      eventId: `evt_${randomUUID()}`,
    });

    const updated = await getReviewItemById(db, id);
    if (!updated) {
      return NextResponse.json(
        { error: "REVIEW_NOT_FOUND", message: "找不到该审核项。Review not found." },
        { status: 404 },
      );
    }
    const detail = await buildReviewDetail(db, updated);
    return outcome.action === "conflict" ? conflict(detail) : NextResponse.json(detail);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const code = message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? "REVIEW_DECISION_FAILED";
    console.error(JSON.stringify({ event: "review_decision_error", code })); // sanitized: code only
    // An illegal transition is a stale client, not a server fault.
    const stale = code === "REVIEW_ALREADY_DECIDED" || code === "REVIEW_TRANSITION_INVALID";
    return NextResponse.json(
      {
        error: stale ? "REVIEW_STATE_CONFLICT" : code,
        message: stale
          ? "该审核项已在其他会话中被处理。This review was already decided in another session."
          : "提交决定时出现问题，请重试。Something went wrong recording the decision.",
      },
      { status: stale ? 409 : 500 },
    );
  }
}

function conflict(detail: Awaited<ReturnType<typeof buildReviewDetail>>): NextResponse {
  return NextResponse.json(
    {
      error: "REVIEW_STATE_CONFLICT",
      message: "该审核项已在其他会话中被处理。This review was already decided in another session.",
      reviewItem: detail,
    },
    { status: 409 },
  );
}
