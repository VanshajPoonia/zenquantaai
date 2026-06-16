create table if not exists zen_feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references zen_users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  rating text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint zen_feedback_events_entity_type_check check (
    entity_type in (
      'message',
      'model_candidate',
      'artifact_action',
      'playbook_run',
      'image_generation',
      'search_result'
    )
  ),
  constraint zen_feedback_events_rating_check check (
    rating in ('up', 'down', 'neutral')
  )
);

create index if not exists zen_feedback_events_user_entity_created_idx
  on zen_feedback_events (user_id, entity_type, entity_id, created_at desc);

create index if not exists zen_feedback_events_entity_rating_created_idx
  on zen_feedback_events (entity_type, rating, created_at desc);

create index if not exists zen_feedback_events_user_created_idx
  on zen_feedback_events (user_id, created_at desc);
