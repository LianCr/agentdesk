import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "../reviews/types";
import { formatMinutes, slaStatus } from "./sla";
import type { Ticket, TicketEvent } from "./types";

// Escalation packet: everything an engineer needs to start, in one paste.
//
// Two kinds of content, kept apart like the review workflow keeps facts and
// human decisions apart:
//   server-owned  ticket facts, SLA, request ids, and the checks CODE actually
//                 performed (red-line rules, knowledge-base match, log ids on
//                 record). The browser cannot submit or change these.
//   human-written summary, repro steps and whether repro was attempted,
//                 expected/actual, impact, workaround, environment, and what
//                 the human ruled out. Code pre-fills a suggestion; a person
//                 edits it before it is stored.
// The stored packet is hashed (canonical JSON + sha256) and lives in the
// append-only ESCALATED event, so it can never be edited after the fact.

const line = z.string().trim().max(500);

export const EscalationInputSchema = z.object({
  summary: z.string().trim().min(10).max(300),
  reproSteps: z.array(line.min(1)).max(15),
  reproAttempted: z.boolean(),
  reproResult: line,
  expected: line,
  actual: line,
  affectedUsers: line.min(1),
  workaround: line,
  environment: line,
  ruledOut: z.array(line.min(1)).max(10),
});
export type EscalationInput = z.infer<typeof EscalationInputSchema>;

export interface CodeCheck {
  check: string;
  result: string;
}

export interface EscalationPacket {
  schemaVersion: 1;
  ticket: {
    ticketId: string;
    subject: string;
    category: string;
    priority: string;
    requester: string;
    channel: string;
    createdAt: string;
  };
  sla: { firstResponse: string; resolution: string };
  /** x-request-id values recorded on this ticket — searchable in the request logs. */
  requestIds: string[];
  codeChecks: CodeCheck[];
  human: EscalationInput;
  escalatedBy: string;
  escalatedAt: string;
}

const BROWSERS = /\b(chrome|safari|firefox|edge|ios|iphone|ipad|android|macos|windows)\b/gi;
const ROUTES = /(?:^|\s)(\/(?:api\/)?[a-z][a-z0-9/_-]*)/gi;
const REQUEST_ID = /\b(?:request[ -]?id|x-request-id)[:\s#]*([A-Za-z0-9:_\-.]{4,128})/gi;

/** Request ids the requester quoted in the ticket text. */
export function quotedRequestIds(text: string): string[] {
  // A sentence's full stop is not part of the id.
  return [...new Set([...text.matchAll(REQUEST_ID)].map((m) => m[1]!.replace(/[.:_-]+$/, "")))];
}

/** Code's first guess at the human part. Every field is editable. */
export function suggestEscalation(ticket: Ticket): EscalationInput {
  const body = ticket.body;
  const numbered = [...body.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+([^\n]+?)(?=\s+\d{1,2}[.)]\s|\n|$)/g)].map((m) => m[2]!.trim().split(/(?<=[.!?])\s+/)[0]!); // a step ends at its sentence
  const env = [...new Set([...body.matchAll(BROWSERS)].map((m) => m[1]!))];
  const routes = [...new Set([...body.matchAll(ROUTES)].map((m) => m[1]!))];
  const ruledOut: string[] = [];
  if (ticket.triage.match.level !== "high") ruledOut.push("Not a documented, known behaviour (no strong help-center match)");
  return {
    summary: ticket.subject.length >= 10 ? ticket.subject : `${ticket.subject} — ${ticket.category}`,
    reproSteps: numbered.slice(0, 15),
    reproAttempted: false,
    reproResult: "",
    expected: "",
    actual: "",
    affectedUsers: ticket.priority === "P1" ? "Multiple users (reported as widespread)" : "1 requester",
    workaround: "",
    environment: [...env, ...routes].join(", "),
    ruledOut,
  };
}

