-- Read-only share links for chats (Zenquanta Flow, docs/flow/PLAN.md Lane B).
-- Each row holds a redacted snapshot built on the server when the link is made,
-- so later messages stay private. Additive only.

create table if not exists public.zen_conversation_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  user_id uuid not null references public.zen_users(id) on delete cascade,
  conversation_id text not null references public.zen_conversations(id) on delete cascade,
  title text not null,
  snapshot jsonb not null,
  message_count integer not null default 0,
  redaction_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create unique index if not exists zen_conversation_shares_token_idx
  on public.zen_conversation_shares (token);

create index if not exists zen_conversation_shares_user_conversation_idx
  on public.zen_conversation_shares (user_id, conversation_id, created_at desc);

create index if not exists zen_conversation_shares_conversation_idx
  on public.zen_conversation_shares (conversation_id);
