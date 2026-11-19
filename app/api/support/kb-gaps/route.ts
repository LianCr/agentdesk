import "server-only";
import { NextResponse } from "next/server";
import { withRequestLog } from "../../../../lib/ops/request-log";
import { findKbGaps } from "../../../../lib/support/gaps";
import { supportError } from "../../../../lib/support/http";
import { createServiceClient } from "../../../../lib/supabase/server";
import { listTickets } from "../../../../lib/supabase/support-repository";

// Knowledge-base gaps: answerable tickets the knowledge base matched poorly,
// grouped by the words it has never seen, each with an article skeleton
// whose answer is left for a human to write.

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = withRequestLog("/api/support/kb-gaps", async (_request: Request, _ctx: unknown) => {
  try {
    return NextResponse.json({ gaps: findKbGaps(await listTickets(createServiceClient())) });
  } catch (err) {
    return supportError(err, "kb_gaps_error", "KB_GAPS_FAILED");
  }
});
