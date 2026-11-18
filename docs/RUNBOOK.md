# Runbook

Symptoms → checks → fix → how to verify. Every entry below is a failure this
project actually hit; the date says when.

**First check, always:**

```bash
curl -s https://agentdesk-acme307.vercel.app/api/health | python3 -m json.tool
```

| `status` | HTTP | Meaning |
|---|---|---|
| `ok` | 200 | config present, database reachable, knowledge base is the frozen 3/20/45, rate-limit table present |
| `degraded` | 200 | the app serves, but something is off — read `knowledgeBase.frozen`, `rateLimiter.tableReachable`, `config.openaiApiKey` |
| `down` | 503 | the database is unreachable or not configured; only static pages work |

Then find the request in the Vercel logs: every API response carries an
`x-request-id` header, and the matching log line is one JSON object with that
`requestId`, the `route`, `status` and `durationMs`.

---

## 1. Everything that touches data fails; the home page still loads

*Seen 2026-11-17: the free-tier Supabase project had been paused for inactivity.*

**Symptoms.** Typed questions, comparison-to-review, and the review queue
show "something went wrong". Sample-question chips still work (saved answers).
`/api/health` → `down`, `database.errorCode` set.

**Checks.**
1. `host <project-ref>.supabase.co` — `NXDOMAIN` means the project is paused
   (its DNS record is removed).
2. After a restore starts, the REST endpoint goes through stages. Observed on
   2026-11-17: `NXDOMAIN` → HTTP **521** (Cloudflare reached Supabase, origin
   not up yet; ~4 min) → HTTP **404** for a few seconds (PostgREST up, schema
   cache not loaded) → **200**.

**Fix.** supabase.com → project → *Restore*. Wait for 200; nothing to
redeploy on Vercel (the URL and keys do not change).

**Verify.** `/api/health` → `ok`; ask one typed question; open `/review`.

**Prevent.** The free tier pauses projects after a period of inactivity. An
uptime monitor on `/api/health` (which queries the database) would both alert
on this and generate regular activity — not yet set up, and whether it is
enough to prevent a pause is not verified.

## 2. `permission denied` on review creation or other RPCs

*Seen 2026-11-17, first CI run against a database built only from migrations.*

**Symptoms.** `POST /api/reviews` returns 500 `REVIEW_REQUEST_FAILED`; the
server log line has `event: review_create_error`. Locally: `permission denied
for function create_review_item`.

**Cause.** The original hosted project relied on Supabase's legacy behaviour
of auto-granting new objects to the API roles. Newer Supabase stacks (local
CLI, new projects) do not, so a fresh database built from the migrations had
no grants for `service_role`.

**Fix.** Migration `20261117000001_service_role_grants.sql` grants
`service_role` explicitly (anon/authenticated still get nothing). Apply with
`npm run db:push` (or `npx supabase db push --db-url "$SUPABASE_DB_URL"` when
the CLI is not linked). On the live project it was a no-op and was applied on
2026-11-17.

**Verify.** `npx supabase db push --dry-run --db-url "$SUPABASE_DB_URL"`
reports "Remote database is up to date"; creating a review returns 201/200.

## 3. Health says `degraded` with `rateLimiter.tableReachable: false`

*Expected right after the rate-limit change is merged and deployed, until the
migration is pushed.*

**Cause.** Vercel deploys code on merge; it does not run migrations.

**Effect.** None for users: the limiter **fails open** and the log line for
each model-spending request carries `"rateLimit": "unavailable"`.

**Fix.** `npm run db:push` (applies `20261117000002_rate_limits.sql`).

**Verify.** `/api/health` → `ok`.

**Gotcha found while building the check.** A PostgREST `HEAD` count on a table
that does not exist returns **204 with no error and no count**. A health check
using `head: true` would have reported the missing table as present. The
check now uses a `GET … limit 1` for existence (missing table → `PGRST205`)
and treats a missing count as a failure, never as zero.

## 4. Users get `429 RATE_LIMITED`

**Symptoms.** "请求太频繁 / Too many requests" in the question box; the response
has `Retry-After`. Log line: `"status": 429, "rateLimit": "blocked",
"rateLimitRule": "<rule>"`.

