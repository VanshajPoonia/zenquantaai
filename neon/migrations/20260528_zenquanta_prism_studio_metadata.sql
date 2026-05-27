alter table public.zen_generated_images
  add column if not exists project_id text;

alter table public.zen_generated_images
  add column if not exists is_favorite boolean not null default false;

update public.zen_generated_images as image
set project_id = conversation.project_id
from public.zen_conversations as conversation
where image.conversation_id = conversation.id
  and image.user_id = conversation.user_id
  and image.project_id is null;

create index if not exists zen_generated_images_user_project_created_idx
  on public.zen_generated_images (user_id, project_id, created_at desc);

create index if not exists zen_generated_images_user_favorite_created_idx
  on public.zen_generated_images (user_id, is_favorite, created_at desc);
