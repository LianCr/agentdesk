-- M5.1-A: post-review automation delivery records.
--
-- One table. A webhook call is external HTTP and cannot join a database
-- transaction, so there is deliberately no RPC here: pretending the send and
-- the record are atomic would be a fiction. The honest shape is a row written
-- first as `pending`, then updated with what actually happened.
--
-- Naming note: `followup_tasks` is a forbidden table name in this project
-- (tests/database/schema.test.ts asserts it is absent), so this is
-- `automation_runs` -- which is also the more accurate name: the row is a
-- record of a delivery attempt, not the task itself. The task lives in n8n.

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id text not null unique,              -- aut_<uuid>, the outward handle
  -- Business text key with no foreign key, for the same reason ingestion_runs
  -- and review_events work this way: delivery history must survive the removal
  -- of the thing it describes.
  review_id text not null,
  trigger_event_id text not null,
  task_type text not null
    check (task_type in ('internal_followup', 'internal_revision')),

  -- reviewId:terminalEventId. The uniqueness constraint IS the deduplication:
  -- a double-clicked button, a retried request or a second tab all resolve to
  -- this same key, so n8n never receives two logical jobs for one decision.
  idempotency_key text not null unique,

  -- `mocked` is not a flavour of `delivered`. Nothing was sent.
  status text not null
    check (status in ('pending', 'delivered', 'failed', 'mocked')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  response_code integer,
  external_task_id text,
  -- A code only. Response bodies are written by another system and may carry
  -- anything; storing them would put unreviewed content in our audit trail.
  error_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.automation_runs is
  'Post-review automation delivery attempts. Separate from review_items and review_events on purpose: a failed webhook must never be able to change a human decision.';

create index automation_runs_review_idx
  on public.automation_runs (review_id, created_at desc);

-- RLS on, zero policies: anon/authenticated see nothing. All access goes
-- through server-side code using the secret key.
alter table public.automation_runs enable row level security;
