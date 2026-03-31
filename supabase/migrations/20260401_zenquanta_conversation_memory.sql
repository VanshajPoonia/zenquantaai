alter table public.zen_conversations
  add column if not exists memory_summary text,
  add column if not exists memory_updated_at timestamptz;
