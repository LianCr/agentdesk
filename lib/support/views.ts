import { packetMarkdown, suggestEscalation, type EscalationInput, type EscalationPacket } from "./escalation";
import { slaStatus, type SlaStatus } from "./sla";
import { allowedActions, nextStep, primaryAction } from "./state-machine";
import type { Ticket, TicketAction, TicketEvent } from "./types";

// What the API returns. Derived on read from stored rows; nothing here is
// persisted, so the queue, detail page, handoff and metrics can never
// disagree about an SLA.

export interface TicketSummaryView {
  ticketId: string;
  subject: string;
  requester: string;
  channel: Ticket["channel"];
  category: Ticket["category"];
  priority: Ticket["priority"];
  status: Ticket["status"];
  assignee: string | null;
  route: Ticket["triage"]["route"];
  matchLevel: Ticket["triage"]["match"]["level"];
  sla: SlaStatus;
  nextStep: string;
  createdAt: string;
  seed: boolean;
}

export function toSummary(t: Ticket, now: Date): TicketSummaryView {
  return {
    ticketId: t.ticketId,
    subject: t.subject,
    requester: t.requester,
    channel: t.channel,
    category: t.category,
    priority: t.priority,
    status: t.status,
    assignee: t.assignee,
    route: t.triage.route,
    matchLevel: t.triage.match.level,
    sla: slaStatus(t, now),
    nextStep: nextStep(t.status, t.assignee),
    createdAt: t.createdAt,
    seed: t.seed,
  };
}

export interface TicketDetailView {
  ticket: Ticket;
  sla: SlaStatus;
  events: TicketEvent[];
  allowedActions: TicketAction[];
  primaryAction: TicketAction | null;
  nextStep: string;
  /** Code's pre-filled escalation, offered only when ESCALATE is allowed. */
  escalationSuggestion: EscalationInput | null;
  escalations: Array<{ eventId: string; packetSha256: string; markdown: string }>;
  serverTime: string;
}

export function toDetail(t: Ticket, events: TicketEvent[], now: Date): TicketDetailView {
  const allowed = allowedActions(t.status);
  return {
    ticket: t,
    sla: slaStatus(t, now),
    events,
    allowedActions: allowed,
    primaryAction: primaryAction(t.status, t.triage.draft !== null),
    nextStep: nextStep(t.status, t.assignee),
    escalationSuggestion: allowed.includes("ESCALATE") ? suggestEscalation(t) : null,
    escalations: events
      .filter((e) => e.eventType === "ESCALATED")
      .map((e) => ({
        eventId: e.eventId,
        packetSha256: String(e.payload.packetSha256 ?? ""),
        markdown: packetMarkdown(e.payload.packet as EscalationPacket),
      })),
    serverTime: now.toISOString(),
  };
}
