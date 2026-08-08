# AgentDesk Database (Supabase Postgres + pgvector)

## Schema (M2 + M5)

Six application tables, nothing else:

```text
documents        currently active COMPLETED version of each ingested document
                 (uuid PK, unique business document_id, typed product/source
                 metadata, source_sha256, ingestion_fingerprint, embedding
                 provider/model/dimensions). No processing state here.
document_pages   1:N from documents (uuid FK, ON DELETE CASCADE),
                 unique (document_id, page_number), raw/clean text + hash
chunks           1:N from documents (uuid FK, ON DELETE CASCADE),
                 unique chunk_id, unique (document_id, chunk_index),
                 page bounds, section, chunk_type, content + hash,
                 embedding vector(1536), metadata jsonb
ingestion_runs   audit history keyed by BUSINESS document_id (text, no FK) —
                 survives document deletion. status: running | completed |
                 failed | skipped; error_code separate from error_message.

review_items     human review of a generated draft (M5). uuid PK, unique
                 business review_id. The creation-time artifact — snapshot
                 jsonb, snapshot_sha256, workflow_decision,
                 required_approval_level, review_reasons, checklist — is
                 IMMUTABLE (enforced by a trigger); only review_state,
                 reviewer, decision_note, revision_instructions and updated_at
                 change. Partial unique index on source_key WHERE
                 review_state = 'pending_review': at most one open review per
                 source, while terminal rows never block a later one.
review_events    append-only review history keyed by BUSINESS review_id (text,
                 no FK) — same principle as ingestion_runs. A trigger refuses
                 UPDATE outright and refuses DELETE except for rev_test_ rows,
                 so production history cannot be rewritten even by a caller
                 holding the secret key.
```

Table names: `reviews` / `audit_log` / `followup_tasks` are forbidden names
(`tests/database/schema.test.ts` asserts their absence), hence `review_items`
and `review_events`.

Four axes stay distinct and must never be merged (CLAUDE.md §4):
`comparisonStatus` (are the facts trustworthy — M4, not persisted here),
`workflow_decision` (how far may this travel), `required_approval_level` (how
much human authority is needed) and `review_state` (how far the work has got).

State ownership: `ingestion_runs.status` owns run state; a `documents` row
existing means "this completed version is active". Atomic replacement (the
`ingest_replace_document` RPC) makes partial states unobservable.

Review decisions go through the `decide_review_item` RPC, which follows the
same idiom: a transaction-scoped advisory lock, then a compare-and-set on the
state the caller believed it was acting on. The state change and its audit
event are written in one transaction, so two tabs can never produce both an
approval and a rejection, and a double submit appends nothing the second
time.

RLS is enabled on all four tables with **no policies** — anon and
authenticated roles see nothing. All access goes through server-side scripts
using the secret key.

## Environment

Copy `.env.example` to `.env` (git-ignored) and fill in:

- `SUPABASE_URL` — project URL
- `SUPABASE_SECRET_KEY` — `sb_secret_*` secret key (Settings → API keys).
  Server-only; this is the only accepted variable name.
- `SUPABASE_DB_URL` — Session-pooler Postgres connection string, used only
  by `npm run db:push` / `db:push:dry` to apply migrations.

Never print, log or commit secret values.

## Applying migrations

Migrations live in `supabase/migrations/` (Supabase CLI layout).

Preferred (CLI):

```bash
npx supabase link --project-ref <ref>   # needs SUPABASE_ACCESS_TOKEN + db password once
npm run db:push:dry                     # report which migrations would run
npm run db:push                         # apply
```

Fallback (no CLI credentials): open the Supabase SQL Editor and paste the
migration files in filename order. Record what was applied.

Never run `supabase db reset --linked` against this project.

## Teardown / rebuild (demo scope, forward-only migrations)

```sql
drop function if exists public.decide_review_item(text, text, text, text, text, text, text, text, jsonb);
drop table if exists public.review_events;
drop table if exists public.review_items;
drop function if exists public.review_items_freeze_artifact();
drop function if exists public.review_events_append_only();
drop function if exists public.ingest_replace_document(jsonb, jsonb, jsonb);
drop function if exists public.schema_diagnostics();
drop table if exists public.chunks;
drop table if exists public.document_pages;
drop table if exists public.ingestion_runs;
drop table if exists public.documents;
```

Then re-apply the migrations.

## Tests

`npm run test:db` runs the Gate B schema tests against the linked project.
They use only `test_`-prefixed business document ids and clean up after
themselves; the cleanup helper hard-refuses any non-`test_` id.
