-- M9: support triage.
--
-- Two tables, the same shape as the review workflow: `support_tickets` holds
-- the current state of a ticket, `ticket_events` is its append-only timeline.
-- The triage result (category, priority, route, retrieved passages, draft) is
-- a creation-time artifact and is frozen by trigger, like a review snapshot:
-- "why did this ticket go where it went" must stay answerable.
--
-- Ids: tkt_<uuid> for app tickets, tkt_seed_* for the synthetic seed script,
-- tkt_test_* for tests (the only rows whose events may be deleted).

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null unique check (ticket_id ~ '^tkt_[a-z0-9_\-]{4,80}$'),
  subject text not null check (char_length(subject) between 3 and 200),
  body text not null check (char_length(body) between 3 and 5000),
  requester text not null check (char_length(requester) between 1 and 120),
  channel text not null check (channel in ('form', 'email', 'api')),

  -- Triage artifact (immutable, see trigger).
  category text not null
    check (category in ('product_question', 'how_to', 'bug_report', 'access', 'privacy_request',
                        'policy_sensitive', 'feature_request', 'other')),
  priority text not null check (priority in ('P1', 'P2', 'P3', 'P4')),
  triage jsonb not null,
  first_response_due_at timestamptz not null,
  resolution_due_at timestamptz not null,
  created_request_id text,
  seed boolean not null default false,

  -- Work progress (people).
  status text not null
    check (status in ('needs_human', 'draft_ready', 'waiting_on_requester', 'escalated', 'resolved')),
  assignee text,
  first_response_at timestamptz,
  resolved_at timestamptz,

  created_at timestamptz not null,
  updated_at timestamptz not null default now(),

  check (first_response_due_at > created_at and resolution_due_at >= first_response_due_at),
  check ((status = 'resolved') = (resolved_at is not null))
);

comment on table public.support_tickets is
  'Support tickets (M9). Triage fields are a frozen creation-time artifact; only status, assignee and the response/resolution timestamps change, and only through apply_ticket_action.';

create index support_tickets_status_idx on public.support_tickets (status, created_at desc);

create table public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  ticket_id text not null,
  event_type text not null
    check (event_type in ('CREATED', 'TRIAGED', 'DRAFT_APPROVED', 'TAKEN_OVER', 'REPLY_LOGGED',
                          'REQUESTER_REPLIED', 'ESCALATED', 'ENGINEERING_RETURNED', 'RESOLVED', 'ASSIGNED')),
  actor text not null check (char_length(actor) between 1 and 120),
  request_id text,
  from_status text,
  to_status text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.ticket_events is
  'Append-only ticket timeline. No update path; delete only for tkt_test_ rows.';

create index ticket_events_ticket_idx on public.ticket_events (ticket_id, occurred_at asc, created_at asc);

create function public.support_tickets_freeze() returns trigger
language plpgsql
as $$
begin
  if new.ticket_id is distinct from old.ticket_id
     or new.subject is distinct from old.subject
     or new.body is distinct from old.body
     or new.requester is distinct from old.requester
     or new.channel is distinct from old.channel
     or new.category is distinct from old.category
     or new.priority is distinct from old.priority
     or new.triage is distinct from old.triage
     or new.first_response_due_at is distinct from old.first_response_due_at
     or new.resolution_due_at is distinct from old.resolution_due_at
     or new.created_request_id is distinct from old.created_request_id
     or new.seed is distinct from old.seed
     or new.created_at is distinct from old.created_at then
    raise exception 'TICKET_ARTIFACT_IMMUTABLE: ticket % triage fields cannot be modified', old.ticket_id;
  end if;
  if old.status = 'resolved' and new.status is distinct from old.status then
    raise exception 'TICKET_ALREADY_RESOLVED: ticket % is resolved', old.ticket_id;
  end if;
  -- A response time is a fact about the past: once recorded it never moves,
  -- so a late first response cannot be "fixed" into a met SLA.
  if old.first_response_at is not null and new.first_response_at is distinct from old.first_response_at then
    raise exception 'TICKET_RESPONSE_IMMUTABLE: ticket % first response already recorded', old.ticket_id;
  end if;
  return new;
end;
$$;

create trigger support_tickets_freeze_trg
  before update on public.support_tickets
  for each row execute function public.support_tickets_freeze();

create function public.ticket_events_append_only() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.ticket_id like 'tkt\_test\_%' then
    return old;
  end if;
  raise exception 'TICKET_EVENTS_APPEND_ONLY: ticket events cannot be %', lower(tg_op);
end;
$$;

create trigger ticket_events_append_only_trg
  before update or delete on public.ticket_events
  for each row execute function public.ticket_events_append_only();

