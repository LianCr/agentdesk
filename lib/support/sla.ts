import type { Ticket, TicketPriority } from "./types";

// SLA engine. Pure functions of (ticket timestamps, policy, now).
//
// Calendar minutes, not business hours, and the clocks do not pause while
// waiting on the requester — both stated in the runbook rather than hidden.
// Breach is computed on read: there is no background job (CLAUDE.md §9 rules
// out workers), so a ticket is "breached" the moment anyone looks after its
// due time, and the queue, the handoff and the metrics all agree because they
// call the same function.

export const SLA_POLICY_VERSION = 1;

/** Targets in minutes. Demo policy, not a contractual commitment. */
export const SLA_TARGETS: Record<TicketPriority, { firstResponse: number; resolution: number }> = {
  P1: { firstResponse: 60, resolution: 8 * 60 },
  P2: { firstResponse: 4 * 60, resolution: 24 * 60 },
  P3: { firstResponse: 8 * 60, resolution: 3 * 24 * 60 },
  P4: { firstResponse: 24 * 60, resolution: 5 * 24 * 60 },
};

/** A clock is at risk when this fraction (or less) of its target remains. */
export const AT_RISK_FRACTION = 0.25;

export type ClockState = "on_track" | "at_risk" | "breached" | "met";

export interface ClockStatus {
  state: ClockState;
  dueAt: string;
  /** Minutes until due (negative once overdue). For a stopped clock: due − stoppedAt. */
  minutesRemaining: number;
}

export interface SlaStatus {
  firstResponse: ClockStatus;
  resolution: ClockStatus;
  /** The worse of the two clocks that still matter. */
  overall: ClockState;
  /** Minutes until the next open clock is due; null when both are stopped. */
  nextDueMinutes: number | null;
}

const MINUTE = 60_000;

export function dueDates(priority: TicketPriority, createdAt: Date): { firstResponseDueAt: Date; resolutionDueAt: Date } {
  const t = SLA_TARGETS[priority];
  return {
    firstResponseDueAt: new Date(createdAt.getTime() + t.firstResponse * MINUTE),
    resolutionDueAt: new Date(createdAt.getTime() + t.resolution * MINUTE),
  };
}

/**
 * One clock. Stopped (stoppedAt set): met if stopped at or before due,
 * otherwise breached — a late response stays a breach forever. Running:
 * breached strictly after due; at risk when ≤ 25 % of the target is left.
 */
export function clockStatus(dueAt: Date, targetMinutes: number, stoppedAt: Date | null, now: Date): ClockStatus {
  const ref = stoppedAt ?? now;
  const minutesRemaining = Math.floor((dueAt.getTime() - ref.getTime()) / MINUTE);
  let state: ClockState;
  if (stoppedAt) state = stoppedAt.getTime() <= dueAt.getTime() ? "met" : "breached";
  else if (now.getTime() > dueAt.getTime()) state = "breached";
  else if (dueAt.getTime() - now.getTime() <= targetMinutes * AT_RISK_FRACTION * MINUTE) state = "at_risk";
  else state = "on_track";
  return { state, dueAt: dueAt.toISOString(), minutesRemaining };
}

const RANK: Record<ClockState, number> = { breached: 0, at_risk: 1, on_track: 2, met: 3 };

export function worse(a: ClockState, b: ClockState): ClockState {
  return RANK[a] <= RANK[b] ? a : b;
}

type SlaFields = Pick<Ticket, "priority" | "firstResponseDueAt" | "resolutionDueAt" | "firstResponseAt" | "resolvedAt">;

export function slaStatus(ticket: SlaFields, now: Date): SlaStatus {
  const t = SLA_TARGETS[ticket.priority];
  const firstResponse = clockStatus(
    new Date(ticket.firstResponseDueAt),
    t.firstResponse,
    ticket.firstResponseAt ? new Date(ticket.firstResponseAt) : null,
    now,
  );
  const resolution = clockStatus(
    new Date(ticket.resolutionDueAt),
    t.resolution,
    ticket.resolvedAt ? new Date(ticket.resolvedAt) : null,
    now,
  );
  const open = [
    ...(ticket.firstResponseAt ? [] : [firstResponse]),
    ...(ticket.resolvedAt ? [] : [resolution]),
  ];
  // A breached first response is history the requester felt; it keeps the
  // ticket red until it is resolved.
  let overall: ClockState = resolution.state;
  if (!ticket.resolvedAt) overall = worse(overall, firstResponse.state === "met" ? "on_track" : firstResponse.state);
  return {
    firstResponse,
    resolution,
    overall,
    nextDueMinutes: open.length ? Math.min(...open.map((c) => c.minutesRemaining)) : null,
  };
}

const PRIORITY_RANK: Record<TicketPriority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

/** Queue order: breached, then at risk, then soonest due, then priority, then oldest. */
export function compareBySlaRisk<T extends SlaFields & { createdAt: string; ticketId: string }>(
  now: Date,
): (a: T, b: T) => number {
  return (a, b) => {
    const sa = slaStatus(a, now);
    const sb = slaStatus(b, now);
    return (
      RANK[sa.overall] - RANK[sb.overall] ||
      (sa.nextDueMinutes ?? Infinity) - (sb.nextDueMinutes ?? Infinity) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.ticketId.localeCompare(b.ticketId)
    );
  };
}

/** "in 2h 05m" / "3h 10m ago" — for badges and the handoff. */
export function formatMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  const d = Math.floor(abs / 1440);
  const h = Math.floor((abs % 1440) / 60);
  const m = abs % 60;
  const span = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  return minutes >= 0 ? `in ${span}` : `${span} ago`;
}
