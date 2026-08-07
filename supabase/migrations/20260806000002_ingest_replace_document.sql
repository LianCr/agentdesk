-- M2-B: atomic document replacement contract (called by M2-C ingestion).
-- The whole function runs in one transaction: upsert the document row,
-- delete old pages/chunks, insert the new ones. Concurrent ingestion of the
-- same business document serializes on an advisory lock. Any error rolls
-- everything back, so a document row only ever persists as a completed,
-- internally consistent version.

create or replace function public.ingest_replace_document(
  p_document jsonb,
  p_pages jsonb,
  p_chunks jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_business_id text := p_document ->> 'document_id';
  v_doc_id uuid;
begin
  if v_business_id is null or v_business_id = '' then
    raise exception 'INGEST_INVALID_PAYLOAD: document_id missing';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_business_id));

  insert into documents (
    document_id, document_name, document_type, product_name, product_category,
    carrier_id, carrier_name, jurisdiction, language, effective_date,
    source_file, source_sha256, page_count, is_current, is_fictional,
    ingestion_fingerprint, embedding_provider, embedding_model, embedding_dimensions
  )
  values (
    v_business_id,
    p_document ->> 'document_name',
    p_document ->> 'document_type',
    p_document ->> 'product_name',
    p_document ->> 'product_category',
    p_document ->> 'carrier_id',
    p_document ->> 'carrier_name',
    p_document ->> 'jurisdiction',
    p_document ->> 'language',
    (p_document ->> 'effective_date')::date,
    p_document ->> 'source_file',
    p_document ->> 'source_sha256',
    (p_document ->> 'page_count')::integer,
    (p_document ->> 'is_current')::boolean,
    (p_document ->> 'is_fictional')::boolean,
    p_document ->> 'ingestion_fingerprint',
    p_document ->> 'embedding_provider',
    p_document ->> 'embedding_model',
    (p_document ->> 'embedding_dimensions')::integer
  )
  on conflict (document_id) do update set
    document_name = excluded.document_name,
    document_type = excluded.document_type,
    product_name = excluded.product_name,
    product_category = excluded.product_category,
    carrier_id = excluded.carrier_id,
    carrier_name = excluded.carrier_name,
    jurisdiction = excluded.jurisdiction,
    language = excluded.language,
    effective_date = excluded.effective_date,
    source_file = excluded.source_file,
    source_sha256 = excluded.source_sha256,
    page_count = excluded.page_count,
    is_current = excluded.is_current,
    is_fictional = excluded.is_fictional,
    ingestion_fingerprint = excluded.ingestion_fingerprint,
    embedding_provider = excluded.embedding_provider,
    embedding_model = excluded.embedding_model,
    embedding_dimensions = excluded.embedding_dimensions,
    updated_at = now()
  returning id into v_doc_id;

  delete from document_pages where document_id = v_doc_id;
  delete from chunks where document_id = v_doc_id;

  insert into document_pages (
    document_id, page_number, raw_text, clean_text, clean_text_hash, detected_heading
  )
  select
    v_doc_id,
    (p ->> 'page_number')::integer,
    p ->> 'raw_text',
    p ->> 'clean_text',
    p ->> 'clean_text_hash',
    p ->> 'detected_heading'
  from jsonb_array_elements(p_pages) as p;

  insert into chunks (
    chunk_id, document_id, page_start, page_end, section, chunk_index,
    chunk_type, content, content_hash, embedding, metadata
  )
  select
    c ->> 'chunk_id',
    v_doc_id,
    (c ->> 'page_start')::integer,
    (c ->> 'page_end')::integer,
    c ->> 'section',
    (c ->> 'chunk_index')::integer,
    c ->> 'chunk_type',
    c ->> 'content',
    c ->> 'content_hash',
    (c ->> 'embedding')::extensions.vector,
    coalesce(c -> 'metadata', '{}'::jsonb)
  from jsonb_array_elements(p_chunks) as c;

  return v_doc_id;
end;
$$;

revoke execute on function public.ingest_replace_document(jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- Read-only schema introspection for validation and tests (RLS status,
-- vector extension, embedding dimensions). Server-side callers only.
create or replace function public.schema_diagnostics() returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'rls', (
      select jsonb_object_agg(c.relname, c.relrowsecurity)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    ),
    'vector_extension', exists (select 1 from pg_extension where extname = 'vector'),
    'chunk_embedding_dimensions', (
      select a.atttypmod
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'chunks' and a.attname = 'embedding'
    )
  );
$$;

revoke all on function public.schema_diagnostics() from public, anon, authenticated;
