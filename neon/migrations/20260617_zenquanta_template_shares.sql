create table if not exists public.zen_template_shares (
  id uuid primary key default gen_random_uuid(),
  template_type text not null,
  template_id text not null,
  user_id uuid not null references public.zen_users(id) on delete cascade,
  token_hash text not null,
  visibility text not null default 'public_link',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint zen_template_shares_template_type_check
    check (template_type in ('prompt', 'playbook')),
  constraint zen_template_shares_visibility_check
    check (visibility in ('public_link', 'private_link'))
);

create unique index if not exists zen_template_shares_token_hash_idx
  on public.zen_template_shares (token_hash);

create index if not exists zen_template_shares_template_idx
  on public.zen_template_shares (template_type, template_id);

create index if not exists zen_template_shares_user_template_idx
  on public.zen_template_shares (user_id, template_type, template_id);
