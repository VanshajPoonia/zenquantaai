-- Context Engine Phase 3 (MEMORY_EXTRACTION): durable, cross-chat memory items.
-- A cheap model extracts 0..N durable facts after a turn; each is deduped and
-- superseded by a canonical key so corrections win. Raw messages remain the
-- source of truth (see AI_CONTEXT_ENGINE.md §2, §5); this table is additive and
-- safe to drop. Run before enabling MEMORY_EXTRACTION.

create extension if not exists vector;

create table if not exists public.zen_memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  project_id text,
  source_conversation_id text references public.zen_conversations(id) on delete set null,
  kind text not null,
  canonical_key text not null,
  content text not null,
  content_json jsonb,
  mode text,
  importance integer not null default 2,
  confidence numeric(4, 3) not null default 0.7,
  status text not null default 'active',
  supersedes_id uuid references public.zen_memory_items(id) on delete set null,
  embedding vector(1536),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_confirmed_at timestamptz not null default timezone('utc', now()),
  valid_until timestamptz,
  constraint zen_memory_items_kind_check check (
    kind in (
      'identity',
      'preference',
      'constraint',
      'decision',
      'fact',
      'open_loop',
      'project_status'
    )
  ),
  constraint zen_memory_items_status_check check (
    status in ('active', 'superseded', 'expired')
  )
);

create index if not exists zen_memory_items_user_status_idx
  on public.zen_memory_items (user_id, status);

create index if not exists zen_memory_items_user_project_status_idx
  on public.zen_memory_items (user_id, project_id, status);

create index if not exists zen_memory_items_user_canonical_idx
  on public.zen_memory_items (user_id, canonical_key);

create index if not exists zen_memory_items_source_conversation_idx
  on public.zen_memory_items (source_conversation_id);

create index if not exists zen_memory_items_embedding_hnsw_idx
  on public.zen_memory_items using hnsw (embedding vector_cosine_ops);
