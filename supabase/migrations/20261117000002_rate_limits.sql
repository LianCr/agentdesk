-- Fixed-window rate-limit counters for the endpoints that spend model credit
-- (/api/answer, /api/compare/narrative, /api/transcribe).
--
-- Serverless functions share no memory, so the counter has to live in a
-- shared store; the database the demo already has is that store. One row per
-- (bucket_key, window_start); the RPC increments it atomically with
-- insert ... on conflict do update ... returning, so two concurrent requests
-- can never both read "9" and both write "10".
--
-- bucket_key is "ip:<rule>:<hmac>" or "global:<rule>". It never contains a
-- raw IP address: the application HMACs (rule, ip) with a server-only secret
-- before calling this function.

create table public.rate_limit_counters (
  bucket_key text not null check (char_length(bucket_key) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (bucket_key, window_start)
);

comment on table public.rate_limit_counters is
  'Fixed-window request counters for model-spending API routes. Keys are HMACs, never raw IPs. Rows older than a day are pruned by rate_limit_hit.';

create index rate_limit_counters_window_idx on public.rate_limit_counters (window_start);

-- RLS on, zero policies: anon/authenticated see nothing.
alter table public.rate_limit_counters enable row level security;

create function public.rate_limit_hit(p_key text, p_window_seconds integer, p_limit integer)
returns table (allowed boolean, hit_count integer, reset_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_key is null or p_window_seconds is null or p_window_seconds <= 0
     or p_limit is null or p_limit <= 0 then
    raise exception 'RATE_LIMIT_ARGS_INVALID: key, window and limit are required and positive';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters as c (bucket_key, window_start, hits)
  values (p_key, v_window_start, 1)
  on conflict (bucket_key, window_start) do update set hits = c.hits + 1
  returning c.hits into v_hits;

  -- Housekeeping: older windows of this key are dead, and anything older than
  -- the longest window (one day) is dead for every key.
  delete from public.rate_limit_counters
   where (bucket_key = p_key and window_start < v_window_start)
      or window_start < now() - interval '2 days';

  return query select
    v_hits <= p_limit,
    v_hits,
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

comment on function public.rate_limit_hit(text, integer, integer) is
  'Count one request against a fixed window and say whether it is within the limit.';

-- Server role only. Functions are executable by PUBLIC by default; take that away.
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant select, insert, update, delete on public.rate_limit_counters to service_role;
