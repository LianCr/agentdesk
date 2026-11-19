import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadTriageCorpus, type TriageCorpus } from "../../lib/support/kb";
import { createSupportTicket, performTicketAction } from "../../lib/support/service";
import { suggestEscalation } from "../../lib/support/escalation";
import { createServiceClient } from "../../lib/supabase/server";
import {
  applyTicketAction,
  deleteTestTickets,
  getTicket,
  listTicketEvents,
  listTickets,
} from "../../lib/supabase/support-repository";

// M9 database tests. tkt_test_ rows only; cleanup refuses anything else.
// They exercise the real triggers, advisory lock and compare-and-set.

let db: SupabaseClient;
let corpus: TriageCorpus;
const PREFIX = "tkt_test_m9_";
const ctx = (requestId = "req-test") => ({ db, corpus, requestId });
const BUG = { subject: "Review page stuck on loading", body: "Steps: 1. Open a review 2. Spinner forever. I cannot approve it. request id demo-req-55", requester: "Synthetic Broker 01", channel: "form" as const };
const HOWTO = { subject: "Getting HTTP 429", body: "How long do I wait after Too many requests?", requester: "Synthetic Broker 02", channel: "email" as const };

beforeAll(async () => {
  db = createServiceClient();
  corpus = await loadTriageCorpus(process.cwd());
  await deleteTestTickets(db, PREFIX);
});

afterAll(async () => {
  await deleteTestTickets(db, PREFIX);
});

describe("create", () => {
  it("writes the ticket, CREATED and TRIAGED atomically with the request id", async () => {
    const t = await createSupportTicket(ctx("req-create-a"), BUG, { ticketId: `${PREFIX}create` });
    expect(t.status).toBe("needs_human");
    expect(t.priority).toBe("P2");
    expect(Date.parse(t.firstResponseDueAt) - Date.parse(t.createdAt)).toBe(240 * 60_000);
    const events = await listTicketEvents(db, t.ticketId);
    expect(events.map((e) => e.eventType)).toEqual(["CREATED", "TRIAGED"]);
    expect(events.every((e) => e.requestId === "req-create-a")).toBe(true);
  });

  it("routes a documented question to draft_ready", async () => {
    const t = await createSupportTicket(ctx(), HOWTO, { ticketId: `${PREFIX}howto` });
    expect(t.status).toBe("draft_ready");
    expect(t.triage.draft?.citations.length).toBeGreaterThan(0);
  });

  it("refuses to backdate an app ticket", async () => {
    await expect(
      createSupportTicket({ ...ctx(), now: new Date(Date.now() - 86_400_000) }, BUG, { ticketId: "tkt_m9_not_test_backdated" }),
    ).rejects.toThrow(/TICKET_CLOCK_SKEW/);
    expect(await getTicket(db, "tkt_m9_not_test_backdated")).toBeNull();
  });

  it("test tickets are hidden from app listings", async () => {
    const ids = (await listTickets(db)).map((t) => t.ticketId);
    expect(ids.some((id) => id.startsWith(PREFIX))).toBe(false);
    const withTest = (await listTickets(db, { includeTest: true })).map((t) => t.ticketId);
    expect(withTest).toContain(`${PREFIX}create`);
  });
});

