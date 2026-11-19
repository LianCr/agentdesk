import { z } from "zod";

// M9 support triage — the vocabulary.
//
// Four things are kept apart on purpose, the same discipline as the review
// workflow's four axes:
//   category  what the ticket is about          (code, at triage)
//   priority  how bad it is                     (code, at triage)
//   route     who should take the first turn    (code, at triage)
//   status    how far the work has actually got (people, over time)
//
// Nothing here is ever sent to the requester. AgentDesk has no outbound
// channel; "draft_ready" means a reply is drafted and waiting for a human.

export const TICKET_CATEGORIES = [
  "product_question",
  "how_to",
  "bug_report",
  "access",
  "privacy_request",
  "policy_sensitive",
  "feature_request",
  "other",
] as const;
export const TicketCategorySchema = z.enum(TICKET_CATEGORIES);
export type TicketCategory = z.infer<typeof TicketCategorySchema>;

export const TICKET_PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export const TicketPrioritySchema = z.enum(TICKET_PRIORITIES);
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

export const TICKET_CHANNELS = ["form", "email", "api"] as const;
export const TicketChannelSchema = z.enum(TICKET_CHANNELS);
export type TicketChannel = z.infer<typeof TicketChannelSchema>;

export const TICKET_STATUSES = [
  "needs_human",
  "draft_ready",
  "waiting_on_requester",
  "escalated",
  "resolved",
] as const;
export const TicketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const OPEN_STATUSES: readonly TicketStatus[] = TICKET_STATUSES.filter((s) => s !== "resolved");

/** First-turn routing decided by code at triage. Not a status. */
export const TriageRouteSchema = z.enum(["draft_ready", "needs_human"]);
export type TriageRoute = z.infer<typeof TriageRouteSchema>;

export const MatchLevelSchema = z.enum(["high", "medium", "low"]);
export type MatchLevel = z.infer<typeof MatchLevelSchema>;

/** Actions a person can take. The browser sends one of these, never a status. */
export const TICKET_ACTIONS = [
  "APPROVE_DRAFT",
  "TAKE_OVER",
  "LOG_REPLY",
  "REQUEST_INFO",
  "REQUESTER_REPLIED",
  "ESCALATE",
  "ENGINEERING_RETURNED",
  "RESOLVE",
  "ASSIGN",
] as const;
export const TicketActionSchema = z.enum(TICKET_ACTIONS);
export type TicketAction = z.infer<typeof TicketActionSchema>;

export const TICKET_EVENT_TYPES = [
  "CREATED",
  "TRIAGED",
  "DRAFT_APPROVED",
  "TAKEN_OVER",
  "REPLY_LOGGED",
  "INFO_REQUESTED",
  "REQUESTER_REPLIED",
  "ESCALATED",
  "ENGINEERING_RETURNED",
  "RESOLVED",
  "ASSIGNED",
] as const;
export const TicketEventTypeSchema = z.enum(TICKET_EVENT_TYPES);
export type TicketEventType = z.infer<typeof TicketEventTypeSchema>;

/**
 * Synthetic support agents. No auth exists in this demo, so "who" is one of a
 * fixed server-side roster — the same honesty as "Demo Reviewer": a
 * placeholder, not an identity claim.
 */
export const SUPPORT_AGENTS = ["Demo Agent A", "Demo Agent B", "Demo Agent C"] as const;
export const SupportAgentSchema = z.enum(SUPPORT_AGENTS);
export type SupportAgent = z.infer<typeof SupportAgentSchema>;

export const TriageCitationSchema = z.object({
  citationId: z.string(),
  sourceType: z.enum(["product_guide", "help_article"]),
  sourceId: z.string(),
  chunkId: z.string(),
  title: z.string(),
  page: z.number().int().positive().nullable(),
  quote: z.string().min(1),
  url: z.string().nullable(),
});
export type TriageCitation = z.infer<typeof TriageCitationSchema>;

export const TriageResultSchema = z.object({
  schemaVersion: z.literal(1),
  rulesVersion: z.number().int().positive(),
  language: z.enum(["en", "zh"]),
  category: TicketCategorySchema,
  categoryRule: z.string(),
  priority: TicketPrioritySchema,
  priorityRule: z.string(),
  redline: z.object({ hard: z.string().nullable(), softFlags: z.array(z.string()) }),
  retrieval: z.object({
    searchedTerms: z.array(z.string()),
    /** Ticket terms that appear nowhere in the knowledge base — the gap signal. */
    unknownTerms: z.array(z.string()),
    hits: z.array(
      z.object({
        sourceType: z.enum(["product_guide", "help_article"]),
        sourceId: z.string(),
        chunkId: z.string(),
        title: z.string(),
        page: z.number().int().positive().nullable(),
        score: z.number(),
        matchedTerms: z.array(z.string()),
      }),
    ),
  }),
  match: z.object({
    level: MatchLevelSchema,
    topScore: z.number(),
    coverage: z.number(),
    reasons: z.array(z.string()),
  }),
  route: TriageRouteSchema,
  routeReasons: z.array(z.string()),
  /** Extractive template reply. null when a red line fired or nothing matched. */
  draft: z
    .object({
      text: z.string(),
      citations: z.array(TriageCitationSchema).min(1),
    })
    .nullable(),
});
export type TriageResult = z.infer<typeof TriageResultSchema>;

export const TicketInputSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(5000),
  requester: z.string().trim().min(1).max(120),
  channel: TicketChannelSchema.default("form"),
});
export type TicketInput = z.infer<typeof TicketInputSchema>;

/** A ticket as the app reads it (camelCase, parsed). */
export interface Ticket {
  ticketId: string;
  subject: string;
  body: string;
  requester: string;
  channel: TicketChannel;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string | null;
  triage: TriageResult;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdRequestId: string | null;
  seed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketEvent {
  eventId: string;
  ticketId: string;
  eventType: TicketEventType;
  actor: string;
  requestId: string | null;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}
