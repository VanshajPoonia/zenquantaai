create table if not exists public.zen_prompt_workflows (
  id text primary key,
  user_id uuid not null references public.zen_users(id) on delete cascade,
  project_id text,
  title text not null,
  description text,
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_prompt_workflows_user_updated_idx
  on public.zen_prompt_workflows (user_id, updated_at desc);

create index if not exists zen_prompt_workflows_user_project_idx
  on public.zen_prompt_workflows (user_id, project_id);

create table if not exists public.zen_prompt_workflow_steps (
  id text primary key,
  workflow_id text not null references public.zen_prompt_workflows(id) on delete cascade,
  step_order integer not null,
  assistant_family text not null check (assistant_family in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')),
  mode text not null check (mode in ('general', 'creative', 'logic', 'code', 'live', 'image')),
  title text,
  template text not null,
  variable_names jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_prompt_workflow_steps_workflow_idx
  on public.zen_prompt_workflow_steps (workflow_id);

create unique index if not exists zen_prompt_workflow_steps_workflow_order_idx
  on public.zen_prompt_workflow_steps (workflow_id, step_order);

create table if not exists public.zen_prompt_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id text references public.zen_prompt_workflows(id) on delete set null,
  user_id uuid not null references public.zen_users(id) on delete cascade,
  conversation_id text references public.zen_conversations(id) on delete set null,
  project_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'complete', 'failed', 'cancelled')),
  variable_values jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_prompt_workflow_runs_user_created_idx
  on public.zen_prompt_workflow_runs (user_id, created_at desc);

create index if not exists zen_prompt_workflow_runs_workflow_created_idx
  on public.zen_prompt_workflow_runs (workflow_id, created_at desc);

create index if not exists zen_prompt_workflow_runs_conversation_idx
  on public.zen_prompt_workflow_runs (conversation_id);

create table if not exists public.zen_prompt_workflow_step_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.zen_prompt_workflow_runs(id) on delete cascade,
  workflow_step_id text references public.zen_prompt_workflow_steps(id) on delete set null,
  step_order integer not null,
  assistant_family text not null check (assistant_family in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')),
  mode text not null check (mode in ('general', 'creative', 'logic', 'code', 'live', 'image')),
  message_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'complete', 'failed', 'cancelled')),
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_prompt_workflow_step_runs_run_idx
  on public.zen_prompt_workflow_step_runs (run_id);

drop trigger if exists zen_prompt_workflows_touch_updated_at on public.zen_prompt_workflows;
create trigger zen_prompt_workflows_touch_updated_at
before update on public.zen_prompt_workflows
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_prompt_workflow_steps_touch_updated_at on public.zen_prompt_workflow_steps;
create trigger zen_prompt_workflow_steps_touch_updated_at
before update on public.zen_prompt_workflow_steps
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_prompt_workflow_runs_touch_updated_at on public.zen_prompt_workflow_runs;
create trigger zen_prompt_workflow_runs_touch_updated_at
before update on public.zen_prompt_workflow_runs
for each row execute function public.zen_touch_updated_at();

drop trigger if exists zen_prompt_workflow_step_runs_touch_updated_at on public.zen_prompt_workflow_step_runs;
create trigger zen_prompt_workflow_step_runs_touch_updated_at
before update on public.zen_prompt_workflow_step_runs
for each row execute function public.zen_touch_updated_at();
