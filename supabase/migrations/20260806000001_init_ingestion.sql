-- M2-B: ingestion schema for AgentDesk.
-- Four tables only: documents, document_pages, chunks, ingestion_runs.
-- A row in documents represents the currently active COMPLETED version of a
-- document (atomic replacement makes intermediate states invisible there);
-- running/completed/failed/skipped state lives exclusively in ingestion_runs.

create extension if not exists vector with schema extensions;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  document_id text not null unique,
  document_name text not null,
  document_type text not null
    check (document_type in ('product_brochure', 'regulatory_guide')),
  product_name text not null,
  product_category text not null
    check (product_category in ('term_life', 'indexed_universal_life', 'fixed_annuity')),
  carrier_id text not null,
  carrier_name text not null,
  jurisdiction text not null,
  language text not null,
  effective_date date not null,
  source_file text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  page_count integer not null check (page_count > 0),
  is_current boolean not null,
  is_fictional boolean not null,
  ingestion_fingerprint text not null,
  embedding_provider text not null,
  embedding_model text not null,
  embedding_dimensions integer not null check (embedding_dimensions > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.documents is
  'Currently active completed version of each ingested document. No processing state here; see ingestion_runs.';

create table public.document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  page_number integer not null check (page_number > 0),
  raw_text text not null,
  clean_text text not null,
  clean_text_hash text not null check (clean_text_hash ~ '^[a-f0-9]{64}$'),
  detected_heading text,
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  chunk_id text not null unique,
  document_id uuid not null references public.documents (id) on delete cascade,
  page_start integer not null check (page_start > 0),
  page_end integer not null,
  section text not null,
  chunk_index integer not null check (chunk_index >= 0),
  chunk_type text not null check (chunk_type in ('text', 'table', 'disclosure')),
  content text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  constraint chunks_page_range_valid check (page_end >= page_start)
);

create index chunks_document_id_idx on public.chunks (document_id);

-- Ingestion audit history. document_id is the BUSINESS id (text) with no
-- foreign key on purpose: history must survive document deletion.
create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  document_id text not null,
  source_sha256 text check (source_sha256 ~ '^[a-f0-9]{64}$'),
  fingerprint text not null,
  status text not null check (status in ('running', 'completed', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text,
  pages_extracted integer,
  chunks_created integer,
  embedding_provider text,
  embedding_model text,
  embedding_dimensions integer,
  created_at timestamptz not null default now()
);

create index ingestion_runs_document_idx
  on public.ingestion_runs (document_id, started_at desc);

-- RLS on, zero policies: anon/authenticated see nothing. All access goes
-- through server-side scripts using the secret key.
alter table public.documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.chunks enable row level security;
alter table public.ingestion_runs enable row level security;
