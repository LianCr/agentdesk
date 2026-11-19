import type { Ticket, TicketEvent, TriageResult } from "../../lib/support/types";

// Synthetic test tickets. No real requester or customer.

export const T0 = new Date("2026-11-18T09:00:00.000Z");
export const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

export function triageStub(over: Partial<TriageResult> = {}): TriageResult {
  return {
    schemaVersion: 1,
    rulesVersion: 1,
    language: "en",
    category: "bug_report",
    categoryRule: "bug.broken",
    priority: "P2",
    priorityRule: "bug.blocking_one_user",
    redline: { hard: null, softFlags: [] },
    retrieval: { searchedTerms: ["review", "spinner"], unknownTerms: ["spinner"], hits: [] },
    match: { level: "low", topScore: 0, coverage: 0, reasons: ["no passage matched any ticket term"] },
    route: "needs_human",
    routeReasons: ["category bug_report always goes to a human"],
    draft: null,
    ...over,
  };
}

export function ticket(over: Partial<Ticket> = {}): Ticket {
  return {
    ticketId: "tkt_test_fixture",
    subject: "Review page stuck on loading",
    body: "Steps: 1. Open the review queue 2. Open a review 3. Spinner forever. Safari on iPhone, /review page. request id demo-req-9",
    requester: "Synthetic Broker 01",
    channel: "form",
    category: "bug_report",
    priority: "P2",
    status: "needs_human",
    assignee: null,
    triage: triageStub(),
    firstResponseDueAt: minutes(240).toISOString(),
    resolutionDueAt: minutes(24 * 60).toISOString(),
    firstResponseAt: null,
    resolvedAt: null,
    createdRequestId: "req-create-1",
    seed: false,
    createdAt: T0.toISOString(),
    updatedAt: T0.toISOString(),
    ...over,
  };
}

export function event(over: Partial<TicketEvent> = {}): TicketEvent {
  return {
    eventId: "evt_test_1",
    ticketId: "tkt_test_fixture",
    eventType: "CREATED",
    actor: "system",
    requestId: "req-create-1",
    fromStatus: null,
    toStatus: "needs_human",
    payload: {},
    occurredAt: T0.toISOString(),
    ...over,
  };
}
