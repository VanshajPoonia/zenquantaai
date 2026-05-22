create extension if not exists vector;

alter table public.zen_files
  add column if not exists project_id text;

create index if not exists zen_files_user_project_idx
  on public.zen_files (user_id, project_id);

create table if not exists public.zen_file_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  project_id text,
  conversation_id text references public.zen_conversations(id) on delete set null,
  message_id text,
  file_id uuid not null references public.zen_files(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  content_hash text not null,
  token_count_estimate integer not null default 0,
  embedding_model text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (file_id, chunk_index)
);

create index if not exists zen_file_chunks_user_created_idx
  on public.zen_file_chunks (user_id, created_at desc);

create index if not exists zen_file_chunks_user_project_idx
  on public.zen_file_chunks (user_id, project_id);

create index if not exists zen_file_chunks_conversation_idx
  on public.zen_file_chunks (conversation_id);

create index if not exists zen_file_chunks_file_idx
  on public.zen_file_chunks (file_id);

create index if not exists zen_file_chunks_embedding_hnsw_idx
  on public.zen_file_chunks using hnsw (embedding vector_cosine_ops);
