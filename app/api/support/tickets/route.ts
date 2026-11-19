import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "../../../../lib/ops/guard";
import { RATE_LIMITS } from "../../../../lib/ops/rate-limit";
import { withRequestLog } from "../../../../lib/ops/request-log";
import { badRequest, supportError } from "../../../../lib/support/http";
import { triageCorpus } from "../../../../lib/support/kb";
import { createSupportTicket } from "../../../../lib/support/service";
import { compareBySlaRisk } from "../../../../lib/support/sla";
import { OPEN_STATUSES, TICKET_STATUSES, TicketInputSchema } from "../../../../lib/support/types";
import { toDetail, toSummary } from "../../../../lib/support/views";
import { createServiceClient } from "../../../../lib/supabase/server";
import { listTicketEvents, listTickets } from "../../../../lib/supabase/support-repository";

// Ticket intake and the queue. Intake accepts ticket TEXT only: category,
// priority, route, draft and due dates are computed server-side by the
// deterministic triage. Nothing is ever sent to the requester.

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = withRequestLog("/api/support/tickets", async (request, _ctx: unknown, log) => {
  let input: z.infer<typeof TicketInputSchema>;
  try {
    const parsed = TicketInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("INVALID_REQUEST", "Subject, description and requester are required.", "请填写标题、描述和提交人。");
    }
    input = parsed.data;
  } catch {
    return badRequest("INVALID_BODY", "Invalid request body.", "请求格式无效。");
  }
  const limited = await enforceRateLimit(request, RATE_LIMITS.supportCreate, log);
  if (limited) return limited;
  try {
    const db = createServiceClient();
    const ticket = await createSupportTicket({ db, corpus: await triageCorpus(), requestId: log.requestId }, input);
    log.annotate({ ticketCategory: ticket.category, ticketPriority: ticket.priority, ticketRoute: ticket.triage.route });
    const events = await listTicketEvents(db, ticket.ticketId);
    return NextResponse.json(toDetail(ticket, events, new Date()), { status: 201 });
  } catch (err) {
    return supportError(err, "ticket_create_error", "TICKET_CREATE_FAILED");
  }
});

const FilterSchema = z.enum(["open", "all", ...TICKET_STATUSES]);

export const GET = withRequestLog("/api/support/tickets", async (request, _ctx: unknown) => {
  const parsed = FilterSchema.safeParse(new URL(request.url).searchParams.get("status") ?? "open");
  if (!parsed.success) return badRequest("INVALID_STATUS", "Unknown filter.", "未知的筛选条件。");
  try {
    const statuses = parsed.data === "all" ? undefined : parsed.data === "open" ? OPEN_STATUSES : [parsed.data];
    const now = new Date();
    const tickets = (await listTickets(createServiceClient(), { statuses })).sort(compareBySlaRisk(now));
    return NextResponse.json({ serverTime: now.toISOString(), tickets: tickets.map((t) => toSummary(t, now)) });
  } catch (err) {
    return supportError(err, "ticket_list_error", "TICKET_LIST_FAILED");
  }
});
