alter table public.zen_messages
  add column if not exists sources jsonb not null default '[]'::jsonb;
