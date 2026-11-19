# M9 — Support triage (plan)

Status: plan, written before code. Owner-requested milestone (lifts the §13
"scope frozen" note for this one feature only). Red lines (§3) and the
four-axis rule (§4) still apply in full. Budget: 1–2 days.

## Why

The JD-shaped gap: ticket tracking, SLA tracking, AI first line, escalation
with full context, shift handoff, docs that deflect tickets. AgentDesk already
has the hard parts (retrieval with verbatim citations, deterministic
guardrails, immutable artifacts, append-only audit, eval gates). This milestone
puts a support desk on top of them — for the brokers who *use* AgentDesk, not
for their clients.

## Scope

| # | Piece | What it is |
|---|---|---|
| 1 | Ticket model | `support_tickets` + append-only `ticket_events`; RLS on, zero policies (same as every other table) |
| 2 | Automated first line | On create, **deterministic** triage (rules + retrieval, no LLM in v1): category, priority, KB retrieval, extractive draft with citations, code-computed confidence, route |
| 3 | SLA engine | Priority → first-response / resolution targets; `on_track · at_risk · breached · met` computed on read; queue sorted by risk |
| 4 | Queue UI | `/support`: filters, SLA badges, assign; `/support/[id]`: timeline, draft, citations, one code-chosen action |
| 5 | Escalation packet | Code pre-fills repro / request IDs / impact / ruled-out / environment; a human edits; stored hashed in the `ESCALATED` event |
| 6 | Shift handoff | `GET /api/support/handoff` → Markdown (or JSON) of every open ticket: SLA risk, last action, next step, blocker |
| 7 | KB-gap report | Read-only: low-match tickets grouped by top query terms, with counts and a suggested article *skeleton* (title + the verbatim questions; the answer is left for a human — code never invents it) |
| 8 | Metrics | `GET /api/support/metrics` + panel: first-response time, SLA hit rate, AI-resolution rate, escalation rate, backlog by priority |
| 9 | API | All routes in `public/openapi.json` (the contract test already enforces drift). No MCP change (cut, see review) |
| 10 | Tests / eval | unit (SLA math, rules, state machine, packet), DB (triggers, CAS, append-only), frozen triage eval gating CI |
| 11 | Docs | README section, `docs/runbooks/support-triage.md`, `docs/demo-script-support.md` |

### Design decisions that differ from the suggested design

- **No LLM in triage.** Category/priority are rules; the draft is *extractive*
  (verbatim passages + a fixed template). Reason: §3.3 (routing is code), and
  it keeps the eval deterministic so it can gate CI. An LLM-polished reply is
  "later".
- **Retrieval = the existing BM25 lexical index** (`lib/knowledge/lexical-search.ts`,
  already used by the MCP server) over the 45 frozen product chunks + a small
  committed **synthetic support KB** (`data/support-kb/articles.json`, help
  articles describing how AgentDesk really behaves) + approved KB drafts.
  Not pgvector: CI has placeholder vectors and the live path spends credit.
- **Confidence is a code-computed level** (`high · medium · low`) from BM25
  score and query-term coverage, with its reasons listed. §6.5 forbids showing
  a model-reported percentage; this is not one.
- **Statuses**: `needs_human · draft_ready · waiting_on_requester · escalated · resolved`.
  `new`/`triaged` are dropped: triage runs inside the create transaction, so
  no ticket is ever observable in them (repo rule: no empty states).
  `ai_resolved` becomes `draft_ready`: "resolved" is wrong because **nothing
  is ever sent** (AgentDesk has no outbound channel), and "ai" is wrong
  because v1 has no model in the loop. Respond ≠ resolve: **Log reply** sets
  `first_response_at` and moves to `waiting_on_requester` (the SLA clock does
  not pause — stated, not hidden); **Approve draft** records the reply and
  resolves; **Resolve** closes.
- **Humans see the passages too**: a `needs_human` ticket still shows the
  retrieved passages and the template reply as a starting point, unless a
  red line fired.
- **Routing**: `draft_ready` only if category ∈ {how_to, product_question}
  ∧ priority ∈ {P3, P4} ∧ confidence = high ∧ no red-line hit
  (`classifyRedlines`, reused). Everything else → `needs_human`. Red-line hits
  (recommendation, guarantee, legal/tax, injection) get **no draft at all**.
- **Identity**: no auth (unchanged). Assignee is one of a fixed server-side
  roster of synthetic agents (`Demo Agent A/B/C`), like `"Demo Reviewer"`.

## Data model (one migration `20261118000001_support_triage.sql`)

