import "server-only";
import { NextResponse } from "next/server";
import { withRequestLog } from "../../../../../lib/ops/request-log";
import { notFound, supportError } from "../../../../../lib/support/http";
import { toDetail } from "../../../../../lib/support/views";
import { createServiceClient } from "../../../../../lib/supabase/server";
import { getTicket, listTicketEvents } from "../../../../../lib/supabase/support-repository";

// One ticket with its append-only timeline, SLA computed now, the actions
// its status allows and the single primary action chosen by code.

export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = withRequestLog(
  "/api/support/tickets/[id]",
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const db = createServiceClient();
      const ticket = await getTicket(db, id);
      if (!ticket) return notFound();
      return NextResponse.json(toDetail(ticket, await listTicketEvents(db, id), new Date()));
    } catch (err) {
      return supportError(err, "ticket_read_error", "TICKET_READ_FAILED");
    }
  },
);
