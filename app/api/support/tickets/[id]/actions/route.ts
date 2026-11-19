import "server-only";
import { NextResponse } from "next/server";
import { withRequestLog } from "../../../../../../lib/ops/request-log";
import { badRequest, notFound, supportError } from "../../../../../../lib/support/http";
import { triageCorpus } from "../../../../../../lib/support/kb";
import { TicketActionInputSchema, performTicketAction, type TicketActionInput } from "../../../../../../lib/support/service";
import { toDetail } from "../../../../../../lib/support/views";
import { createServiceClient } from "../../../../../../lib/supabase/server";
import { listTicketEvents } from "../../../../../../lib/supabase/support-repository";

// Take one action on a ticket. The caller names the action, the status it
// last saw, a roster name and human-written text; the server decides the
// resulting status and event. A stale status → 409 with the current ticket.

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = withRequestLog(
  "/api/support/tickets/[id]/actions",
  async (request: Request, { params }: { params: Promise<{ id: string }> }, log) => {
    const { id } = await params;
    let input: TicketActionInput;
    try {
      const parsed = TicketActionInputSchema.safeParse(await request.json());
      if (!parsed.success) {
        return badRequest("INVALID_ACTION", "Unknown action or missing text.", "无效的操作或缺少必填内容。");
      }
      input = parsed.data;
    } catch {
      return badRequest("INVALID_BODY", "Invalid request body.", "请求格式无效。");
    }
    try {
      const db = createServiceClient();
      const outcome = await performTicketAction({ db, corpus: await triageCorpus(), requestId: log.requestId }, id, input);
      if (!outcome) return notFound();
      log.annotate({ ticketAction: input.action, ticketOutcome: outcome.result });
      const detail = toDetail(outcome.ticket, await listTicketEvents(db, id), new Date());
      if (outcome.result === "conflict") {
        return NextResponse.json(
          { error: "TICKET_CONFLICT", message: "工单已被他人更新，请查看最新状态。Someone else updated this ticket first — here is its current state.", detail },
          { status: 409 },
        );
      }
      if (outcome.result === "invalid") {
        return NextResponse.json({ error: outcome.code, message: outcome.message, detail }, { status: 422 });
      }
      return NextResponse.json(detail);
    } catch (err) {
      return supportError(err, "ticket_action_error", "TICKET_ACTION_FAILED");
    }
  },
);
