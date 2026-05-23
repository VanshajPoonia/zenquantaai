create table if not exists public.zen_model_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  conversation_id text not null references public.zen_conversations(id) on delete cascade,
  prompt_message_id text not null,
  project_id text,
  prompt text not null,
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  selected_candidate_id uuid,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_model_comparisons_user_created_idx
  on public.zen_model_comparisons (user_id, created_at desc);

create index if not exists zen_model_comparisons_conversation_idx
  on public.zen_model_comparisons (conversation_id);

create table if not exists public.zen_model_comparison_candidates (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null references public.zen_model_comparisons(id) on delete cascade,
  mode text not null check (mode in ('general', 'creative', 'logic', 'code', 'live')),
  assistant_family text not null check (assistant_family in ('nova', 'velora', 'axiom', 'forge', 'pulse')),
  model text not null,
  label text not null,
  content text not null default '',
  status text not null default 'complete' check (status in ('complete', 'error')),
  error text,
  latency_ms integer,
  usage jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_model_comparison_candidates_comparison_idx
  on public.zen_model_comparison_candidates (comparison_id);

drop trigger if exists zen_model_comparisons_touch_updated_at on public.zen_model_comparisons;
create trigger zen_model_comparisons_touch_updated_at
before update on public.zen_model_comparisons
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_model_comparison_candidates_touch_updated_at on public.zen_model_comparison_candidates;
create trigger zen_model_comparison_candidates_touch_updated_at
before update on public.zen_model_comparison_candidates
for each row execute function public.zen_touch_updated_at();
