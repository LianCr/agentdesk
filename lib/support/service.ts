import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  applyTicketAction,
  getTicket,
  insertTicket,
  listTicketEvents,
} from "../supabase/support-repository";
import { EscalationInputSchema, buildEscalationPacket, hashPacket } from "./escalation";
import type { TriageCorpus } from "./kb";
import { dueDates } from "./sla";
import { checkTicketAction } from "./state-machine";
import { triageTicket } from "./triage";
import { SupportAgentSchema, TicketStatusSchema, type Ticket, type TicketInput } from "./types";

// The two write paths. Routes, the seed script and the DB tests all go
// through here, so triage, due dates and transition legality are computed in
// exactly one place.
//
// Trust boundary: a caller supplies the ticket text, an action name, the
// status it last saw, one roster name, and human-written text. Category,
// priority, route, draft, due dates, event type, the resulting status, the
// "edited" flag and the escalation packet's code checks are all server-owned.

export interface WriteContext {
  db: SupabaseClient;
  corpus: TriageCorpus;
  requestId: string | null;
  now?: Date;
}

export async function createSupportTicket(
  ctx: WriteContext,
  input: TicketInput,
  opts: { ticketId?: string; seed?: boolean } = {},
): Promise<Ticket> {
  const now = ctx.now ?? new Date();
  const triage = triageTicket(input, ctx.corpus);
  const due = dueDates(triage.priority, now);
  const ticketId = opts.ticketId ?? `tkt_${randomUUID()}`;
  await insertTicket(ctx.db, {
    ticketId,
    subject: input.subject,
    body: input.body,
    requester: input.requester,
    channel: input.channel,
    status: triage.route,
    triage,
    firstResponseDueAt: due.firstResponseDueAt.toISOString(),
    resolutionDueAt: due.resolutionDueAt.toISOString(),
    createdRequestId: ctx.requestId,
    seed: opts.seed ?? false,
    createdAt: now.toISOString(),
  });
  const ticket = await getTicket(ctx.db, ticketId);
  if (!ticket) throw new Error("TICKET_NOT_FOUND: just created");
  return ticket;
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const base = { expectedStatus: TicketStatusSchema, actor: SupportAgentSchema };

/** What the browser may send. Nothing else is accepted. */
export const TicketActionInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("APPROVE_DRAFT"), ...base, replyText: text(10, 5000) }),
  z.object({ action: z.literal("TAKE_OVER"), ...base, note: text(0, 1000).optional() }),
  z.object({ action: z.literal("LOG_REPLY"), ...base, replyText: text(10, 5000) }),
  z.object({ action: z.literal("REQUESTER_REPLIED"), ...base, note: text(3, 2000) }),
  z.object({ action: z.literal("ESCALATE"), ...base, escalation: EscalationInputSchema }),
  z.object({ action: z.literal("ENGINEERING_RETURNED"), ...base, note: text(3, 2000) }),
  z.object({ action: z.literal("RESOLVE"), ...base, resolutionNote: text(3, 2000) }),
  z.object({ action: z.literal("ASSIGN"), ...base, assignee: SupportAgentSchema.nullable() }),
]);
export type TicketActionInput = z.infer<typeof TicketActionInputSchema>;

export type ActionOutcome =
  | { result: "applied"; ticket: Ticket }
  | { result: "conflict"; ticket: Ticket }
  | { result: "invalid"; code: string; message: string; ticket: Ticket };

export async function performTicketAction(
  ctx: WriteContext,
  ticketId: string,
  input: TicketActionInput,
): Promise<ActionOutcome | null> {
  const now = ctx.now ?? new Date();
  const ticket = await getTicket(ctx.db, ticketId);
  if (!ticket) return null;
  if (ticket.status !== input.expectedStatus) return { result: "conflict", ticket };

  const check = checkTicketAction(ticket.status, input.action);
  if (!check.ok) return { result: "invalid", code: check.code, message: check.message, ticket };

  let payload: Record<string, unknown> = {};
  let setAssignee = false;
  let assignee: string | null = null;
  switch (input.action) {
    case "APPROVE_DRAFT": {
      const draft = ticket.triage.draft?.text ?? "";
      payload = { replyText: input.replyText, edited: input.replyText.trim() !== draft.trim() };
      break;
    }
    case "LOG_REPLY":
      payload = { replyText: input.replyText };
      break;
    case "TAKE_OVER":
      payload = input.note ? { note: input.note } : {};
      break;
    case "REQUESTER_REPLIED":
    case "ENGINEERING_RETURNED":
      payload = { note: input.note };
      break;
    case "RESOLVE":
      payload = { resolutionNote: input.resolutionNote };
      break;
    case "ESCALATE": {
      const events = await listTicketEvents(ctx.db, ticketId);
      const packet = buildEscalationPacket(ticket, events, input.escalation, input.actor, now);
      payload = { packet, packetSha256: hashPacket(packet) };
      break;
    }
    case "ASSIGN":
      setAssignee = true;
      assignee = input.assignee;
      payload = { assignee: input.assignee };
      break;
  }
  // Whoever takes a ticket's first human action owns it unless it is owned.
  if (!setAssignee && !ticket.assignee && input.action !== "RESOLVE") {
    setAssignee = true;
    assignee = input.actor;
  }

  const applied = await applyTicketAction(ctx.db, {
    ticketId,
    expectedStatus: ticket.status,
    newStatus: check.toStatus,
    eventType: check.eventType,
    actor: input.actor,
    requestId: ctx.requestId,
    payload,
    setAssignee,
    assignee,
    at: ctx.now ? now.toISOString() : undefined,
  });
  const fresh = (await getTicket(ctx.db, ticketId))!;
  return { result: applied.action === "applied" ? "applied" : "conflict", ticket: fresh };
}
