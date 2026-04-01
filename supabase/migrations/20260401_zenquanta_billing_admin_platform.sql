create extension if not exists pgcrypto;

create table if not exists public.zen_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.zen_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'basic', 'pro', 'ultra', 'prime')),
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
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
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.zen_usage_limit_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
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

create table if not exists public.zen_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.zen_subscriptions(id) on delete cascade,
  conversation_id text,
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

create table if not exists public.zen_image_generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.zen_subscriptions(id) on delete cascade,
  conversation_id text,
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

create table if not exists public.zen_plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_tier text not null check (current_tier in ('free', 'basic', 'pro', 'ultra', 'prime')),
  requested_tier text not null check (requested_tier in ('basic', 'pro', 'ultra', 'prime')),
  note text,
  contact text,
  admin_note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'activated')),
  approved_at timestamptz,
  rejected_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.zen_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.zen_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

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

drop trigger if exists zen_plan_change_requests_touch_updated_at on public.zen_plan_change_requests;
create trigger zen_plan_change_requests_touch_updated_at
before update on public.zen_plan_change_requests
for each row execute function public.zen_touch_updated_at();

create or replace function public.zen_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.zen_profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.zen_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_login_id text;
  resolved_email text;
begin
  resolved_login_id := nullif(new.raw_user_meta_data ->> 'login_id', '');
  resolved_email := new.email;

  insert into public.zen_profiles (user_id, login_id, email, role)
  values (new.id, resolved_login_id, resolved_email, 'user')
  on conflict (user_id) do update
    set login_id = excluded.login_id,
        email = excluded.email;

  insert into public.zen_subscriptions (
    user_id,
    tier,
    status,
    display_multiplier,
    plan_price_usd,
    core_tokens_included,
    core_tokens_used,
    tier_tokens_included,
    tier_tokens_used,
    image_credits_included,
    image_credits_used,
    daily_message_limit,
    daily_message_count,
    max_input_tokens_per_request,
    max_output_tokens_per_request,
    max_images_per_day,
    daily_image_count,
    current_period_started_at,
    current_period_ends_at,
    last_daily_reset_at
  )
  values (
    new.id,
    'free',
    'active',
    2.0,
    0,
    1000000,
    0,
    0,
    0,
    50,
    0,
    50,
    0,
    8000,
    800,
    2,
    0,
    timezone('utc', now()),
    timezone('utc', now()) + interval '30 days',
    timezone('utc', now())
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists zen_on_auth_user_created on auth.users;
create trigger zen_on_auth_user_created
after insert on auth.users
for each row execute function public.zen_handle_new_auth_user();

alter table public.zen_profiles enable row level security;
alter table public.zen_subscriptions enable row level security;
alter table public.zen_usage_limit_overrides enable row level security;
alter table public.zen_usage_events enable row level security;
alter table public.zen_image_generation_events enable row level security;
alter table public.zen_plan_change_requests enable row level security;
alter table public.zen_admin_audit_logs enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.zen_profiles;
create policy "profiles_select_own_or_admin"
on public.zen_profiles
for select
using (auth.uid() = user_id or public.zen_is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.zen_profiles;
create policy "profiles_update_own_or_admin"
on public.zen_profiles
for update
using (auth.uid() = user_id or public.zen_is_admin())
with check (auth.uid() = user_id or public.zen_is_admin());

drop policy if exists "subscriptions_select_own_or_admin" on public.zen_subscriptions;
create policy "subscriptions_select_own_or_admin"
on public.zen_subscriptions
for select
using (auth.uid() = user_id or public.zen_is_admin());

drop policy if exists "subscriptions_update_admin_only" on public.zen_subscriptions;
create policy "subscriptions_update_admin_only"
on public.zen_subscriptions
for update
using (public.zen_is_admin())
with check (public.zen_is_admin());

drop policy if exists "usage_overrides_select_own_or_admin" on public.zen_usage_limit_overrides;
create policy "usage_overrides_select_own_or_admin"
on public.zen_usage_limit_overrides
for select
using (auth.uid() = user_id or public.zen_is_admin());

drop policy if exists "usage_overrides_admin_manage" on public.zen_usage_limit_overrides;
create policy "usage_overrides_admin_manage"
on public.zen_usage_limit_overrides
for all
using (public.zen_is_admin())
with check (public.zen_is_admin());

drop policy if exists "usage_events_select_own_or_admin" on public.zen_usage_events;
create policy "usage_events_select_own_or_admin"
on public.zen_usage_events
for select
using (auth.uid() = user_id or public.zen_is_admin());

drop policy if exists "image_events_select_own_or_admin" on public.zen_image_generation_events;
create policy "image_events_select_own_or_admin"
on public.zen_image_generation_events
for select
using (auth.uid() = user_id or public.zen_is_admin());

drop policy if exists "plan_requests_select_own_or_admin" on public.zen_plan_change_requests;
create policy "plan_requests_select_own_or_admin"
on public.zen_plan_change_requests
for select
using (auth.uid() = user_id or public.zen_is_admin());

drop policy if exists "plan_requests_insert_own" on public.zen_plan_change_requests;
create policy "plan_requests_insert_own"
on public.zen_plan_change_requests
for insert
with check (auth.uid() = user_id);

drop policy if exists "plan_requests_update_admin_only" on public.zen_plan_change_requests;
create policy "plan_requests_update_admin_only"
on public.zen_plan_change_requests
for update
using (public.zen_is_admin())
with check (public.zen_is_admin());

drop policy if exists "audit_logs_select_admin_only" on public.zen_admin_audit_logs;
create policy "audit_logs_select_admin_only"
on public.zen_admin_audit_logs
for select
using (public.zen_is_admin());

drop policy if exists "audit_logs_insert_admin_only" on public.zen_admin_audit_logs;
create policy "audit_logs_insert_admin_only"
on public.zen_admin_audit_logs
for insert
with check (public.zen_is_admin());