**Checks.** Which rule? `answer-ip` / `narrative-ip` (10 per 10 min per IP),
`transcribe-ip` (20 per 10 min), or `model-calls-daily` (300 per UTC day for
everyone). A `model-calls-daily` block during a live demo means someone else
used the budget.

**Fix.** Wait for `Retry-After`, or raise the limit in `lib/ops/rate-limit.ts`
(`RATE_LIMITS`) and redeploy. To reset immediately (service role, SQL editor):
`delete from rate_limit_counters where bucket_key = 'global:model-calls-daily';`

## 5. Typed questions are slow or time out

**Symptoms.** The spinner runs 30–75 s; occasionally "Something went wrong
while answering".

**Context (measured 2026-11-17, live demo, 6 typed questions):** 28, 31, 32,
34, 42 and 76 s end to end; median 33 s. Almost all of it is the reasoning
answer model (`meta.latencyMs` in the response tracks the end-to-end figure
within ~0.3 s).

**Limits in code.** The answer call aborts after 90 s; the route's
`maxDuration` is 120 s. The narrative call aborts after 90 s and degrades to
"unavailable" rather than failing the comparison.

**Checks.** The log line's `durationMs` and `errorCode`. `UPSTREAM_BUSY`
(HTTP 429 from our route, distinct from `RATE_LIMITED`) means OpenAI itself
rate limited or was overloaded. A 500 with `ANSWER_FAILED` after ~90 s is the
timeout.

**Fix.** Retry; check status.openai.com; check the OpenAI usage page for a hit
spend cap. `ANSWER_MODEL` can point at a faster model (trade-offs in
`docs/model-selection.md`).

## 6. Smoke test passes but the app was never reached

*Seen during the first deployment.*

**Symptoms.** `curl -L` on every URL returns 200, but the PDFs come back as
`text/html`.

**Cause.** Vercel Deployment Protection redirects every request to the Vercel
login page, which itself returns 200.

**Fix.** `vercel project protection disable agentdesk --sso`.

**Verify.** `/api/health` returns JSON, not HTML; a PDF returns
`application/pdf`. Smoke-test a JSON endpoint and assert the content type —
never trust a bare 200.

## 7. Automation shows `Demo / mock`, not `Delivered`

**Expected** when `N8N_WEBHOOK_URL` is unset (`/api/health` →
`config.n8nWebhook: false`). Nothing was sent, and the UI says so.

**If a webhook is configured and runs show `failed`:** `automation_runs` has
`response_code` and `error_code` (codes only — response bodies are never
stored). The dispatcher times out after 10 s and requires an
acknowledgement body; a 2xx without it is still `failed`. Re-pressing the
button is safe: the idempotency key (`reviewId:terminalEventId`) means n8n
never receives two jobs for one decision.

## 8. Knowledge base drifted (`knowledgeBase.frozen: false`)

**Cause.** Usually `npm run test:db` running against the shared demo database
(it creates and deletes `test_` documents), or a manual ingest.

**Checks.** `npm run validate:ingestion` (read-only) reports per-document
pages/chunks against the committed fixtures and lists leftover `test_` rows.

**Fix.** Re-run ingestion for the three products
(`npm run ingest:products -- --embedding=openai`) — it is idempotent — or
delete leftover `test_` documents with `npm run delete:document -- --document-id=test_<id>` (it refuses any non-`test_` id).

**Prevent.** Use a separate Supabase project for tests (CI already uses an
ephemeral one inside the runner).

## 9. A Vercel preview deployment says `down` / `NOT_CONFIGURED`

*Seen 2026-11-17 on the preview for this change.*

**Symptoms.** The preview URL renders pages, but `/api/health` returns 503
with every `config.*` flag `false` and `database.errorCode:
"NOT_CONFIGURED"`; typed questions, comparison-to-review and the queue fail.

**Cause.** The environment variables are set for the **Production**
environment only, so preview builds run without `SUPABASE_URL`,
`SUPABASE_SECRET_KEY` and `OPENAI_API_KEY`. The health check is reporting
that honestly.

**Options.** Leave it (previews are for build and static checks; CI covers
the database paths), or add the variables to *Preview* in Vercel → Settings →
Environment Variables. Pointing previews at the shared demo database means
preview traffic writes real review rows — prefer a separate project if you do.
