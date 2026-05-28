create table if not exists zen_integration_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zen_users(id) on delete cascade,
  provider text not null,
  external_account_id text not null,
  external_account_login text,
  external_account_name text,
  installation_id text,
  scopes text[] not null default '{}',
  status text not null default 'connected',
  encrypted_token_payload jsonb,
  sync_state jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zen_integration_accounts_provider_check
    check (provider in ('github')),
  constraint zen_integration_accounts_status_check
    check (status in ('connected', 'revoked', 'error'))
);

create unique index if not exists zen_integration_accounts_user_provider_idx
  on zen_integration_accounts(user_id, provider);

create index if not exists zen_integration_accounts_user_status_idx
  on zen_integration_accounts(user_id, status);

create table if not exists zen_integration_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zen_users(id) on delete cascade,
  account_id uuid references zen_integration_accounts(id) on delete cascade,
  provider text not null,
  external_id text not null,
  project_id text,
  file_id uuid references zen_files(id) on delete set null,
  title text not null,
  item_type text not null default 'file',
  source_url text,
  repo_full_name text,
  branch text,
  path text,
  sha text,
  content_hash text,
  byte_size bigint,
  mime_type text,
  status text not null default 'available',
  last_seen_at timestamptz,
  last_imported_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zen_integration_items_provider_check
    check (provider in ('github')),
  constraint zen_integration_items_status_check
    check (status in ('available', 'imported', 'skipped', 'failed'))
);

create unique index if not exists zen_integration_items_user_provider_external_project_idx
  on zen_integration_items(user_id, provider, external_id, project_id);

create index if not exists zen_integration_items_user_project_idx
  on zen_integration_items(user_id, project_id);

create index if not exists zen_integration_items_account_idx
  on zen_integration_items(account_id);

create index if not exists zen_integration_items_file_idx
  on zen_integration_items(file_id);

drop trigger if exists zen_integration_accounts_touch_updated_at
  on zen_integration_accounts;
create trigger zen_integration_accounts_touch_updated_at
before update on zen_integration_accounts
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_integration_items_touch_updated_at
  on zen_integration_items;
create trigger zen_integration_items_touch_updated_at
before update on zen_integration_items
for each row execute function public.zen_touch_updated_at();
