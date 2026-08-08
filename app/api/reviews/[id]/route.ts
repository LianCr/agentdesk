import "server-only";
import { NextResponse } from "next/server";
import { buildReviewDetail } from "../../../../lib/reviews/detail";
import { createServiceClient } from "../../../../lib/supabase/server";
import { getReviewItemById } from "../../../../lib/supabase/reviews-repository";

// Read one review, exactly as it was stored. There is no recomputation here
// and no call to the comparison engine.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const db = createServiceClient();
    const item = await getReviewItemById(db, id);
    if (!item) {
      return NextResponse.json(
        { error: "REVIEW_NOT_FOUND", message: "找不到该审核项。Review not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(await buildReviewDetail(db, item));
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const code = message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? "REVIEW_READ_FAILED";
    console.error(JSON.stringify({ event: "review_read_error", code })); // sanitized: code only
    return NextResponse.json(
      { error: code, message: "读取审核项时出现问题，请重试。Something went wrong loading the review." },
      { status: 500 },
    );
  }
}
