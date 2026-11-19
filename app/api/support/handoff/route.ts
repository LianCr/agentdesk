import "server-only";
import { NextResponse } from "next/server";
import { withRequestLog } from "../../../../lib/ops/request-log";
import { buildHandoff, handoffMarkdown } from "../../../../lib/support/handoff";
import { badRequest, supportError } from "../../../../lib/support/http";
import { OPEN_STATUSES } from "../../../../lib/support/types";
import { createServiceClient } from "../../../../lib/supabase/server";
import { groupEvents, listEventsFor, listTickets } from "../../../../lib/supabase/support-repository";

// End-of-shift handoff for every open ticket. Markdown by default (paste it
// into the team channel); ?format=json for tooling. Read-only and
// cron-safe: calling it changes nothing.

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = withRequestLog("/api/support/handoff", async (request: Request, _ctx: unknown) => {
  const format = new URL(request.url).searchParams.get("format") ?? "md";
  if (format !== "md" && format !== "json") return badRequest("INVALID_FORMAT", "format must be md or json.", "format 只能是 md 或 json。");
  try {
    const db = createServiceClient();
    const tickets = await listTickets(db, { statuses: OPEN_STATUSES });
    const events = groupEvents(await listEventsFor(db, tickets.map((t) => t.ticketId)));
    const handoff = buildHandoff(tickets, events, new Date());
    if (format === "json") return NextResponse.json(handoff);
    return new NextResponse(handoffMarkdown(handoff), { headers: { "content-type": "text/markdown; charset=utf-8" } });
  } catch (err) {
    return supportError(err, "handoff_error", "HANDOFF_FAILED");
  }
});
