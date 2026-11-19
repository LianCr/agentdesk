import { describe, expect, it } from "vitest";
import { SLA_TARGETS, clockStatus, compareBySlaRisk, dueDates, formatMinutes, slaStatus } from "../../lib/support/sla";
import { T0, minutes, ticket } from "./fixtures";

describe("SLA due dates", () => {
  it("adds the priority's targets to the creation time", () => {
    const d = dueDates("P1", T0);
    expect(d.firstResponseDueAt.toISOString()).toBe(minutes(60).toISOString());
    expect(d.resolutionDueAt.toISOString()).toBe(minutes(480).toISOString());
  });

  it("targets get strictly looser from P1 to P4", () => {
    const order = (["P1", "P2", "P3", "P4"] as const).map((p) => SLA_TARGETS[p]);
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!.firstResponse).toBeGreaterThan(order[i - 1]!.firstResponse);
      expect(order[i]!.resolution).toBeGreaterThan(order[i - 1]!.resolution);
    }
  });
});

describe("clockStatus boundaries (P1 first response: 60 min target, due at +60)", () => {
  const due = minutes(60);
  it("on track with more than 25% left", () => expect(clockStatus(due, 60, null, minutes(44)).state).toBe("on_track"));
  it("at risk at exactly 25% left", () => expect(clockStatus(due, 60, null, minutes(45)).state).toBe("at_risk"));
  it("still at risk (not breached) at exactly the due time", () => expect(clockStatus(due, 60, null, minutes(60)).state).toBe("at_risk"));
  it("breached one millisecond after due", () =>
    expect(clockStatus(due, 60, null, new Date(due.getTime() + 1)).state).toBe("breached"));
  it("met when stopped exactly at due", () => expect(clockStatus(due, 60, minutes(60), minutes(500)).state).toBe("met"));
  it("a late stop stays breached forever", () => expect(clockStatus(due, 60, minutes(61), minutes(9999)).state).toBe("breached"));
  it("reports negative minutes once overdue", () => expect(clockStatus(due, 60, null, minutes(90)).minutesRemaining).toBe(-30));
});

describe("slaStatus overall", () => {
  it("an unanswered ticket past its first-response due is breached overall", () => {
    expect(slaStatus(ticket(), minutes(241)).overall).toBe("breached");
  });
  it("a responded ticket is judged by its resolution clock", () => {
    const t = ticket({ firstResponseAt: minutes(30).toISOString() });
    const s = slaStatus(t, minutes(300));
    expect(s.firstResponse.state).toBe("met");
    expect(s.overall).toBe("on_track");
  });
  it("a late first response keeps an open ticket breached", () => {
    const t = ticket({ firstResponseAt: minutes(300).toISOString() });
    expect(slaStatus(t, minutes(301)).overall).toBe("breached");
  });
  it("a resolved ticket has no next due time", () => {
    const t = ticket({ firstResponseAt: minutes(10).toISOString(), resolvedAt: minutes(20).toISOString() });
    const s = slaStatus(t, minutes(5000));
    expect(s.overall).toBe("met");
    expect(s.nextDueMinutes).toBeNull();
  });
});

describe("queue order", () => {
  it("breached, then at risk, then soonest due", () => {
    const now = minutes(200);
    const breached = ticket({ ticketId: "a", firstResponseDueAt: minutes(100).toISOString() });
    const atRisk = ticket({ ticketId: "b", firstResponseDueAt: minutes(230).toISOString() });
    const later = ticket({ ticketId: "c", firstResponseDueAt: minutes(2000).toISOString(), resolutionDueAt: minutes(9000).toISOString() });
    const soon = ticket({ ticketId: "d", firstResponseDueAt: minutes(900).toISOString(), resolutionDueAt: minutes(9000).toISOString() });
    const sorted = [later, soon, atRisk, breached].sort(compareBySlaRisk(now)).map((t) => t.ticketId);
    expect(sorted).toEqual(["a", "b", "d", "c"]);
  });
});

describe("formatMinutes", () => {
  it("formats both directions", () => {
    expect(formatMinutes(125)).toBe("in 2h 05m");
    expect(formatMinutes(-30)).toBe("30m ago");
    expect(formatMinutes(3000)).toBe("in 2d 2h");
  });
});
