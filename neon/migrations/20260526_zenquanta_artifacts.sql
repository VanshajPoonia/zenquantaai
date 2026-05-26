create table if not exists public.zen_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  project_id text,
  conversation_id text references public.zen_conversations(id) on delete set null,
  source_message_id text references public.zen_messages(id) on delete set null,
  source_type text not null default 'manual',
  title text not null,
  artifact_type text not null default 'document',
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint zen_artifacts_source_type_check
    check (source_type in ('chat_message', 'model_comparison', 'workflow_run', 'manual', 'prism_prompt', 'pulse_report')),
  constraint zen_artifacts_artifact_type_check
    check (artifact_type in ('document', 'code', 'table', 'image_prompt', 'research_report', 'brand_asset', 'checklist', 'workflow_output'))
);

create index if not exists zen_artifacts_user_updated_idx
  on public.zen_artifacts (user_id, updated_at desc);

create index if not exists zen_artifacts_user_project_updated_idx
  on public.zen_artifacts (user_id, project_id, updated_at desc);

create index if not exists zen_artifacts_conversation_idx
  on public.zen_artifacts (conversation_id);

create index if not exists zen_artifacts_source_message_idx
  on public.zen_artifacts (source_message_id);

drop trigger if exists zen_artifacts_touch_updated_at on public.zen_artifacts;
create trigger zen_artifacts_touch_updated_at
before update on public.zen_artifacts
for each row execute function public.zen_touch_updated_at();
