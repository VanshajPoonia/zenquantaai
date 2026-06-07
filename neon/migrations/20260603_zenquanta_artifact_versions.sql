create table if not exists public.zen_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.zen_artifacts(id) on delete cascade,
  user_id uuid not null references public.zen_users(id) on delete cascade,
  title text not null,
  artifact_type text not null default 'document',
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  created_by_action text,
  constraint zen_artifact_versions_artifact_type_check
    check (artifact_type in ('document', 'code', 'table', 'image_prompt', 'research_report', 'brand_asset', 'checklist', 'workflow_output'))
);

create index if not exists zen_artifact_versions_user_artifact_created_idx
  on public.zen_artifact_versions (user_id, artifact_id, created_at desc);

create index if not exists zen_artifact_versions_artifact_created_idx
  on public.zen_artifact_versions (artifact_id, created_at desc);

insert into public.zen_artifact_versions (
  artifact_id,
  user_id,
  title,
  artifact_type,
  content,
  metadata,
  created_at,
  created_by_action
)
select
  artifact.id,
  artifact.user_id,
  artifact.title,
  artifact.artifact_type,
  artifact.content,
  artifact.metadata,
  artifact.created_at,
  null
from public.zen_artifacts artifact
where not exists (
  select 1
  from public.zen_artifact_versions version
  where version.artifact_id = artifact.id
);
