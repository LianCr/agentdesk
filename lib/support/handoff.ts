import { compareBySlaRisk, formatMinutes, slaStatus, type ClockState } from "./sla";
import { nextStep } from "./state-machine";
import { OPEN_STATUSES, type Ticket, type TicketEvent } from "./types";

// End-of-shift handoff, generated from stored state. Nothing in it is
// written by a model: SLA risk is the SLA engine, "last action" is the newest
// event, "next step" and "blocker" are chosen by code from the status.

export interface HandoffItem {
  ticketId: string;
  subject: string;
  priority: Ticket["priority"];
  status: Ticket["status"];
  assignee: string | null;
  sla: ClockState;
  slaText: string;
  lastAction: string;
  nextStep: string;
  blocker: string | null;
}

export interface Handoff {
  generatedAt: string;
  openCount: number;
  groups: Array<{ sla: ClockState; label: string; items: HandoffItem[] }>;
  containsSeedData: boolean;
}

export function blockerFor(ticket: Pick<Ticket, "status" | "assignee" | "priority">): string | null {
  if (ticket.status === "escalated") return "Waiting on engineering";
  if (ticket.status === "waiting_on_requester") return "Waiting on requester";
  if (!ticket.assignee && (ticket.priority === "P1" || ticket.priority === "P2")) return `Unowned ${ticket.priority}`;
  return null;
}

const GROUPS: Array<{ sla: ClockState; label: string }> = [
  { sla: "breached", label: "SLA breached" },
  { sla: "at_risk", label: "SLA at risk" },
  { sla: "on_track", label: "On track" },
];

export function buildHandoff(tickets: Ticket[], eventsByTicket: Map<string, TicketEvent[]>, now: Date): Handoff {
  const open = tickets.filter((t) => OPEN_STATUSES.includes(t.status)).sort(compareBySlaRisk(now));
  const items: HandoffItem[] = open.map((t) => {
    const sla = slaStatus(t, now);
    const clock = t.firstResponseAt ? sla.resolution : sla.firstResponse;
    const label = t.firstResponseAt ? "resolution" : "first response";
    const events = eventsByTicket.get(t.ticketId) ?? [];
    const last = events[events.length - 1];
    return {
      ticketId: t.ticketId,
      subject: t.subject,
      priority: t.priority,
      status: t.status,
      assignee: t.assignee,
      sla: sla.overall,
      slaText: `${label} due ${formatMinutes(clock.minutesRemaining)}`,
      lastAction: last ? `${last.eventType} by ${last.actor} at ${last.occurredAt}` : "none",
      nextStep: nextStep(t.status, t.assignee),
      blocker: blockerFor(t),
    };
  });
  return {
    generatedAt: now.toISOString(),
    openCount: items.length,
    groups: GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.sla === g.sla) })),
    containsSeedData: tickets.some((t) => t.seed),
  };
}

export function handoffMarkdown(h: Handoff): string {
  const out = [`# Shift handoff — ${h.generatedAt}`, "", `${h.openCount} open tickets.`];
  if (h.containsSeedData) out.push("", "_Includes synthetic seed tickets (demo data)._");
  for (const g of h.groups) {
    out.push("", `## ${g.label} (${g.items.length})`);
    if (g.items.length === 0) out.push("- none");
    for (const i of g.items) {
      out.push(
        `- **[${i.priority}] ${i.ticketId}** ${i.subject}`,
        `  - status ${i.status} · owner ${i.assignee ?? "unassigned"} · ${i.slaText}`,
        `  - last: ${i.lastAction}`,
        `  - next: ${i.nextStep}${i.blocker ? ` · blocker: ${i.blocker}` : ""}`,
      );
    }
  }
  return out.join("\n");
}
