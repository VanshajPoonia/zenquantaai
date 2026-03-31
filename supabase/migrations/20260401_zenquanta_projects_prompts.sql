drop table if exists public.zen_messages cascade;
drop table if exists public.zen_conversations cascade;
drop table if exists public.zen_prompt_library cascade;
drop table if exists public.zen_projects cascade;
drop table if exists public.zen_user_settings cascade;

create table public.zen_projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text not null default 'general',
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_projects_user_updated_idx
  on public.zen_projects (user_id, updated_at desc);

create table public.zen_conversations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text references public.zen_projects(id) on delete set null,
  title text not null,
  mode text not null,
  is_pinned boolean not null default false,
  preview text not null default '',
  message_count integer not null default 0,
  session_settings jsonb not null default '{}'::jsonb,
  usage jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_conversations_user_updated_idx
  on public.zen_conversations (user_id, updated_at desc);

create index if not exists zen_conversations_user_project_idx
  on public.zen_conversations (user_id, project_id);

create table public.zen_messages (
  id text primary key,
  conversation_id text not null references public.zen_conversations(id) on delete cascade,
  role text not null,
  content text not null default '',
  mode text not null,
  status text,
  model text,
  provider text,
  error text,
  parent_user_message_id text,
  branch_label text,
  attachments jsonb not null default '[]'::jsonb,
  usage jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_messages_conversation_created_idx
  on public.zen_messages (conversation_id, created_at asc);

create table public.zen_prompt_library (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  mode text not null default 'any',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists zen_prompt_library_user_updated_idx
  on public.zen_prompt_library (user_id, updated_at desc);

create table public.zen_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.zen_projects enable row level security;
alter table public.zen_conversations enable row level security;
alter table public.zen_messages enable row level security;
alter table public.zen_prompt_library enable row level security;
alter table public.zen_user_settings enable row level security;

drop policy if exists "zen_projects_select_own" on public.zen_projects;
drop policy if exists "zen_projects_insert_own" on public.zen_projects;
drop policy if exists "zen_projects_update_own" on public.zen_projects;
drop policy if exists "zen_projects_delete_own" on public.zen_projects;

create policy "zen_projects_select_own"
  on public.zen_projects for select to authenticated
  using (auth.uid() = user_id);

create policy "zen_projects_insert_own"
  on public.zen_projects for insert to authenticated
  with check (auth.uid() = user_id);

create policy "zen_projects_update_own"
  on public.zen_projects for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "zen_projects_delete_own"
  on public.zen_projects for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "zen_conversations_select_own" on public.zen_conversations;
drop policy if exists "zen_conversations_insert_own" on public.zen_conversations;
drop policy if exists "zen_conversations_update_own" on public.zen_conversations;
drop policy if exists "zen_conversations_delete_own" on public.zen_conversations;

create policy "zen_conversations_select_own"
  on public.zen_conversations for select to authenticated
  using (auth.uid() = user_id);

create policy "zen_conversations_insert_own"
  on public.zen_conversations for insert to authenticated
  with check (auth.uid() = user_id);

create policy "zen_conversations_update_own"
  on public.zen_conversations for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "zen_conversations_delete_own"
  on public.zen_conversations for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "zen_messages_select_own" on public.zen_messages;
drop policy if exists "zen_messages_insert_own" on public.zen_messages;
drop policy if exists "zen_messages_update_own" on public.zen_messages;
drop policy if exists "zen_messages_delete_own" on public.zen_messages;

create policy "zen_messages_select_own"
  on public.zen_messages for select to authenticated
  using (
    exists (
      select 1
      from public.zen_conversations conversation
      where conversation.id = zen_messages.conversation_id
        and conversation.user_id = auth.uid()
    )
  );

create policy "zen_messages_insert_own"
  on public.zen_messages for insert to authenticated
  with check (
    exists (
      select 1
      from public.zen_conversations conversation
      where conversation.id = zen_messages.conversation_id
        and conversation.user_id = auth.uid()
    )
  );

create policy "zen_messages_update_own"
  on public.zen_messages for update to authenticated
  using (
    exists (
      select 1
      from public.zen_conversations conversation
      where conversation.id = zen_messages.conversation_id
        and conversation.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.zen_conversations conversation
      where conversation.id = zen_messages.conversation_id
        and conversation.user_id = auth.uid()
    )
  );

create policy "zen_messages_delete_own"
  on public.zen_messages for delete to authenticated
  using (
    exists (
      select 1
      from public.zen_conversations conversation
      where conversation.id = zen_messages.conversation_id
        and conversation.user_id = auth.uid()
    )
  );

drop policy if exists "zen_prompts_select_own" on public.zen_prompt_library;
drop policy if exists "zen_prompts_insert_own" on public.zen_prompt_library;
drop policy if exists "zen_prompts_update_own" on public.zen_prompt_library;
drop policy if exists "zen_prompts_delete_own" on public.zen_prompt_library;

create policy "zen_prompts_select_own"
  on public.zen_prompt_library for select to authenticated
  using (auth.uid() = user_id);

create policy "zen_prompts_insert_own"
  on public.zen_prompt_library for insert to authenticated
  with check (auth.uid() = user_id);

create policy "zen_prompts_update_own"
  on public.zen_prompt_library for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "zen_prompts_delete_own"
  on public.zen_prompt_library for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "zen_settings_select_own" on public.zen_user_settings;
drop policy if exists "zen_settings_insert_own" on public.zen_user_settings;
drop policy if exists "zen_settings_update_own" on public.zen_user_settings;
drop policy if exists "zen_settings_delete_own" on public.zen_user_settings;

create policy "zen_settings_select_own"
  on public.zen_user_settings for select to authenticated
  using (auth.uid() = user_id);

create policy "zen_settings_insert_own"
  on public.zen_user_settings for insert to authenticated
  with check (auth.uid() = user_id);

create policy "zen_settings_update_own"
  on public.zen_user_settings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "zen_settings_delete_own"
  on public.zen_user_settings for delete to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('zen-attachments', 'zen-attachments', false)
on conflict (id) do nothing;

drop policy if exists "zen_attachments_select_own" on storage.objects;
drop policy if exists "zen_attachments_insert_own" on storage.objects;
drop policy if exists "zen_attachments_update_own" on storage.objects;
drop policy if exists "zen_attachments_delete_own" on storage.objects;

create policy "zen_attachments_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'zen-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "zen_attachments_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'zen-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "zen_attachments_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'zen-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'zen-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "zen_attachments_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'zen-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
