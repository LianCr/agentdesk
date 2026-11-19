-- M9: let the synthetic seed script replace its own rows.
--
-- Seed tickets (tkt_seed_*) are backdated relative to the moment they are
-- written, so their SLA states drift as time passes; a demo needs to reseed.
-- Their events are synthetic history, so — like tkt_test_ rows — they may be
-- deleted. Every other ticket's timeline stays append-only: no update, no
-- delete, even with the secret key.

create or replace function public.ticket_events_append_only() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and (old.ticket_id like 'tkt\_test\_%' or old.ticket_id like 'tkt\_seed\_%') then
    return old;
  end if;
  raise exception 'TICKET_EVENTS_APPEND_ONLY: ticket events cannot be %', lower(tg_op);
end;
$$;

revoke all on function public.ticket_events_append_only() from public, anon, authenticated;
