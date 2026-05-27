alter table zen_prompt_workflows
  add column if not exists metadata jsonb not null default '{}'::jsonb;
