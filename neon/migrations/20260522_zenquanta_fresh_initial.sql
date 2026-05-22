create extension if not exists pgcrypto;

create table if not exists public.zen_users (
  id uuid primary key default gen_random_uuid(),
  external_auth_provider text,
  external_auth_user_id text,
  login_id text,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (external_auth_provider, external_auth_user_id)
);

create index if not exists zen_users_email_idx
  on public.zen_users (lower(email));

create index if not exists zen_users_login_id_idx
  on public.zen_users (lower(login_id));

create table if not exists public.zen_auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  provider_email text,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_user_id)
);

create index if not exists zen_auth_identities_user_idx
  on public.zen_auth_identities (user_id);

create table if not exists public.zen_profiles (
  user_id uuid primary key references public.zen_users(id) on delete cascade,
  login_id text,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.zen_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.zen_users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'basic', 'pro', 'ultra', 'prime')),
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  activation_source text not null default 'manual' check (activation_source in ('manual', 'admin', 'system')),
  display_multiplier numeric(8,4) not null default 2.0,
  plan_price_usd numeric(10,2) not null default 0,
  core_tokens_included bigint not null default 1000000,
  core_tokens_used bigint not null default 0,
  tier_tokens_included bigint not null default 0,
  tier_tokens_used bigint not null default 0,
  image_credits_included integer not null default 50,
  image_credits_used integer not null default 0,
  daily_message_limit integer not null default 50,
  daily_message_count integer not null default 0,
  max_input_tokens_per_request integer not null default 8000,
  max_output_tokens_per_request integer not null default 800,
  max_images_per_day integer not null default 2,
  daily_image_count integer not null default 0,
  current_period_started_at timestamptz not null default timezone('utc', now()),
  current_period_ends_at timestamptz not null default timezone('utc', now()) + interval '30 days',
  last_daily_reset_at timestamptz not null default timezone('utc', now()),
  activated_by_user_id uuid references public.zen_users(id) on delete set null,
  activated_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.zen_usage_limit_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.zen_users(id) on delete cascade,
  core_tokens_included bigint,
  tier_tokens_included bigint,
  image_credits_included integer,
  daily_message_limit integer,
  max_input_tokens_per_request integer,
  max_output_tokens_per_request integer,
  max_images_per_day integer,
  allowed_model_overrides text[],
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.zen_projects (
  id text not null,
  user_id uuid not null references public.zen_users(id) on delete cascade,
  name text not null,
  description text,
  color text not null default 'general',
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create index if not exists zen_projects_user_updated_idx
  on public.zen_projects (user_id, updated_at desc);

create table if not exists public.zen_conversations (
  id text primary key,
  user_id uuid not null references public.zen_users(id) on delete cascade,
  project_id text,
  title text not null,
  mode text not null check (mode in ('general', 'creative', 'logic', 'code', 'live', 'image')),
  assistant_family text not null default 'nova' check (assistant_family in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')),
  is_pinned boolean not null default false,
  preview text not null default '',
  message_count integer not null default 0,
  session_settings jsonb not null default '{}'::jsonb,
  usage jsonb,
  memory_summary text,
  memory_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_conversations_user_updated_idx
  on public.zen_conversations (user_id, updated_at desc);

create index if not exists zen_conversations_user_project_idx
  on public.zen_conversations (user_id, project_id);

create table if not exists public.zen_messages (
  id text primary key,
  conversation_id text not null references public.zen_conversations(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null default '',
  mode text not null check (mode in ('general', 'creative', 'logic', 'code', 'live', 'image')),
  assistant_family text check (assistant_family in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')),
  status text check (status in ('complete', 'streaming', 'error')),
  model text,
  provider text check (provider is null or provider in ('openrouter')),
  error text,
  parent_user_message_id text,
  branch_label text,
  attachments jsonb not null default '[]'::jsonb,
  usage jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_messages_conversation_created_idx
  on public.zen_messages (conversation_id, created_at asc);

create table if not exists public.zen_prompt_library (
  id text not null,
  user_id uuid not null references public.zen_users(id) on delete cascade,
  title text not null,
  content text not null,
  mode text not null default 'any' check (mode in ('any', 'general', 'creative', 'logic', 'code', 'live', 'image')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create index if not exists zen_prompt_library_user_updated_idx
  on public.zen_prompt_library (user_id, updated_at desc);

create table if not exists public.zen_user_settings (
  user_id uuid primary key references public.zen_users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.zen_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  subscription_id uuid not null references public.zen_subscriptions(id) on delete cascade,
  conversation_id text references public.zen_conversations(id) on delete set null,
  message_id text,
  assistant_family text not null check (assistant_family in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')),
  mode text not null check (mode in ('general', 'creative', 'logic', 'code', 'live', 'image')),
  model text not null,
  wallet_type text not null check (wallet_type in ('core_tokens', 'tier_tokens', 'image_credits')),
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  raw_cost_usd numeric(12,6) not null default 0,
  displayed_cost_usd numeric(12,6) not null default 0,
  display_multiplier numeric(8,4) not null default 1,
  margin_usd numeric(12,6) not null default 0,
  credits_consumed integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_usage_events_user_created_idx
  on public.zen_usage_events (user_id, created_at desc);

create index if not exists zen_usage_events_conversation_idx
  on public.zen_usage_events (conversation_id);

create table if not exists public.zen_image_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  subscription_id uuid not null references public.zen_subscriptions(id) on delete cascade,
  conversation_id text references public.zen_conversations(id) on delete set null,
  message_id text,
  assistant_family text not null default 'prism' check (assistant_family = 'prism'),
  model text not null,
  prompt text not null,
  negative_prompt text,
  size text,
  aspect_ratio text,
  image_count integer not null default 1,
  image_credits_consumed integer not null default 0,
  raw_cost_usd numeric(12,6) not null default 0,
  displayed_cost_usd numeric(12,6) not null default 0,
  display_multiplier numeric(8,4) not null default 1,
  margin_usd numeric(12,6) not null default 0,
  output_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_image_generation_events_user_created_idx
  on public.zen_image_generation_events (user_id, created_at desc);

create table if not exists public.zen_plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  current_tier text not null check (current_tier in ('free', 'basic', 'pro', 'ultra', 'prime')),
  requested_tier text not null check (requested_tier in ('basic', 'pro', 'ultra', 'prime')),
  note text,
  contact text,
  admin_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'activated')),
  approved_by_user_id uuid references public.zen_users(id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_plan_change_requests_user_created_idx
  on public.zen_plan_change_requests (user_id, created_at desc);

create index if not exists zen_plan_change_requests_status_created_idx
  on public.zen_plan_change_requests (status, created_at desc);

create table if not exists public.zen_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.zen_users(id) on delete cascade,
  target_user_id uuid not null references public.zen_users(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_admin_audit_logs_target_created_idx
  on public.zen_admin_audit_logs (target_user_id, created_at desc);

create table if not exists public.zen_assistant_recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  conversation_id text references public.zen_conversations(id) on delete set null,
  current_assistant text not null check (current_assistant in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')),
  recommended_assistant text not null check (recommended_assistant in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')),
  confidence numeric(6,4) not null default 0,
  matched_signals text[] not null default '{}'::text[],
  reason text not null,
  outcome text not null check (outcome in ('shown', 'accepted', 'continued', 'cancelled', 'autoswitched', 'not_shown')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_assistant_recommendation_events_user_created_idx
  on public.zen_assistant_recommendation_events (user_id, created_at desc);

create table if not exists public.zen_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  conversation_id text references public.zen_conversations(id) on delete set null,
  message_id text,
  provider text not null default 'local' check (provider in ('external', 'local')),
  bucket text,
  storage_path text,
  public_url text,
  file_name text not null,
  mime_type text,
  byte_size bigint,
  checksum text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_files_user_created_idx
  on public.zen_files (user_id, created_at desc);

create index if not exists zen_files_conversation_idx
  on public.zen_files (conversation_id);

create table if not exists public.zen_generated_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  conversation_id text references public.zen_conversations(id) on delete set null,
  message_id text,
  image_generation_event_id uuid references public.zen_image_generation_events(id) on delete set null,
  provider text not null default 'openrouter' check (provider in ('openrouter', 'external', 'local')),
  model text not null,
  prompt text not null,
  negative_prompt text,
  storage_provider text check (storage_provider is null or storage_provider in ('external', 'local')),
  storage_bucket text,
  storage_path text,
  source_url text,
  width integer,
  height integer,
  status text not null default 'created' check (status in ('created', 'stored', 'failed', 'deleted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_generated_images_user_created_idx
  on public.zen_generated_images (user_id, created_at desc);

create index if not exists zen_generated_images_conversation_idx
  on public.zen_generated_images (conversation_id);

create or replace function public.zen_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists zen_users_touch_updated_at on public.zen_users;
create trigger zen_users_touch_updated_at
before update on public.zen_users
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_auth_identities_touch_updated_at on public.zen_auth_identities;
create trigger zen_auth_identities_touch_updated_at
before update on public.zen_auth_identities
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_profiles_touch_updated_at on public.zen_profiles;
create trigger zen_profiles_touch_updated_at
before update on public.zen_profiles
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_subscriptions_touch_updated_at on public.zen_subscriptions;
create trigger zen_subscriptions_touch_updated_at
before update on public.zen_subscriptions
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_usage_limit_overrides_touch_updated_at on public.zen_usage_limit_overrides;
create trigger zen_usage_limit_overrides_touch_updated_at
before update on public.zen_usage_limit_overrides
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_projects_touch_updated_at on public.zen_projects;
create trigger zen_projects_touch_updated_at
before update on public.zen_projects
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_conversations_touch_updated_at on public.zen_conversations;
create trigger zen_conversations_touch_updated_at
before update on public.zen_conversations
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_prompt_library_touch_updated_at on public.zen_prompt_library;
create trigger zen_prompt_library_touch_updated_at
before update on public.zen_prompt_library
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_user_settings_touch_updated_at on public.zen_user_settings;
create trigger zen_user_settings_touch_updated_at
before update on public.zen_user_settings
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_plan_change_requests_touch_updated_at on public.zen_plan_change_requests;
create trigger zen_plan_change_requests_touch_updated_at
before update on public.zen_plan_change_requests
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_files_touch_updated_at on public.zen_files;
create trigger zen_files_touch_updated_at
before update on public.zen_files
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_generated_images_touch_updated_at on public.zen_generated_images;
create trigger zen_generated_images_touch_updated_at
before update on public.zen_generated_images
for each row execute function public.zen_touch_updated_at();
