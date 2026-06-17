create table if not exists public.zen_artifact_shares (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.zen_artifacts(id) on delete cascade,
  user_id uuid not null references public.zen_users(id) on delete cascade,
  token_hash text not null,
  visibility text not null default 'public_link',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint zen_artifact_shares_visibility_check
    check (visibility in ('public_link', 'private_link'))
);

create unique index if not exists zen_artifact_shares_token_hash_idx
  on public.zen_artifact_shares (token_hash);

create index if not exists zen_artifact_shares_artifact_idx
  on public.zen_artifact_shares (artifact_id);

create index if not exists zen_artifact_shares_user_artifact_idx
  on public.zen_artifact_shares (user_id, artifact_id);
