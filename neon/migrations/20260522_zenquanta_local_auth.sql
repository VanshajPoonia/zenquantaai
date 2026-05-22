create table if not exists public.zen_auth_credentials (
  user_id uuid primary key references public.zen_users(id) on delete cascade,
  login_id text not null unique,
  password_hash text not null,
  password_salt text not null,
  password_params jsonb not null default '{}'::jsonb,
  password_updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_auth_credentials_login_id_idx
  on public.zen_auth_credentials (login_id);

create table if not exists public.zen_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_auth_sessions_user_idx
  on public.zen_auth_sessions (user_id);

create index if not exists zen_auth_sessions_token_hash_idx
  on public.zen_auth_sessions (token_hash);

create index if not exists zen_auth_sessions_expires_idx
  on public.zen_auth_sessions (expires_at);

drop trigger if exists zen_auth_credentials_touch_updated_at on public.zen_auth_credentials;
create trigger zen_auth_credentials_touch_updated_at
before update on public.zen_auth_credentials
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_auth_sessions_touch_updated_at on public.zen_auth_sessions;
create trigger zen_auth_sessions_touch_updated_at
before update on public.zen_auth_sessions
for each row execute function public.zen_touch_updated_at();
