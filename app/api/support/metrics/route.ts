import "server-only";
import { NextResponse } from "next/server";
import { withRequestLog } from "../../../../lib/ops/request-log";
import { supportError } from "../../../../lib/support/http";
import { computeMetrics } from "../../../../lib/support/metrics";
import { createServiceClient } from "../../../../lib/supabase/server";
import { listEventsFor, listTickets } from "../../../../lib/supabase/support-repository";

// Support metrics computed on read, each with its definition. On seeded demo
// data `containsSeedData` is true: the numbers describe timestamps a seed
// script chose, not a real team's performance.

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = withRequestLog("/api/support/metrics", async (_request: Request, _ctx: unknown) => {
  try {
    const db = createServiceClient();
    const tickets = await listTickets(db);
    const events = await listEventsFor(db, tickets.map((t) => t.ticketId));
    return NextResponse.json(computeMetrics(tickets, events, new Date()));
  } catch (err) {
    return supportError(err, "metrics_error", "METRICS_FAILED");
  }
});
