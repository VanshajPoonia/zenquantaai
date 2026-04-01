create table if not exists public.zen_assistant_recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text,
  current_assistant text not null check (current_assistant in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')),
  recommended_assistant text not null check (recommended_assistant in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')),
  confidence numeric(6,4) not null default 0,
  matched_signals text[] not null default '{}'::text[],
  reason text not null,
  outcome text not null check (outcome in ('shown', 'accepted', 'continued', 'cancelled', 'autoswitched', 'not_shown')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.zen_assistant_recommendation_events enable row level security;

drop policy if exists "assistant_recommendation_events_select_own_or_admin" on public.zen_assistant_recommendation_events;
create policy "assistant_recommendation_events_select_own_or_admin"
on public.zen_assistant_recommendation_events
for select
using (auth.uid() = user_id or public.zen_is_admin());

drop policy if exists "assistant_recommendation_events_insert_own_or_admin" on public.zen_assistant_recommendation_events;
create policy "assistant_recommendation_events_insert_own_or_admin"
on public.zen_assistant_recommendation_events
for insert
with check (auth.uid() = user_id or public.zen_is_admin());