/** What code actually verified. Nothing here is a guess. */
export function codeChecks(ticket: Ticket, requestIds: string[]): CodeCheck[] {
  const t = ticket.triage;
  const top = t.retrieval.hits[0];
  return [
    {
      check: "Red-line rules (recommendation, guarantee, legal/tax, injection)",
      result: t.redline.hard ? `matched ${t.redline.hard}` : "none matched",
    },
    {
      check: "Knowledge base searched (product guides + help center, BM25)",
      result: top
        ? `match ${t.match.level}; best: ${top.title}${top.page ? ` p.${top.page}` : ""} (score ${top.score})`
        : "no passage matched",
    },
    {
      check: "Triage rules",
      result: `category ${t.category} (${t.categoryRule}); priority ${t.priority} (${t.priorityRule}); rules v${t.rulesVersion}`,
    },
    {
      check: "Request ids on record",
      result: requestIds.length ? `${requestIds.length}: ${requestIds.join(", ")}` : "none recorded",
    },
  ];
}

export function collectRequestIds(ticket: Ticket, events: TicketEvent[]): string[] {
  const ids = [
    ...quotedRequestIds(`${ticket.subject}\n${ticket.body}`),
    ticket.createdRequestId,
    ...events.map((e) => e.requestId),
  ].filter((x): x is string => !!x);
  return [...new Set(ids)];
}

export function buildEscalationPacket(
  ticket: Ticket,
  events: TicketEvent[],
  human: EscalationInput,
  escalatedBy: string,
  now: Date,
): EscalationPacket {
  const sla = slaStatus(ticket, now);
  const requestIds = collectRequestIds(ticket, events);
  return {
    schemaVersion: 1,
    ticket: {
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      requester: ticket.requester,
      channel: ticket.channel,
      createdAt: ticket.createdAt,
    },
    sla: {
      firstResponse: ticket.firstResponseAt
        ? sla.firstResponse.state
        : `${sla.firstResponse.state} (due ${formatMinutes(sla.firstResponse.minutesRemaining)})`,
      resolution: ticket.resolvedAt
        ? sla.resolution.state
        : `${sla.resolution.state} (due ${formatMinutes(sla.resolution.minutesRemaining)})`,
    },
    requestIds,
    codeChecks: codeChecks(ticket, requestIds),
    human,
    escalatedBy,
    escalatedAt: now.toISOString(),
  };
}

export function hashPacket(packet: EscalationPacket): string {
  return createHash("sha256").update(canonicalJson(packet)).digest("hex");
}

const bullet = (items: string[], empty: string) => (items.length ? items.map((i) => `- ${i}`).join("\n") : `- ${empty}`);

/** Paste-ready Markdown for an engineering channel or issue tracker. */
export function packetMarkdown(p: EscalationPacket): string {
  const h = p.human;
  return [
    `## Escalation: ${h.summary}`,
    "",
    `**Ticket** ${p.ticket.ticketId} · ${p.ticket.priority} · ${p.ticket.category} · via ${p.ticket.channel} · opened ${p.ticket.createdAt}`,
    `**SLA** first response ${p.sla.firstResponse} · resolution ${p.sla.resolution}`,
    "",
    "### Customer impact",
    `- Affected: ${h.affectedUsers}`,
    `- Workaround: ${h.workaround || "none known"}`,
    "",
    "### Reproduction",
    h.reproSteps.length ? h.reproSteps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "_No steps provided._",
    "",
    `- Repro attempted by support: **${h.reproAttempted ? "yes" : "no"}**${h.reproResult ? ` — ${h.reproResult}` : ""}`,
    `- Expected: ${h.expected || "—"}`,
    `- Actual: ${h.actual || "—"}`,
    `- Environment: ${h.environment || "—"}`,
    "",
    "### Logs",
    bullet(p.requestIds.map((id) => `\`x-request-id: ${id}\``), "no request ids recorded"),
    "",
    "### Ruled out",
    bullet(h.ruledOut, "nothing ruled out yet"),
    "",
    "_Checked by code:_",
    ...p.codeChecks.map((c) => `- ${c.check}: ${c.result}`),
    "",
    `_Escalated by ${p.escalatedBy} at ${p.escalatedAt}. AgentDesk demo — synthetic data._`,
  ].join("\n");
}
