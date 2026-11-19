import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TicketCategorySchema,
  TicketChannelSchema,
  TicketEventTypeSchema,
  TicketPrioritySchema,
  TicketStatusSchema,
  TriageResultSchema,
  type Ticket,
  type TicketEvent,
  type TicketEventType,
  type TicketStatus,
} from "../support/types";

// Narrow persistence for support tickets, same conventions as
// reviews-repository.ts: injected client, snake_case rows, no generic update
// or delete path. A ticket changes only through apply_ticket_action, which
// writes the event in the same transaction. Failures become prefixed
// `DB_*_FAILED:` messages carrying no error object.

const TICKET_COLUMNS =
  "ticket_id, subject, body, requester, channel, category, priority, status, assignee, triage, " +
  "first_response_due_at, resolution_due_at, first_response_at, resolved_at, created_request_id, seed, created_at, updated_at";
const EVENT_COLUMNS = "event_id, ticket_id, event_type, actor, request_id, from_status, to_status, payload, occurred_at, created_at";

const iso = (v: unknown): string => new Date(String(v)).toISOString();
const isoOrNull = (v: unknown): string | null => (v == null ? null : iso(v));

export function rowToTicket(row: Record<string, unknown>): Ticket {
  return {
    ticketId: String(row.ticket_id),
    subject: String(row.subject),
    body: String(row.body),
    requester: String(row.requester),
    channel: TicketChannelSchema.parse(row.channel),
    category: TicketCategorySchema.parse(row.category),
    priority: TicketPrioritySchema.parse(row.priority),
    status: TicketStatusSchema.parse(row.status),
    assignee: (row.assignee as string | null) ?? null,
    triage: TriageResultSchema.parse(row.triage),
    firstResponseDueAt: iso(row.first_response_due_at),
    resolutionDueAt: iso(row.resolution_due_at),
    firstResponseAt: isoOrNull(row.first_response_at),
    resolvedAt: isoOrNull(row.resolved_at),
    createdRequestId: (row.created_request_id as string | null) ?? null,
    seed: row.seed === true,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function rowToEvent(row: Record<string, unknown>): TicketEvent {
  return {
    eventId: String(row.event_id),
    ticketId: String(row.ticket_id),
    eventType: TicketEventTypeSchema.parse(row.event_type),
    actor: String(row.actor),
    requestId: (row.request_id as string | null) ?? null,
    fromStatus: row.from_status ? TicketStatusSchema.parse(row.from_status) : null,
    toStatus: row.to_status ? TicketStatusSchema.parse(row.to_status) : null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    occurredAt: iso(row.occurred_at),
  };
}

export interface NewTicketRow {
  ticketId: string;
  subject: string;
  body: string;
  requester: string;
  channel: Ticket["channel"];
  status: "needs_human" | "draft_ready";
  triage: Ticket["triage"];
  firstResponseDueAt: string;
  resolutionDueAt: string;
  createdRequestId: string | null;
  seed: boolean;
  createdAt: string;
}

export async function insertTicket(db: SupabaseClient, t: NewTicketRow): Promise<void> {
  const { error } = await db.rpc("create_support_ticket", {
    p_ticket_id: t.ticketId,
    p_subject: t.subject,
    p_body: t.body,
    p_requester: t.requester,
    p_channel: t.channel,
    p_category: t.triage.category,
    p_priority: t.triage.priority,
    p_status: t.status,
    p_triage: t.triage,
    p_first_response_due_at: t.firstResponseDueAt,
    p_resolution_due_at: t.resolutionDueAt,
    p_created_request_id: t.createdRequestId,
    p_seed: t.seed,
    p_created_at: t.createdAt,
  });
  if (error) throw new Error(`${dbCode(error.message, "DB_TICKET_CREATE_FAILED")}: create_support_ticket`);
}

export interface ApplyActionRow {
  ticketId: string;
  expectedStatus: TicketStatus;
  newStatus: TicketStatus;
  eventType: TicketEventType;
  actor: string;
  requestId: string | null;
  payload: Record<string, unknown>;
  setAssignee: boolean;
  assignee: string | null;
  /** Only honoured by the database for tkt_seed_ / tkt_test_ tickets. */
  at?: string;
}

export async function applyTicketAction(
  db: SupabaseClient,
  a: ApplyActionRow,
): Promise<{ action: "applied" | "conflict"; status: TicketStatus }> {
  const { data, error } = await db.rpc("apply_ticket_action", {
    p_ticket_id: a.ticketId,
    p_expected_status: a.expectedStatus,
    p_new_status: a.newStatus,
    p_event_type: a.eventType,
    p_actor: a.actor,
    p_request_id: a.requestId,
    p_payload: a.payload,
    p_set_assignee: a.setAssignee,
    p_assignee: a.assignee,
    p_at: a.at ?? null,
  });
  if (error) throw new Error(`${dbCode(error.message, "DB_TICKET_ACTION_FAILED")}: apply_ticket_action`);
  const result = data as { action: "applied" | "conflict"; status: string };
  return { action: result.action, status: TicketStatusSchema.parse(result.status) };
}

/** Database exceptions raised by our own functions carry a CODE: prefix; keep only that. */
function dbCode(message: string, fallback: string): string {
  return message.match(/^(TICKET_[A-Z_]+):/)?.[1] ?? fallback;
}

export async function getTicket(db: SupabaseClient, ticketId: string): Promise<Ticket | null> {
  const { data, error } = await db.from("support_tickets").select(TICKET_COLUMNS).eq("ticket_id", ticketId).maybeSingle();
  if (error) throw new Error("DB_TICKET_READ_FAILED: support_tickets");
  return data ? rowToTicket(data as unknown as Record<string, unknown>) : null;
}

/** Test rows (tkt_test_) are never shown in the app, the handoff or the metrics. */
export async function listTickets(
  db: SupabaseClient,
  filter: { statuses?: readonly TicketStatus[]; includeTest?: boolean } = {},
): Promise<Ticket[]> {
  let q = db.from("support_tickets").select(TICKET_COLUMNS).order("created_at", { ascending: false }).limit(500);
  if (filter.statuses) q = q.in("status", [...filter.statuses]);
  if (!filter.includeTest) q = q.not("ticket_id", "like", "tkt\\_test\\_%");
  const { data, error } = await q;
  if (error) throw new Error("DB_TICKET_LIST_FAILED: support_tickets");
  return (data as unknown as Record<string, unknown>[]).map(rowToTicket);
}

export async function listTicketEvents(db: SupabaseClient, ticketId: string): Promise<TicketEvent[]> {
  const { data, error } = await db
    .from("ticket_events")
    .select(EVENT_COLUMNS)
    .eq("ticket_id", ticketId)
    .order("occurred_at", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error("DB_TICKET_EVENTS_FAILED: ticket_events");
  return (data as unknown as Record<string, unknown>[]).map(rowToEvent);
}

export async function listEventsFor(db: SupabaseClient, ticketIds: string[]): Promise<TicketEvent[]> {
  if (ticketIds.length === 0) return [];
  const { data, error } = await db
    .from("ticket_events")
    .select(EVENT_COLUMNS)
    .in("ticket_id", ticketIds)
    .order("occurred_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw new Error("DB_TICKET_EVENTS_FAILED: ticket_events");
  return (data as unknown as Record<string, unknown>[]).map(rowToEvent);
}

export function groupEvents(events: TicketEvent[]): Map<string, TicketEvent[]> {
  const out = new Map<string, TicketEvent[]>();
  for (const e of events) out.set(e.ticketId, [...(out.get(e.ticketId) ?? []), e]);
  return out;
}

/** Test cleanup. Refuses anything that is not a tkt_test_ id. */
export async function deleteTestTickets(db: SupabaseClient, prefix = "tkt_test_"): Promise<void> {
  if (!prefix.startsWith("tkt_test_")) throw new Error(`refusing to delete non-test tickets (${prefix})`);
  const like = `${prefix.replace(/_/g, "\\_")}%`;
  const ev = await db.from("ticket_events").delete().like("ticket_id", like);
  if (ev.error) throw new Error(`DB_TICKET_CLEANUP_FAILED: ticket_events`);
  const tk = await db.from("support_tickets").delete().like("ticket_id", like);
  if (tk.error) throw new Error(`DB_TICKET_CLEANUP_FAILED: support_tickets`);
}
