# Runbook — support triage (M9)

Pages `/support`, `/support/[id]`, `/support/handoff`. API under
`/api/support/*` (see `public/openapi.json`). Tables `support_tickets` and
`ticket_events` (migrations `20261118000001`–`0003`).

**All tickets in the demo are synthetic.** `tkt_seed_*` rows come from
`npm run seed:support`; `tkt_test_*` rows belong to the DB tests and are never
listed. Anyone with the demo link can submit a ticket, so treat any other row
as untrusted demo input too.

## How a ticket moves

| Status | Meaning | Who moves it |
|---|---|---|
| `draft_ready` | triage found a documented answer; a verbatim-quote draft waits for a person | Approve draft → `resolved`; Take over → `needs_human` |
| `needs_human` | a person must take the first turn | Log reply (stays), Ask requester → `waiting_on_requester`, Escalate → `escalated`, Resolve |
| `waiting_on_requester` | we asked for something | Requester replied → `needs_human`; Resolve |
| `escalated` | engineering has a packet | Engineering returned → `needs_human`; Resolve |
| `resolved` | terminal (DB-enforced) | — |

First response = the first Approve draft / Log reply / Ask requester /
Resolve. Nothing is ever sent by AgentDesk: there is no outbound channel. A
"reply" is text a person records after sending it themselves.

## SLA policy (demo, `lib/support/sla.ts`)

| | First response | Resolution |
|---|---|---|
| P1 | 1 h | 8 h |
| P2 | 4 h | 24 h |
| P3 | 8 h | 3 d |
| P4 | 24 h | 5 d |

Calendar minutes, no business hours, **no pause** while waiting on the
requester. At risk = ≤ 25 % of the target left. Breach is computed on read
(no job): every page and the handoff call the same function. A late first
response stays a breach after it is recorded (the DB refuses to move it).

## Triage (`lib/support/triage.ts`, rules v1)

No model. Category and priority are regex rules (red lines reuse
`classifyRedlines` from the Q&A pipeline); retrieval is BM25 over the 45
product chunks + the synthetic help center (`data/support-kb/articles.json`).
Auto-draft only when category ∈ {how_to, product_question}, priority ∈
{P3, P4}, match = high, and no red line. A red line → no draft at all.

Changing a rule or a threshold: edit, bump `TRIAGE_RULES_VERSION`, run
`npm run eval:triage`. The eval gates CI (8 hard gates, 22 frozen tickets);
if a case's expected label should change, change it in
`evals/triage-cases.json` in the same commit and say why. Do not edit expected
labels to make a failing rule pass.

## Failure modes

**Queue says "Something went wrong loading tickets".** `/api/support/tickets`
returned 500. Check the request's JSON log line (`route":"/api/support/tickets"`)
for the code: `DB_TICKET_LIST_FAILED` → database unreachable or migrations
not applied (`npx supabase@2 db push --db-url "$SUPABASE_DB_URL"`, see
RUNBOOK §1). On a Vercel preview this is expected — previews have no DB
variables (RUNBOOK §9).

**An action returns 409 `TICKET_CONFLICT`.** Someone acted first; the
response carries the current ticket and the page re-renders it. Not a bug.

**422 `TICKET_ACTION_INVALID` / `TICKET_ALREADY_RESOLVED`.** The action is not
legal from the current status (`lib/support/state-machine.ts`).

**429 on ticket creation.** 20 per 10 min per client (`support-create-ip`).

**Seed tickets all show "breached".** Seed times are relative to when the
seed ran. Re-run `npm run seed:support` (deletes and rewrites only
`tkt_seed_*`).

**`TICKET_CLOCK_SKEW`.** Only seed/test tickets may be backdated; an app
caller sent a timestamp more than 5 min from the database clock.

**`TICKET_ARTIFACT_IMMUTABLE` / `TICKET_EVENTS_APPEND_ONLY`.** Working as
intended: triage fields and the timeline cannot be rewritten. Re-triage is
"later" (would be a new event, not an edit).

## End of shift

Open `/support/handoff` (or `GET /api/support/handoff`, `?format=json` for
tools), copy the Markdown into the team channel. Reading it changes nothing,
so it is safe to call from a scheduler.

## Escalating well

The packet form is pre-filled by code (repro steps parsed from numbered lines
in the ticket, environment, request ids). Before sending, fill in: did you
reproduce it and what happened, expected vs actual, who is affected and the
workaround, what you ruled out. The request ids in the packet match the
`requestId` field of the JSON log lines, so engineering can find the exact
requests.
