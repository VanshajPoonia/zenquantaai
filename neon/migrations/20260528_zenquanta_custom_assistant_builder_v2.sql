alter table zen_custom_assistants
  add column if not exists metadata jsonb default '{}'::jsonb;

update zen_custom_assistants
set metadata = '{}'::jsonb
where metadata is null;

alter table zen_custom_assistants
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;
