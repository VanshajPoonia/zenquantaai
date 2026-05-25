create table if not exists public.zen_custom_assistants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  name text not null,
  description text not null default '',
  icon_emoji text not null default '✨',
  color text not null default 'general',
  base_mode text not null default 'general',
  system_instructions text not null,
  default_model_override text not null default 'auto',
  default_settings jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zen_custom_assistants_base_mode_check
    check (base_mode in ('general', 'creative', 'logic', 'code', 'live')),
  constraint zen_custom_assistants_default_model_override_check
    check (default_model_override in ('auto', 'gemini', 'claude', 'gpt', 'deepseek', 'qwen'))
);

create index if not exists zen_custom_assistants_user_updated_idx
  on public.zen_custom_assistants(user_id, updated_at);

alter table public.zen_conversations
  add column if not exists custom_assistant_id uuid references public.zen_custom_assistants(id) on delete set null,
  add column if not exists custom_assistant jsonb;

alter table public.zen_messages
  add column if not exists custom_assistant_id uuid references public.zen_custom_assistants(id) on delete set null,
  add column if not exists custom_assistant jsonb;

drop trigger if exists zen_touch_custom_assistants_updated_at on public.zen_custom_assistants;
create trigger zen_touch_custom_assistants_updated_at
before update on public.zen_custom_assistants
for each row execute function public.zen_touch_updated_at();
