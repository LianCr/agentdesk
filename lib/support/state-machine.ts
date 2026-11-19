import type { TicketAction, TicketEventType, TicketStatus } from "./types";

// Ticket lifecycle. One table is the whole truth; the database only performs
// compare-and-set on the status the caller read, so this file is the single
// place that says which moves exist.
//
//   draft_ready ──APPROVE_DRAFT──► resolved        (the approved draft is the first response)
//        └──────TAKE_OVER──────► needs_human
//   needs_human ──LOG_REPLY─────► waiting_on_requester   (first response, not a resolution)
//               ──ESCALATE──────► escalated
//               ──RESOLVE───────► resolved
//   waiting_on_requester ──REQUESTER_REPLIED──► needs_human
//                        ──RESOLVE────────────► resolved
//   escalated ──ENGINEERING_RETURNED──► needs_human
//             ──RESOLVE───────────────► resolved
//   ASSIGN: any open status, status unchanged.  resolved: terminal (reopen is "later").

type Move = { to: TicketStatus | "same"; event: TicketEventType };

export const TRANSITIONS: Readonly<Record<TicketStatus, Partial<Record<TicketAction, Move>>>> = {
  draft_ready: {
    APPROVE_DRAFT: { to: "resolved", event: "DRAFT_APPROVED" },
    TAKE_OVER: { to: "needs_human", event: "TAKEN_OVER" },
    ASSIGN: { to: "same", event: "ASSIGNED" },
  },
  needs_human: {
    LOG_REPLY: { to: "waiting_on_requester", event: "REPLY_LOGGED" },
    ESCALATE: { to: "escalated", event: "ESCALATED" },
    RESOLVE: { to: "resolved", event: "RESOLVED" },
    ASSIGN: { to: "same", event: "ASSIGNED" },
  },
  waiting_on_requester: {
    REQUESTER_REPLIED: { to: "needs_human", event: "REQUESTER_REPLIED" },
    RESOLVE: { to: "resolved", event: "RESOLVED" },
    ASSIGN: { to: "same", event: "ASSIGNED" },
  },
  escalated: {
    ENGINEERING_RETURNED: { to: "needs_human", event: "ENGINEERING_RETURNED" },
    RESOLVE: { to: "resolved", event: "RESOLVED" },
    ASSIGN: { to: "same", event: "ASSIGNED" },
  },
  resolved: {},
};

/** Events that count as the first human response (if none happened yet). */
export const FIRST_RESPONSE_EVENTS: readonly TicketEventType[] = ["DRAFT_APPROVED", "REPLY_LOGGED", "RESOLVED"];

export type TicketTransition =
  | { ok: true; toStatus: TicketStatus; eventType: TicketEventType }
  | { ok: false; code: "TICKET_ALREADY_RESOLVED" | "TICKET_ACTION_INVALID"; message: string };

export function checkTicketAction(from: TicketStatus, action: TicketAction): TicketTransition {
  if (from === "resolved") {
    return { ok: false, code: "TICKET_ALREADY_RESOLVED", message: `ticket is resolved; ${action} is not possible` };
  }
  const move = TRANSITIONS[from][action];
  if (!move) {
    return { ok: false, code: "TICKET_ACTION_INVALID", message: `${action} is not possible while ${from}` };
  }
  return { ok: true, toStatus: move.to === "same" ? from : move.to, eventType: move.event };
}

export function allowedActions(from: TicketStatus): TicketAction[] {
  return Object.keys(TRANSITIONS[from]) as TicketAction[];
}

/**
 * The ONE primary action a screen ends in (CLAUDE.md §13 UI rule), chosen by
 * code from the ticket's state — never by model text.
 */
export function primaryAction(status: TicketStatus, hasDraft: boolean): TicketAction | null {
  switch (status) {
    case "draft_ready":
      return "APPROVE_DRAFT";
    case "needs_human":
      return hasDraft ? "LOG_REPLY" : "ESCALATE";
    case "waiting_on_requester":
      return "RESOLVE";
    case "escalated":
      return "ENGINEERING_RETURNED";
    case "resolved":
      return null;
  }
}

/** Plain-language next step, for the queue and the shift handoff. */
export function nextStep(status: TicketStatus, assignee: string | null): string {
  if (status !== "resolved" && !assignee) return "Assign an owner";
  switch (status) {
    case "draft_ready":
      return "Check the drafted reply and approve it, or take it over";
    case "needs_human":
      return "Reply to the requester, or escalate with a full packet";
    case "waiting_on_requester":
      return "Wait for the requester; follow up before the resolution SLA";
    case "escalated":
      return "Chase engineering on the escalation";
    case "resolved":
      return "None — resolved";
  }
}