-- Backdated timestamps are allowed only for seed and test tickets, so the
-- demo can show every SLA state. App tickets always use the database clock
-- (within a small skew of the caller's).
create function public.support_ticket_clock(p_ticket_id text, p_requested timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
begin
  if p_requested is null then
    return now();
  end if;
  if p_ticket_id like 'tkt\_seed\_%' or p_ticket_id like 'tkt\_test\_%' then
    return p_requested;
  end if;
  if abs(extract(epoch from (p_requested - now()))) > 300 then
    raise exception 'TICKET_CLOCK_SKEW: only seed and test tickets may be backdated';
  end if;
  return p_requested;
end;
$$;

/*
 * Create = ticket row + CREATED + TRIAGED, atomically. Triage itself runs in
 * application code (deterministic, lib/support/triage.ts); the database
 * stores its result and refuses to let it change.
 */
create function public.create_support_ticket(
  p_ticket_id text,
  p_subject text,
  p_body text,
  p_requester text,
  p_channel text,
  p_category text,
  p_priority text,
  p_status text,
  p_triage jsonb,
  p_first_response_due_at timestamptz,
  p_resolution_due_at timestamptz,
  p_created_request_id text,
  p_seed boolean,
  p_created_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_at timestamptz;
begin
  if p_status not in ('needs_human', 'draft_ready') then
    raise exception 'TICKET_INVALID_PAYLOAD: a new ticket starts in needs_human or draft_ready';
  end if;
  if p_seed and p_ticket_id not like 'tkt\_seed\_%' then
    raise exception 'TICKET_INVALID_PAYLOAD: seed tickets use the tkt_seed_ prefix';
  end if;
  v_at := public.support_ticket_clock(p_ticket_id, p_created_at);

  insert into support_tickets (ticket_id, subject, body, requester, channel, category, priority, triage,
                               first_response_due_at, resolution_due_at, created_request_id, seed,
                               status, created_at, updated_at)
  values (p_ticket_id, p_subject, p_body, p_requester, p_channel, p_category, p_priority, p_triage,
          p_first_response_due_at, p_resolution_due_at, p_created_request_id, coalesce(p_seed, false),
          p_status, v_at, v_at);

  insert into ticket_events (event_id, ticket_id, event_type, actor, request_id, from_status, to_status, payload, occurred_at)
  values
    ('evt_' || gen_random_uuid(), p_ticket_id, 'CREATED', p_requester, p_created_request_id, null, null,
     jsonb_build_object('channel', p_channel), v_at),
    ('evt_' || gen_random_uuid(), p_ticket_id, 'TRIAGED', 'triage-rules', p_created_request_id, null, p_status,
     jsonb_build_object('category', p_category, 'priority', p_priority,
                        'route', p_triage->>'route', 'rulesVersion', p_triage->'rulesVersion'),
     v_at + interval '1 millisecond');

  return jsonb_build_object('action', 'created', 'ticket_id', p_ticket_id, 'status', p_status);
end;
$$;

/*
 * One action = one compare-and-set on status + exactly one event, in one
 * transaction (the decide_review_item idiom). Which moves are legal is
 * decided by lib/support/state-machine.ts; this function guarantees a stale
 * caller changes nothing.
 */
create function public.apply_ticket_action(
  p_ticket_id text,
  p_expected_status text,
  p_new_status text,
  p_event_type text,
  p_actor text,
  p_request_id text,
  p_payload jsonb,
  p_set_assignee boolean,
  p_assignee text,
  p_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current text;
  v_at timestamptz;
begin
  if p_actor is null or p_actor = '' then
    raise exception 'TICKET_INVALID_PAYLOAD: actor missing';
  end if;

  perform pg_advisory_xact_lock(hashtext('ticket:' || p_ticket_id));

  select status into v_current from support_tickets where ticket_id = p_ticket_id;
  if not found then
    raise exception 'TICKET_NOT_FOUND: %', p_ticket_id;
  end if;
  if v_current is distinct from p_expected_status then
    return jsonb_build_object('action', 'conflict', 'status', v_current);
  end if;

  v_at := public.support_ticket_clock(p_ticket_id, p_at);

  update support_tickets
     set status = p_new_status,
         assignee = case when p_set_assignee then p_assignee else assignee end,
         first_response_at = case
           when p_event_type in ('DRAFT_APPROVED', 'REPLY_LOGGED', 'RESOLVED') then coalesce(first_response_at, v_at)
           else first_response_at end,
         resolved_at = case when p_new_status = 'resolved' then v_at else resolved_at end,
         updated_at = now()
   where ticket_id = p_ticket_id;

  insert into ticket_events (event_id, ticket_id, event_type, actor, request_id, from_status, to_status, payload, occurred_at)
  values ('evt_' || gen_random_uuid(), p_ticket_id, p_event_type, p_actor, p_request_id, v_current, p_new_status,
          coalesce(p_payload, '{}'::jsonb), v_at);

  return jsonb_build_object('action', 'applied', 'status', p_new_status);
end;
$$;

-- RLS on, zero policies: anon/authenticated see nothing. Server-side code
-- uses the secret key (service_role). Grants are explicit because newer
-- Supabase stacks no longer auto-grant new objects (see 20261117000001).
alter table public.support_tickets enable row level security;
alter table public.ticket_events enable row level security;

revoke all on function public.create_support_ticket(text, text, text, text, text, text, text, text, jsonb, timestamptz, timestamptz, text, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_ticket_action(text, text, text, text, text, text, jsonb, boolean, text, timestamptz) from public, anon, authenticated;
revoke all on function public.support_ticket_clock(text, timestamptz) from public, anon, authenticated;
revoke all on function public.support_tickets_freeze() from public, anon, authenticated;
revoke all on function public.ticket_events_append_only() from public, anon, authenticated;

grant select, insert, update, delete on public.support_tickets to service_role;
grant select, insert, update, delete on public.ticket_events to service_role;
grant execute on function public.create_support_ticket(text, text, text, text, text, text, text, text, jsonb, timestamptz, timestamptz, text, boolean, timestamptz) to service_role;
grant execute on function public.apply_ticket_action(text, text, text, text, text, text, jsonb, boolean, text, timestamptz) to service_role;
grant execute on function public.support_ticket_clock(text, timestamptz) to service_role;
