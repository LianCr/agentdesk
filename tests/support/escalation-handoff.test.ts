import { describe, expect, it } from "vitest";
import {
  EscalationInputSchema,
  buildEscalationPacket,
  collectRequestIds,
  hashPacket,
  packetMarkdown,
  suggestEscalation,
} from "../../lib/support/escalation";
import { findKbGaps } from "../../lib/support/gaps";
import { buildHandoff, handoffMarkdown } from "../../lib/support/handoff";
import { computeMetrics } from "../../lib/support/metrics";
import { event, minutes, ticket, triageStub } from "./fixtures";

describe("escalation packet", () => {
  const t = ticket();
  const events = [event(), event({ eventId: "evt_test_2", eventType: "ASSIGNED", requestId: "req-assign-2" })];

  it("pre-fills repro steps, environment and request ids from the ticket", () => {
    const s = suggestEscalation(t);
    expect(s.reproSteps).toEqual(["Open the review queue", "Open a review", "Spinner forever."]);
    expect(s.environment).toMatch(/Safari/);
    expect(s.environment).toMatch(/\/review/);
    expect(EscalationInputSchema.safeParse(s).success).toBe(true);
  });

  it("links every request id on record: quoted, creating request and events", () => {
    expect(collectRequestIds(t, events)).toEqual(["demo-req-9", "req-create-1", "req-assign-2"]);
  });

  it("keeps server-owned facts out of the human's hands and hashes stably", () => {
    const human = { ...suggestEscalation(t), reproAttempted: true, reproResult: "Reproduced on Safari 18" };
    const p = buildEscalationPacket(t, events, human, "Demo Agent A", minutes(30));
    expect(p.ticket.priority).toBe("P2");
    expect(p.codeChecks.map((c) => c.check)).toContain("Request ids on record");
    expect(hashPacket(p)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPacket({ ...p })).toBe(hashPacket(p));
    expect(hashPacket({ ...p, human: { ...human, summary: "changed summary text" } })).not.toBe(hashPacket(p));
    const md = packetMarkdown(p);
    for (const heading of ["Customer impact", "Reproduction", "Logs", "Ruled out", "Checked by code"]) expect(md).toContain(heading);
    expect(md).toContain("Repro attempted by support: **yes** — Reproduced on Safari 18");
  });

  it("rejects a summary that is only whitespace", () => {
    expect(EscalationInputSchema.safeParse({ ...suggestEscalation(t), summary: "          " }).success).toBe(false);
  });
});

describe("shift handoff", () => {
  it("groups open tickets by SLA risk and names blockers", () => {
    const tickets = [
      ticket({ ticketId: "tkt_test_breached", firstResponseDueAt: minutes(10).toISOString() }),
      ticket({ ticketId: "tkt_test_escalated", status: "escalated", assignee: "Demo Agent B", firstResponseAt: minutes(5).toISOString() }),
      ticket({ ticketId: "tkt_test_done", status: "resolved", resolvedAt: minutes(5).toISOString(), firstResponseAt: minutes(5).toISOString() }),
    ];
    const h = buildHandoff(tickets, new Map([["tkt_test_breached", [event({ ticketId: "tkt_test_breached" })]]]), minutes(60));
    expect(h.openCount).toBe(2);
    expect(h.groups[0]!.items.map((i) => i.ticketId)).toEqual(["tkt_test_breached"]);
    expect(h.groups[0]!.items[0]!.blocker).toBe("Unowned P2");
    const md = handoffMarkdown(h);
    expect(md).toContain("## SLA breached (1)");
    expect(md).toContain("blocker: Waiting on engineering");
    expect(md).not.toContain("tkt_test_done");
  });
});

describe("metrics", () => {
  it("computes the narrow definitions it documents", () => {
    const tickets = [
      ticket({ ticketId: "a", status: "resolved", firstResponseAt: minutes(30).toISOString(), resolvedAt: minutes(30).toISOString(), triage: triageStub({ route: "draft_ready" }) }),
      ticket({ ticketId: "b", firstResponseAt: minutes(300).toISOString(), seed: true }),
      ticket({ ticketId: "c", priority: "P1" }),
    ];
    const events = [
      event({ ticketId: "a", eventType: "DRAFT_APPROVED", payload: { edited: false } }),
      event({ ticketId: "b", eventType: "ESCALATED" }),
    ];
    const m = computeMetrics(tickets, events, minutes(100));
    expect(m.medianFirstResponseMinutes).toBe(165);
    expect(m.firstResponseSlaHitRate).toBe(0.5); // a met, b late; c still running
    expect(m.autoDraftRate).toBe(0.333);
    expect(m.autoDraftAcceptanceRate).toBe(1);
    expect(m.escalationRate).toBe(0.333);
    expect(m.backlogByPriority).toEqual({ P1: 1, P2: 1, P3: 0, P4: 0 });
    expect(m.containsSeedData).toBe(true);
  });
  it("returns null, not 0, when nothing is measurable", () => {
    const m = computeMetrics([], [], minutes(0));
    expect(m.firstResponseSlaHitRate).toBeNull();
    expect(m.autoDraftAcceptanceRate).toBeNull();
  });
});

describe("knowledge-base gaps", () => {
  it("groups low-match answerable tickets by unseen terms and never writes the answer", () => {
    const low = (id: string) =>
      ticket({
        ticketId: id,
        subject: "Salesforce sync?",
        category: "how_to",
        priority: "P3",
        triage: triageStub({ category: "how_to", retrieval: { searchedTerms: ["salesforce", "sync"], unknownTerms: ["salesforce", "sync"], hits: [] } }),
      });
    const gaps = findKbGaps([low("x1"), low("x2"), ticket({ ticketId: "bug" })]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.count).toBe(2);
    expect(gaps[0]!.suggestedArticle.markdown).toContain("Not generated.");
  });
});
