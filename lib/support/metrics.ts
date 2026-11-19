import { slaStatus } from "./sla";
import { OPEN_STATUSES, TICKET_PRIORITIES, TICKET_STATUSES, type Ticket, type TicketEvent } from "./types";

// Support metrics, computed from stored tickets and events on read.
// Definitions are deliberately narrow and written next to each number so a
// reader can see exactly what is counted. On seeded demo data these numbers
// describe timestamps a seed script chose — the response says so.

export interface SupportMetrics {
  generatedAt: string;
  ticketCount: number;
  containsSeedData: boolean;
  byStatus: Record<string, number>;
  backlogByPriority: Record<string, number>;
  /** Median minutes from creation to first response, over tickets that have one. */
  medianFirstResponseMinutes: number | null;
  /** Met ÷ decided. A clock is decided once stopped, or once it breaches while running. */
  firstResponseSlaHitRate: number | null;
  resolutionSlaHitRate: number | null;
  /** Tickets triage routed to draft_ready ÷ all tickets. */
  autoDraftRate: number | null;
  /** DRAFT_APPROVED with the draft unedited ÷ all DRAFT_APPROVED. */
  autoDraftAcceptanceRate: number | null;
  /** Tickets with at least one ESCALATED event ÷ all tickets. */
  escalationRate: number | null;
  definitions: Record<string, string>;
}

const ratio = (num: number, den: number) => (den === 0 ? null : Math.round((num / den) * 1000) / 1000);

export function computeMetrics(tickets: Ticket[], events: TicketEvent[], now: Date): SupportMetrics {
  const byStatus = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  const backlog = Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, 0])) as Record<string, number>;
  const frMinutes: number[] = [];
  let frMet = 0, frDecided = 0, resMet = 0, resDecided = 0;
  for (const t of tickets) {
    byStatus[t.status]! += 1;
    if (OPEN_STATUSES.includes(t.status)) backlog[t.priority]! += 1;
    if (t.firstResponseAt) frMinutes.push((Date.parse(t.firstResponseAt) - Date.parse(t.createdAt)) / 60000);
    const sla = slaStatus(t, now);
    if (sla.firstResponse.state === "met" || sla.firstResponse.state === "breached") {
      frDecided += 1;
      if (sla.firstResponse.state === "met") frMet += 1;
    }
    if (sla.resolution.state === "met" || sla.resolution.state === "breached") {
      resDecided += 1;
      if (sla.resolution.state === "met") resMet += 1;
    }
  }
  frMinutes.sort((a, b) => a - b);
  const median =
    frMinutes.length === 0
      ? null
      : Math.round(
          frMinutes.length % 2
            ? frMinutes[(frMinutes.length - 1) / 2]!
            : (frMinutes[frMinutes.length / 2 - 1]! + frMinutes[frMinutes.length / 2]!) / 2,
        );
  const approvals = events.filter((e) => e.eventType === "DRAFT_APPROVED");
  const escalated = new Set(events.filter((e) => e.eventType === "ESCALATED").map((e) => e.ticketId));
  return {
    generatedAt: now.toISOString(),
    ticketCount: tickets.length,
    containsSeedData: tickets.some((t) => t.seed),
    byStatus,
    backlogByPriority: backlog,
    medianFirstResponseMinutes: median,
    firstResponseSlaHitRate: ratio(frMet, frDecided),
    resolutionSlaHitRate: ratio(resMet, resDecided),
    autoDraftRate: ratio(tickets.filter((t) => t.triage.route === "draft_ready").length, tickets.length),
    autoDraftAcceptanceRate: ratio(approvals.filter((e) => e.payload.edited === false).length, approvals.length),
    escalationRate: ratio(tickets.filter((t) => escalated.has(t.ticketId)).length, tickets.length),
    definitions: {
      medianFirstResponseMinutes: "median minutes from ticket creation to the first DRAFT_APPROVED, REPLY_LOGGED or RESOLVED event",
      firstResponseSlaHitRate: "first-response clocks met ÷ clocks decided (stopped, or breached while running)",
      resolutionSlaHitRate: "resolution clocks met ÷ clocks decided",
      autoDraftRate: "tickets routed to draft_ready by triage ÷ all tickets",
      autoDraftAcceptanceRate: "drafts approved without edits ÷ drafts approved",
      escalationRate: "tickets escalated at least once ÷ all tickets",
    },
  };
}
