# AGENTS.md

Engineering rules and product boundaries live in `CLAUDE.md`. Setup and run
commands live in `README.md` ("Run it locally") and `docs/deployment.md`. Read
those first; this file only records the non-obvious, durable context for working
in a Cursor Cloud environment.

## Cursor Cloud specific instructions

### What runs without secrets (and what doesn't)

The environment ships without `OPENAI_API_KEY`, `SUPABASE_URL`, or
`SUPABASE_SECRET_KEY`. A large, meaningful slice of the demo still works because
it is deliberately code-driven from committed data on disk (no DB, no network):

- Homepage `/` — the five preset sample-question chips return pre-verified saved
  answers with real citation cards (`data/demo-answers.json` via
  `components/chat/preset-answers.ts`). Typing a *non-preset* question hits the
  live pipeline and requires `OPENAI_API_KEY` + Supabase.
- `/compare` and `/api/compare` — the deterministic 13-row comparison table and
  the `npm run compare` CLI read only committed files
  (`lib/comparison/loader.ts`); they never touch the DB or a model.

What DOES require secrets (add them in the Secrets panel if you need these
paths): live Q&A (`/api/answer`), voice transcription (`/api/transcribe`),
compare narrative (`/api/compare/narrative`) need `OPENAI_API_KEY`; the review
workflow (`/review`, `/api/reviews/*`), ingestion, and `test:db`/`test:retrieval`
need `SUPABASE_URL` + `SUPABASE_SECRET_KEY`. `db:push` additionally needs a
one-time `supabase link` + `SUPABASE_DB_URL`. Prod and local share the same
hosted Supabase project — there is no local Supabase stack in the demo path.

Secrets are read from `process.env`, and `.env` is loaded via
`process.loadEnvFile(".env")` (`lib/ai/client.ts`). Cloud Secrets injected as
env vars work directly; for a local `.env`, copy `.env.example` → `.env`
(git-ignored).

### Running, testing, linting

- Dev server: `npm run dev` (http://localhost:3000). The `predev` hook runs
  `sync:public-pdfs`, which copies the committed product PDFs into
  `public/documents/`; it does not invoke a browser at request time.
- There is no lint script — `npm run typecheck` (`tsc --noEmit`) is the only
  static-analysis gate.
- `npm test` is the offline unit suite and is safe with no secrets. The
  credit-spending / hosted suites — `test:db`, `test:retrieval`,
  `test:embeddings:live`, `test:embeddings` — only pass with real Supabase/OpenAI
  credentials and are not run by `npm test`.
- `npm run test:ui` needs the Playwright Chromium browser installed
  (`npx playwright install chromium`); the update script handles this on startup.
