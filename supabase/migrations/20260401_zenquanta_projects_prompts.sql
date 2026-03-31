create table if not exists public.zen_projects (
  workspace_id text not null,
  id text not null,
  name text not null,
  description text,
  color text not null default 'general',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, id)
);

create index if not exists zen_projects_workspace_updated_idx
  on public.zen_projects (workspace_id, updated_at desc);

create table if not exists public.zen_prompt_library (
  workspace_id text not null,
  id text not null,
  title text not null,
  content text not null,
  mode text not null default 'any',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, id)
);

create index if not exists zen_prompt_library_workspace_updated_idx
  on public.zen_prompt_library (workspace_id, updated_at desc);
