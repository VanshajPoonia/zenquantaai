create table if not exists public.zen_auth_attempts (
  scope text not null,
  subject_hash text not null,
  failed_count integer not null default 0,
  first_failed_at timestamptz not null default timezone('utc', now()),
  last_failed_at timestamptz not null default timezone('utc', now()),
  locked_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (scope, subject_hash),
  constraint zen_auth_attempts_scope_check check (scope in ('login_id', 'ip'))
);

create index if not exists zen_auth_attempts_locked_until_idx
  on public.zen_auth_attempts (locked_until);

drop trigger if exists zen_auth_attempts_touch_updated_at on public.zen_auth_attempts;
create trigger zen_auth_attempts_touch_updated_at
before update on public.zen_auth_attempts
for each row execute function public.zen_touch_updated_at();
