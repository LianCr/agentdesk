# Demo video script — English, voice-over, ~4:00

For a recorded screen capture aimed at engineering and solutions interviewers.
Voice only (no face cam). The Chinese live-presentation version for insurance
executives is [demo-script.md](demo-script.md); this one reuses its measured
timings and adds the engineering and operations story.

Spoken text is ~530 words, about 4 minutes at a calm 130–140 words per minute.

---

## Before recording

- [ ] Open https://agentdesk-acme307.vercel.app/api/health — it must say
      `"status": "ok"`. If it says `down`, see [RUNBOOK.md §1](RUNBOOK.md)
      (paused database) before anything else.
- [ ] A **pending** Case C review must exist. Open `/review`, filter
      *Pending*: there should be a row for **Demo Client C · SecureRate 5 ×
      IndexFlex UL**. (One was created on 2026-11-17.) If not: `/compare` →
      Demo Client C, SecureRate 5 × IndexFlex UL → Generate → *Send for
      review*. Note its URL for shots 6–7.
- [ ] Warm up the live pipeline once: type any question and wait for the
      answer, so the recorded run is not a cold start.
- [ ] Browser: one window, zoom so citation cards are readable at 1080p, no
      bookmarks bar, notifications off.
- [ ] **Do not show a local file path or terminal on screen.** Record the
      browser only. If you show the repo, show it on github.com.
- [ ] Say "fictional" once early; never name a real carrier or a real client.

Things that are true and worth saying if the timing slips: typed questions
take 30–40 s typically (measured 28–76 s, median 33 s, over 6 runs on
2026-11-17) because a reasoning model writes the draft and code then checks
every quote.

---

## Shot list

| # | Time | Screen | Action |
|---|---|---|---|
| 1 | 0:00–0:20 | Home page | No clicks. Cursor rests on the subtitle. |
| 2 | 0:20–0:55 | Home page | Click sample chip **定期寿险有现金价值吗？**. Scroll to citation card → click **Open page 2** → PDF opens at page 2. |
| 3 | 0:55–1:20 | Home page | Click chip **TermPlus 61 岁续保费是多少？** → grey *Insufficient evidence* badge, missing-information list. |
| 4 | 1:20–1:35 | Home page | Type `Which product is best?` → Ask. Result in ~0.25 s, empty citation area. |
| 5 | 1:35–2:15 | `/compare` | Client background → click Demo Client C card. SecureRate 5 × IndexFlex UL → Generate. Point at the 5-year guarantee vs 7-year surrender schedule observation. |
| 6 | 2:15–2:50 | `/review/<Case C id>` | Point at the four status columns, then the checklist. |
| 7 | 2:50–3:10 | same | Enter revision instructions (below) → **Request revision**. The audit trail gains an event. |
| 8 | 3:10–3:25 | same | Scroll to post-review automation → **Create revision task** → *Demo / mock*. |
| 9 | 3:25–3:50 | new tab: `/api/health`, then `/openapi.json` | Show the health JSON (counts 3/20/45). Briefly show the OpenAPI file. |
| 10 | 3:50–4:00 | Home page | Closing line. |

Revision instructions to paste in shot 7:
`Confirm the existing contract surrender charge and MVA before any client-facing use.`

---

## Voice-over

**1 — Problem (0:00)**
"Chinese-speaking insurance agents serve clients in Chinese, but the product
documents are in English. AgentDesk lets an agent ask in Chinese and get an
answer grounded in the English source, with the page and the exact sentence
attached. Everything here is fictional demo data."

**2 — Grounded answer (0:20)**
"This answer comes back in Chinese, but look at the citation: TermPlus 20
product guide, page 2, and the original sentence — 'The policy does not
accumulate cash value.' One click opens the PDF at that page. The model
proposes quotes; code checks each one is an exact substring of the retrieved
text and attaches the page number itself. A claim whose quote fails that
check is never shown. The sample questions are pre-verified saved answers so
the demo is instant; a typed question runs the full pipeline live."

**3 — Refusal (0:55)**
"This one is a trap. The rate table stops at age 60, so a premium at 61 is not
in the documents. Instead of inventing a number, it says the evidence is
insufficient, cites what the documents do say, and lists exactly what is
missing."

**4 — Red line (1:20)**
"Asking which product is best is a compliance line. That came back in a
quarter of a second, because it never reached the model — a deterministic
rule stops it first. No recommendations, no suitability calls."

**5 — Comparison (1:35)**
"The comparison table has thirteen rows, and it is generated entirely by code
— about a second end to end, no model involved. Every cell traces to a page.
Here is something a reviewer needs to see: the rate guarantee lasts five
years, but surrender charges run to year seven. That is not an opinion — it
is two cited facts side by side. There is no score or winner field anywhere in
the data."

**6 — Review (2:15)**
"This client is 67 and replacing an existing annuity. The review shows four
separate answers instead of one 'high risk' badge: the facts check out; it
must not go to a client; it needs a licensed agent; and nobody has reviewed it
yet. Those need different actions, so they stay separate."

**7 — Decision and audit (2:50)**
"The reviewer requests a revision. The decision is recorded against a frozen,
hashed snapshot of the comparison, and the database itself refuses edits to
that snapshot or to the audit trail. Two tabs deciding at once produce one
decision, not two."

**8 — Automation (3:10)**
"A finished review can create a follow-up task through an n8n webhook. It can
only ever create an internal task — there is no client-facing task type and no
recipient field. With no webhook configured it says 'mock', never
'delivered'."

**9 — Operations (3:25)**
"Behind it: a health endpoint that really queries the database and checks the
knowledge base is still the frozen 3 documents, 20 pages, 45 chunks the
evaluations assume. Every API request writes one structured log line with a
request ID, and the endpoints that spend model credit are rate limited. The
API is described in an OpenAPI file that a test keeps in sync with the code.
CI runs the unit tests, the database tests and two frozen evaluation suites
on every pull request."

**10 — Close (3:50)**
"Answer in the client's language, show the English source for every fact,
say so when the documents don't know — and leave the final call to a licensed
human."

