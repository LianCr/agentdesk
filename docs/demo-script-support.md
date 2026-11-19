# Demo script — support desk (2 minutes)

Before recording: `npm run seed:support` (refreshes the synthetic tickets so
SLA states are current), open `/support` on desktop width. Everything shown
is synthetic — say so once, at the start.

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | `/support` | Point at the grey notice | "This is a support desk on top of AgentDesk. All tickets here are synthetic seed data." |
| 0:10 | Queue | Point at the first rows (breached, at risk) | "The queue is sorted by SLA risk, not by age: breached first, then at risk. SLA is computed on read, so every screen agrees." |
| 0:25 | Metrics strip | Hover the five numbers | "First-response time, SLA hit rate, how many automated drafts were approved unedited, escalation rate — each with a written definition in the API. On seed data they describe the seed, not a team." |
| 0:35 | Open "Getting HTTP 429" | Open the triage fold | "Triage is rules plus retrieval, no LLM. Here is why it went to draft_ready: how-to, P3, high knowledge-base match, no red line." |
| 0:50 | Draft | Point at the quotes and the citation | "The draft only quotes the help center verbatim. Nothing is sent — approving records that a person replied." Click **Approve**. |
| 1:00 | Back, open "Which product is best…" | Open the triage fold | "A red line fired, so there is no draft at all. It goes to a human — the same rule the Q&A pipeline uses." |
| 1:10 | Open "Review page stuck on loading" | Log a short reply, then click **Escalate** | "Respond first — that stops the first-response clock. Then escalate. The form is pre-filled from the ticket: repro steps, environment, request ids." Tick "attempted repro", type a result. Submit. |
| 1:30 | Packet | Click **Copy Markdown** | "This is what engineering gets: impact, repro, logs by request id, what's ruled out, and what code actually checked. It is hashed and stored in an append-only timeline." |
| 1:45 | `/support/handoff` | Scroll | "End of shift: every open ticket by SLA risk, last action, next step, blocker. Generated from state, copy-paste into the channel." |
| 1:55 | Queue → Knowledge-base gaps | Expand | "Tickets the docs couldn't answer, grouped — two Salesforce questions. The article skeleton has the questions; the answer is left for a person." |

Do not claim: real customers, real volume, Pylon/Zendesk integration, or an
AI accuracy figure.
