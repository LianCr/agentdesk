import { describe, expect, it } from "vitest";
import { TRANSITIONS, allowedActions, checkTicketAction, nextStep, primaryAction } from "../../lib/support/state-machine";
import { TICKET_ACTIONS, TICKET_STATUSES } from "../../lib/support/types";

describe("ticket state machine", () => {
  it("resolved is terminal for every action", () => {
    for (const a of TICKET_ACTIONS) {
      const r = checkTicketAction("resolved", a);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("TICKET_ALREADY_RESOLVED");
    }
  });

  it("exactly the documented moves exist", () => {
    const legal = TICKET_STATUSES.flatMap((s) =>
      TICKET_ACTIONS.filter((a) => checkTicketAction(s, a).ok).map((a) => `${s}:${a}`),
    ).sort();
    expect(legal).toEqual(
      [
        "draft_ready:APPROVE_DRAFT", "draft_ready:TAKE_OVER", "draft_ready:ASSIGN",
        "needs_human:LOG_REPLY", "needs_human:REQUEST_INFO", "needs_human:ESCALATE", "needs_human:RESOLVE", "needs_human:ASSIGN",
        "waiting_on_requester:REQUESTER_REPLIED", "waiting_on_requester:RESOLVE", "waiting_on_requester:ASSIGN",
        "escalated:ENGINEERING_RETURNED", "escalated:RESOLVE", "escalated:ASSIGN",
      ].sort(),
    );
  });

  it("respond is not resolve: a logged reply keeps the ticket ours, asking for info waits on the requester", () => {
    expect(checkTicketAction("needs_human", "LOG_REPLY")).toEqual({ ok: true, toStatus: "needs_human", eventType: "REPLY_LOGGED" });
    expect(checkTicketAction("needs_human", "REQUEST_INFO")).toEqual({ ok: true, toStatus: "waiting_on_requester", eventType: "INFO_REQUESTED" });
  });

  it("assign never changes status", () => {
    for (const s of TICKET_STATUSES.filter((x) => x !== "resolved")) {
      const r = checkTicketAction(s, "ASSIGN");
      expect(r.ok && r.toStatus).toBe(s);
    }
  });

  it("an escalation cannot skip the human queue from a draft", () => {
    expect(checkTicketAction("draft_ready", "ESCALATE").ok).toBe(false);
  });

  it("the one primary action is always an allowed action", () => {
    for (const s of TICKET_STATUSES) {
      for (const responded of [true, false]) {
        for (const isBug of [true, false]) {
          const a = primaryAction(s, responded, isBug);
          if (a === null) expect(s).toBe("resolved");
          else expect(allowedActions(s)).toContain(a);
        }
      }
    }
  });

  it("needs_human: respond first, then a bug escalates and anything else resolves", () => {
    expect(primaryAction("needs_human", false, true)).toBe("LOG_REPLY");
    expect(primaryAction("needs_human", true, true)).toBe("ESCALATE");
    expect(primaryAction("needs_human", true, false)).toBe("RESOLVE");
  });

  it("an unowned open ticket's next step says it is unowned", () => {
    expect(nextStep("needs_human", null)).toBe("Unowned — reply to the requester, or escalate with a full packet");
    expect(nextStep("needs_human", "Demo Agent A")).toBe("Reply to the requester, or escalate with a full packet");
    expect(nextStep("resolved", null)).toMatch(/resolved/);
    expect(Object.keys(TRANSITIONS.resolved)).toHaveLength(0);
  });
});
