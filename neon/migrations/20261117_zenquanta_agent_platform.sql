-- Agent platform foundation for the 2026-12-01 launch: message parts, agent
-- runs, API tokens, device login, rate limits and per-surface usage.
-- Additive only. See docs/launch/specs/01, 02 and 03.

create extension if not exists pgcrypto;

alter table public.zen_messages
  add column if not exists parts jsonb;

alter table public.zen_conversations
  add column if not exists surface text not null default 'web',
  add column if not exists workspace jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'zen_conversations_surface_check'
  ) then
    alter table public.zen_conversations
      add constraint zen_conversations_surface_check check (surface in ('web', 'cli'));
  end if;
end $$;

alter table public.zen_subscriptions
  add column if not exists daily_agent_step_count integer not null default 0;

create table if not exists public.zen_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  conversation_id text references public.zen_conversations(id) on delete set null,
  surface text not null default 'web' check (surface in ('web', 'cli')),
  client_run_id text,
  client_session_id text,
  step_count integer not null default 0,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'stopped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists zen_agent_runs_user_client_run_idx
  on public.zen_agent_runs (user_id, client_run_id)
  where client_run_id is not null;

create index if not exists zen_agent_runs_user_created_idx
  on public.zen_agent_runs (user_id, created_at desc);

create table if not exists public.zen_api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  prefix text not null,
  scopes text[] not null default array['cli']::text[],
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists zen_api_tokens_user_created_idx
  on public.zen_api_tokens (user_id, created_at desc);

create table if not exists public.zen_device_codes (
  id uuid primary key default gen_random_uuid(),
  device_code_hash text not null unique,
  user_code text not null unique,
  user_id uuid references public.zen_users(id) on delete cascade,
  client_name text not null default 'zq',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'used', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists zen_device_codes_expires_idx
  on public.zen_device_codes (expires_at);

-- Fixed-window counters for device login, the Model API and CLI sync.
create table if not exists public.zen_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  count integer not null default 0
);

alter table public.zen_usage_events
  add column if not exists surface text not null default 'web',
  add column if not exists agent_run_id uuid references public.zen_agent_runs(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'zen_usage_events_surface_check'
  ) then
    alter table public.zen_usage_events
      add constraint zen_usage_events_surface_check check (surface in ('web', 'cli'));
  end if;
end $$;

create index if not exists zen_usage_events_surface_created_idx
  on public.zen_usage_events (surface, created_at desc);
