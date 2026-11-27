-- Web approvals for zq permission prompts (Zenquanta Flow, lane D).
-- zq creates a row per prompt when the user turns on /remote. The web can
-- approve once or deny while it is pending. Rows expire after 10 minutes.
-- Additive only. Keep CLI_APPROVALS off until this has been applied.

create table if not exists public.zen_cli_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.zen_users(id) on delete cascade,
  token_id uuid not null references public.zen_api_tokens(id) on delete cascade,
  session_id text not null,
  tool text not null,
  title text not null check (char_length(title) <= 200),
  detail text not null check (char_length(detail) <= 4000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'expired', 'answered_locally')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create index if not exists zen_cli_approvals_user_status_idx
  on public.zen_cli_approvals (user_id, status, expires_at);
