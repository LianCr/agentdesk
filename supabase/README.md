# AgentDesk Database (Supabase Postgres + pgvector)

## Schema (M2)

Four application tables, nothing else:

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
```

State ownership: `ingestion_runs.status` owns run state; a `documents` row
existing means "this completed version is active". Atomic replacement (the
`ingest_replace_document` RPC) makes partial states unobservable.

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
