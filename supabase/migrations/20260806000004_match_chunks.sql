-- M3-A: exact cosine similarity search over chunks with typed metadata
-- filters. 45 chunks -> exact scan, no ANN index. security invoker: the
-- server secret key is the only execution path (RLS stays deny-all for
-- anon/authenticated, and execute is revoked below). Filters are typed
-- array parameters — never string-interpolated.

create function public.match_chunks(
  query_embedding extensions.vector(1536),
  match_count int,
  filter_document_ids text[] default null,
  filter_categories text[] default null,
  filter_carrier_ids text[] default null
) returns table (
  chunk_id text,
  document_id text,
  document_name text,
  product_name text,
  product_category text,
  carrier_name text,
  page_start int,
  page_end int,
  section text,
  chunk_type text,
  content text,
  content_hash text,
  similarity double precision
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  if match_count < 1 or match_count > 20 then
    raise exception 'MATCH_COUNT_OUT_OF_RANGE: % (allowed 1..20)', match_count;
  end if;

  return query
  select
    c.chunk_id,
    d.document_id,
    d.document_name,
    d.product_name,
    d.product_category,
    d.carrier_name,
    c.page_start,
    c.page_end,
    c.section,
    c.chunk_type,
    c.content,
    c.content_hash,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where d.is_current
    and d.document_id not like 'test\_%'
    and d.embedding_provider <> 'fake-deterministic'
    and (filter_document_ids is null or d.document_id = any (filter_document_ids))
    and (filter_categories is null or d.product_category = any (filter_categories))
    and (filter_carrier_ids is null or d.carrier_id = any (filter_carrier_ids))
  order by c.embedding <=> query_embedding asc, c.chunk_id asc
  limit match_count;
end;
$$;

revoke execute on function public.match_chunks(
  extensions.vector, int, text[], text[], text[]
) from public, anon, authenticated;
