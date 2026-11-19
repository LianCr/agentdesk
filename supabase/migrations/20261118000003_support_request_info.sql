-- M9: respond is not the same as waiting.
--
-- REPLY_LOGGED keeps a ticket with support (an acknowledgement while we keep
-- working, e.g. before escalating); INFO_REQUESTED hands the ball to the
-- requester (status waiting_on_requester). Both are a first response.

alter table public.ticket_events drop constraint ticket_events_event_type_check;
alter table public.ticket_events add constraint ticket_events_event_type_check
  check (event_type in ('CREATED', 'TRIAGED', 'DRAFT_APPROVED', 'TAKEN_OVER', 'REPLY_LOGGED', 'INFO_REQUESTED',
                        'REQUESTER_REPLIED', 'ESCALATED', 'ENGINEERING_RETURNED', 'RESOLVED', 'ASSIGNED'));

create or replace function public.apply_ticket_action(
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
           when p_event_type in ('DRAFT_APPROVED', 'REPLY_LOGGED', 'INFO_REQUESTED', 'RESOLVED')
             then coalesce(first_response_at, v_at)
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

revoke all on function public.apply_ticket_action(text, text, text, text, text, text, jsonb, boolean, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_ticket_action(text, text, text, text, text, text, jsonb, boolean, text, timestamptz) to service_role;