- `support_tickets`: `ticket_id` (`tkt_…`, `tkt_seed_…`, `tkt_test_…`),
  subject, body, requester, channel (form/email/api), category, priority
  (P1–P4), status, assignee, `triage jsonb` (frozen triage result incl. draft
  + citations + confidence reasons + rules version), `first_response_due_at`,
  `resolution_due_at`, `first_response_at`, `resolved_at`, `created_request_id`,
  `seed boolean`, timestamps. Trigger freezes subject/body/requester/channel/
  triage/created_at/seed (the reviewed-artifact idea from `review_items`).
- `ticket_events`: append-only (trigger; delete only for `tkt_test_%`), event
  type enum, actor, `request_id`, payload, occurred_at. Escalation packets
  live in the `ESCALATED` payload with their sha256 — no extra table.
- RPCs (advisory lock + compare-and-set, the `decide_review_item` idiom):
  `create_support_ticket` (ticket + CREATED + TRIAGED atomically),
  `apply_ticket_action` (expected status → new status + one event). Execute revoked from anon/authenticated, granted to
  service_role.

## Reuse

RAG/lexical retrieval + glossary · `classifyRedlines` · snapshot hashing
(`canonicalJson` + sha256) · state-machine pattern · `decide_review_item`
CAS idiom · `withRequestLog` (request id stored on ticket + every event, so a
packet links to the exact log lines) · `enforceRateLimit` (new rule on ticket
create: public write, no auth) · OpenAPI contract test · eval runner shape
(`--out=`, hard gates, non-zero exit).

## Milestones (each ≤ ½ day, one commit each)

1. Plan + review (this file). Target: 4–5 half-days.
2. Core (pure): types/zod, triage rules, SLA math, state machine, packet and
   handoff builders, support KB file; unit tests; triage eval + CI step.
3. Migration + repository + DB tests; push to `agentdesk-dev`.
4. API routes + OpenAPI + contract/route tests; rate limit on create.
5. UI: queue (+ metrics strip, KB gaps), detail (timeline / draft /
   citations / one primary action / escalation form), handoff page.
6. Synthetic seed script (~15 tickets across every SLA state), README,
   runbook, demo script.

## Test plan

- Unit: SLA boundaries (exactly-at-threshold, at-risk at 25 % remaining,
  met vs breached), every legal/illegal transition, routing truth table,
  confidence levels, packet builder keeps server-owned fields, handoff
  ordering.
- DB (`npm run test:db`, CI job 2): freeze trigger, append-only events, CAS
  conflict on a stale status, one open KB draft per gap, create is atomic,
  test rows cleaned.
- Triage eval (`npm run eval:triage`, CI job 1, **deterministic, no model, no
  DB**): ~20 frozen synthetic tickets with expected category/priority/route.
  Hard gates: no red-line ticket drafted; no bug/P1/P2 routed to AI; every
  draft citation quote is an exact substring of its source; no
  `ai_draft_ready` below high confidence; route and priority match expected.
  Category accuracy is reported. Caveat stated in the report: the set was
  written alongside the rules — it proves stability and safety invariants,
  not generalization.
- Mutation tests (≤3): a corrupted router must fail the gates.
- No new Playwright tests in this milestone (existing UI suite not in CI).

## What CR can truthfully claim after it ships

- Built a support-ticket triage desk on Next.js/TypeScript/Postgres: an
  automated first line (rules + BM25 retrieval, no LLM in v1: category,
  P1–P4, cited extractive drafts), SLA tracking with at-risk/breach computation, an
  append-only ticket timeline enforced by DB triggers, escalation packets
  linked to request-ID logs, and an auto-generated shift handoff.
- A frozen N-ticket triage eval with K safety/regression hard gates runs in CI
  (numbers from the CI run only). Claim the gates, **not** an accuracy figure
  (the set was written with the rules). All tickets are synthetic; every
  metric on screen is labelled "seeded demo data".
- **Not claimable**: production users, real ticket volume, real SLA results,
  Pylon/Zendesk integration, "AI resolved X %", LLM-based triage accuracy.

## Review (Fable, before code) and what changed

Critique: 7 half-days ≠ 1–2 days; KB-draft approval is a second review
workflow; respond and resolve were conflated; "ai_" naming overclaims a
model; ruled-out items must be code-verifiable; seeded metrics and a
self-written eval must be labelled. Adopted: KB-draft table + MCP tool cut,
`waiting_on_requester` + Log reply added, `draft_*` naming, packet gains
repro-attempted/result, impact (who / how many / workaround) and a
code-verified ruled-out list rendered as paste-ready Markdown; "AI
resolution rate" becomes **auto-draft acceptance rate** (approved unedited
÷ approved).

## Later (cut)

KB-draft approval workflow and feeding approved articles back into triage ·
MCP ticket tools · LLM-written replies · pgvector retrieval for tickets · email/Pylon/Slack
ingestion · business-hours SLA calendars and pause-on-customer · reopen ·
re-triage of existing tickets after KB approval · auth/roles · automated
cron breach events (computed on read instead) · Playwright happy path.