describe("lifecycle", () => {
  it("respond is not resolve: REQUEST_INFO records first response and waits", async () => {
    const id = `${PREFIX}reply`;
    await createSupportTicket(ctx(), BUG, { ticketId: id });
    const out = await performTicketAction(ctx("req-reply"), id, {
      action: "REQUEST_INFO",
      expectedStatus: "needs_human",
      actor: "Demo Agent A",
      replyText: "Thanks — which browser version are you on?",
    });
    expect(out?.result).toBe("applied");
    expect(out?.ticket.status).toBe("waiting_on_requester");
    expect(out?.ticket.firstResponseAt).not.toBeNull();
    expect(out?.ticket.resolvedAt).toBeNull();
    expect(out?.ticket.assignee).toBe("Demo Agent A");
  });

  it("a stale second writer gets a conflict and writes nothing", async () => {
    const id = `${PREFIX}stale`;
    const t = await createSupportTicket(ctx(), HOWTO, { ticketId: id });
    const approve = { action: "APPROVE_DRAFT" as const, expectedStatus: "draft_ready" as const, actor: "Demo Agent A" as const, replyText: t.triage.draft!.text };
    const [a, b] = await Promise.all([performTicketAction(ctx(), id, approve), performTicketAction(ctx(), id, { ...approve, actor: "Demo Agent B" })]);
    expect([a?.result, b?.result].sort()).toEqual(["applied", "conflict"]);
    const events = await listTicketEvents(db, id);
    expect(events.filter((e) => e.eventType === "DRAFT_APPROVED")).toHaveLength(1);
    expect(events.find((e) => e.eventType === "DRAFT_APPROVED")?.payload.edited).toBe(false);
  });

  it("the database CAS refuses a stale expected status even without the app check", async () => {
    const id = `${PREFIX}cas`;
    await createSupportTicket(ctx(), BUG, { ticketId: id });
    const r = await applyTicketAction(db, {
      ticketId: id, expectedStatus: "escalated", newStatus: "resolved", eventType: "RESOLVED",
      actor: "Demo Agent C", requestId: null, payload: {}, setAssignee: false, assignee: null,
    });
    expect(r).toEqual({ action: "conflict", status: "needs_human" });
    expect((await listTicketEvents(db, id)).map((e) => e.eventType)).toEqual(["CREATED", "TRIAGED"]);
  });

  it("escalation stores a hashed packet with the request ids, then resolved is terminal", async () => {
    const id = `${PREFIX}escalate`;
    const t = await createSupportTicket(ctx("req-esc-create"), BUG, { ticketId: id });
    const esc = await performTicketAction(ctx("req-esc"), id, {
      action: "ESCALATE", expectedStatus: "needs_human", actor: "Demo Agent B",
      escalation: { ...suggestEscalation(t), reproAttempted: true, reproResult: "Reproduced on Safari" },
    });
    expect(esc?.ticket.status).toBe("escalated");
    const escEvent = (await listTicketEvents(db, id)).find((e) => e.eventType === "ESCALATED")!;
    expect(escEvent.payload.packetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect((escEvent.payload.packet as { requestIds: string[] }).requestIds).toEqual(["demo-req-55", "req-esc-create"]);

    await performTicketAction(ctx(), id, { action: "RESOLVE", expectedStatus: "escalated", actor: "Demo Agent B", resolutionNote: "Fixed in deploy 42" });
    const again = await performTicketAction(ctx(), id, { action: "ASSIGN", expectedStatus: "resolved", actor: "Demo Agent A", assignee: "Demo Agent A" });
    expect(again?.result).toBe("invalid");
    const { error } = await db.from("support_tickets").update({ status: "needs_human", resolved_at: null }).eq("ticket_id", id);
    expect(error?.message).toMatch(/TICKET_ALREADY_RESOLVED/);
  });
});

describe("database invariants", () => {
  it("the triage artifact cannot be rewritten", async () => {
    const id = `${PREFIX}freeze`;
    await createSupportTicket(ctx(), BUG, { ticketId: id });
    for (const patch of [{ priority: "P4" }, { triage: { tampered: true } }, { subject: "changed subject" }, { created_at: new Date(0).toISOString() }]) {
      const { error } = await db.from("support_tickets").update(patch).eq("ticket_id", id);
      expect(error?.message, JSON.stringify(patch)).toMatch(/TICKET_ARTIFACT_IMMUTABLE/);
    }
  });

  it("a recorded first response cannot be moved", async () => {
    const id = `${PREFIX}response`;
    await createSupportTicket(ctx(), BUG, { ticketId: id });
    await performTicketAction(ctx(), id, { action: "LOG_REPLY", expectedStatus: "needs_human", actor: "Demo Agent A", replyText: "Looking into it right now." });
    const { error } = await db.from("support_tickets").update({ first_response_at: new Date().toISOString() }).eq("ticket_id", id);
    expect(error?.message).toMatch(/TICKET_RESPONSE_IMMUTABLE/);
  });

  it("events are append-only: no update, no delete of non-test history", async () => {
    const id = `${PREFIX}events`;
    await createSupportTicket(ctx(), BUG, { ticketId: id });
    const upd = await db.from("ticket_events").update({ actor: "someone else" }).eq("ticket_id", id);
    expect(upd.error?.message).toMatch(/TICKET_EVENTS_APPEND_ONLY/);
    const del = await db.from("ticket_events").delete().eq("ticket_id", "tkt_not_a_test_ticket_zz");
    expect(del.error).toBeNull(); // nothing matched; the trigger is per row
    const { data } = await db
      .from("ticket_events")
      .select("event_id")
      .not("ticket_id", "like", "tkt\\_test\\_%")
      .not("ticket_id", "like", "tkt\\_seed\\_%")
      .limit(1);
    if (data && data.length > 0) {
      const real = await db.from("ticket_events").delete().eq("event_id", (data[0] as { event_id: string }).event_id);
      expect(real.error?.message).toMatch(/TICKET_EVENTS_APPEND_ONLY/);
    }
  });

  it("status and channel enums are enforced by the database", async () => {
    const { error } = await db.rpc("create_support_ticket", {
      p_ticket_id: `${PREFIX}enum`, p_subject: "x subject", p_body: "x body", p_requester: "r", p_channel: "slack",
      p_category: "other", p_priority: "P3", p_status: "needs_human", p_triage: {},
      p_first_response_due_at: new Date(Date.now() + 3_600_000).toISOString(),
      p_resolution_due_at: new Date(Date.now() + 7_200_000).toISOString(),
      p_created_request_id: null, p_seed: false, p_created_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });
});
