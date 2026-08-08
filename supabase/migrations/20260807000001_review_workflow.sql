-- M5-A: human review workflow.
--
-- Two tables only. `review_items` holds the current state of a review; the
-- artifact fields captured at creation (snapshot, its hash, the routing basis)
-- are never rewritten afterwards, which is what makes the audit trail mean
-- something. `review_events` is append-only history.
--
-- Naming note: `reviews` / `audit_log` are forbidden table names in this
-- project (tests/database/schema.test.ts asserts they are absent), so the
-- tables are `review_items` and `review_events`.

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  review_id text not null unique,
  source_type text not null check (source_type in ('comparison_draft')),
  -- Stable business key for the reviewed thing (product pair + optional case).
  -- Deliberately NOT globally unique: a source may be reviewed again after an
  -- earlier review reached a terminal state.
  source_key text not null,

  -- Creation-time artifact. Immutable: see the trigger below.
  snapshot jsonb not null,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  workflow_decision text not null
    check (workflow_decision in ('allow_internal_draft', 'allow_checklist_only', 'block_client_draft')),
  required_approval_level text not null
    check (required_approval_level in ('not_required_for_internal_view', 'standard_approval',
                                       'enhanced_review', 'licensed_agent_required', 'blocked')),
  review_reasons jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,

  -- Human workflow progress. Distinct from workflow_decision and from
  -- required_approval_level: those say how far this may travel and how much
  -- authority it needs; this says how far the work has actually got.
  review_state text not null default 'pending_review'
    check (review_state in ('pending_review', 'approved', 'rejected', 'revision_requested')),
  reviewer text,
  decision_note text,
  revision_instructions text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.review_items is
  'Human review of a generated draft. snapshot/snapshot_sha256 and the routing basis are creation-time artifacts and immutable; only the decision fields change.';

create index review_items_state_idx on public.review_items (review_state, created_at desc);

-- At most one OPEN review per source at a time. Partial index, so terminal
-- rows never block a future review of the same source.
create unique index review_items_open_source_idx
  on public.review_items (source_key)
  where review_state = 'pending_review';

-- Append-only history. review_id is the BUSINESS text id with no foreign key,
-- for the same reason ingestion_runs works this way: history must survive the
-- removal of the thing it describes.
create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  review_id text not null,
  event_type text not null
    check (event_type in ('REVIEW_CREATED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED')),
  actor text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.review_events is
  'Append-only review history. No application update or delete path; a decision appends, it never rewrites.';

create index review_events_review_idx on public.review_events (review_id, occurred_at asc);

-- A database invariant rather than developer discipline: the reviewed artifact
-- cannot change after the review exists. If it could, "what was actually
-- reviewed" would be unanswerable the moment product data moved on.
create function public.review_items_freeze_artifact() returns trigger
language plpgsql
as $$
begin
  if new.snapshot is distinct from old.snapshot
     or new.snapshot_sha256 is distinct from old.snapshot_sha256
     or new.source_type is distinct from old.source_type
     or new.source_key is distinct from old.source_key
     or new.workflow_decision is distinct from old.workflow_decision
     or new.required_approval_level is distinct from old.required_approval_level
     or new.review_reasons is distinct from old.review_reasons
     or new.checklist is distinct from old.checklist
     or new.created_at is distinct from old.created_at then
    raise exception 'REVIEW_ARTIFACT_IMMUTABLE: review % artifact fields cannot be modified', old.review_id;
  end if;
  return new;
end;
$$;

create trigger review_items_freeze_artifact_trg
  before update on public.review_items
  for each row execute function public.review_items_freeze_artifact();

-- Review history is written once. Blocking updates and deletes here is what
-- makes "the audit trail is append-only" a property of the database rather
-- than a claim in a comment.
--
-- The single exception is deleting explicitly test-prefixed rows, so the
-- integration suite can clean up after itself. A production review's history
-- cannot be removed even by a caller holding the secret key — which is the
-- point of putting the rule here instead of in TypeScript.
create function public.review_events_append_only() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.review_id like 'rev\_test\_%' then
    return old;
  end if;
  raise exception 'REVIEW_EVENTS_APPEND_ONLY: review events cannot be %', lower(tg_op);
end;
$$;

create trigger review_events_append_only_trg
  before update or delete on public.review_events
  for each row execute function public.review_events_append_only();

/*
 * One decision = one state change + exactly one audit event, atomically.
 *
 * Follows the ingest_replace_document idiom: a transaction-scoped advisory
 * lock serializes callers for the same review, then the expected state is
 * rechecked INSIDE the transaction. A caller whose expected state is stale
 * (a colleague decided first, or the same button was clicked twice) gets
 * 'conflict' back and changes nothing — so two tabs can never produce both an
 * approval and a rejection, and a double submit cannot append two terminal
 * events.
 */
create function public.decide_review_item(
  p_review_id text,
  p_expected_state text,
  p_new_state text,
  p_event_type text,
  p_event_id text,
  p_actor text,
  p_decision_note text,
  p_revision_instructions text,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current text;
begin
  if p_review_id is null or p_review_id = '' then
    raise exception 'REVIEW_INVALID_PAYLOAD: review_id missing';
  end if;
  if p_actor is null or p_actor = '' then
    raise exception 'REVIEW_INVALID_PAYLOAD: actor missing';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_review_id));

  select review_state into v_current from review_items where review_id = p_review_id;
  if not found then
    raise exception 'REVIEW_NOT_FOUND: %', p_review_id;
  end if;

  -- Compare-and-set. Anything other than the state the caller read is a
  -- conflict, reported rather than silently overwritten.
  if v_current is distinct from p_expected_state then
    return jsonb_build_object('action', 'conflict', 'review_state', v_current);
  end if;

  update review_items
     set review_state = p_new_state,
         reviewer = p_actor,
         decision_note = coalesce(p_decision_note, decision_note),
         revision_instructions = coalesce(p_revision_instructions, revision_instructions),
         updated_at = now()
   where review_id = p_review_id;

  insert into review_events (event_id, review_id, event_type, actor, payload)
  values (p_event_id, p_review_id, p_event_type, p_actor, coalesce(p_payload, '{}'::jsonb));

  return jsonb_build_object('action', 'decided', 'review_state', p_new_state);
end;
$$;

-- RLS on, zero policies: anon/authenticated see nothing. All access goes
-- through server-side code using the secret key.
alter table public.review_items enable row level security;
alter table public.review_events enable row level security;

revoke execute on function public.decide_review_item(text, text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.review_items_freeze_artifact() from public, anon, authenticated;
revoke execute on function public.review_events_append_only() from public, anon, authenticated;
