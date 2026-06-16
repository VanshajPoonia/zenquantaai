-- Zenquanta AI incremental post-feature performance indexes.
-- Forward-only additive indexes for current user-facing lists, admin filters,
-- file-reference cleanup, GitHub import summaries, and existing ILIKE search.

create extension if not exists pg_trgm;

create index if not exists zen_projects_user_default_updated_perf_idx
  on zen_projects (user_id, is_default desc, updated_at desc);

create index if not exists zen_files_user_conversation_created_perf_idx
  on zen_files (user_id, conversation_id, created_at desc);

create index if not exists zen_generated_images_user_project_favorite_created_perf_idx
  on zen_generated_images (user_id, project_id, is_favorite, created_at desc);

create index if not exists zen_usage_events_user_assistant_created_perf_idx
  on zen_usage_events (user_id, assistant_family, created_at desc);

create index if not exists zen_image_generation_events_user_model_created_perf_idx
  on zen_image_generation_events (user_id, model, created_at desc);

create index if not exists zen_plan_change_requests_user_status_created_perf_idx
  on zen_plan_change_requests (user_id, status, created_at desc);

create index if not exists zen_integration_items_user_project_provider_repo_imported_perf_idx
  on zen_integration_items (
    user_id,
    project_id,
    provider,
    status,
    repo_full_name,
    branch,
    last_imported_at desc
  );

create index if not exists zen_messages_attachments_gin_perf_idx
  on zen_messages using gin (attachments);

-- Trigram indexes for existing ILIKE search fields not covered by the first
-- performance pass. JSONB metadata search remains intentionally unindexed.
create index if not exists zen_projects_name_trgm_idx
  on zen_projects using gin (name gin_trgm_ops);

create index if not exists zen_projects_description_trgm_idx
  on zen_projects using gin (description gin_trgm_ops);

create index if not exists zen_conversations_memory_summary_trgm_idx
  on zen_conversations using gin (memory_summary gin_trgm_ops);

create index if not exists zen_prompt_workflows_title_trgm_idx
  on zen_prompt_workflows using gin (title gin_trgm_ops);

create index if not exists zen_prompt_workflows_description_trgm_idx
  on zen_prompt_workflows using gin (description gin_trgm_ops);

create index if not exists zen_prompt_workflow_steps_title_trgm_idx
  on zen_prompt_workflow_steps using gin (title gin_trgm_ops);

create index if not exists zen_prompt_workflow_steps_template_trgm_idx
  on zen_prompt_workflow_steps using gin (template gin_trgm_ops);

create index if not exists zen_generated_images_negative_prompt_trgm_idx
  on zen_generated_images using gin (negative_prompt gin_trgm_ops);

create index if not exists zen_custom_assistants_description_trgm_idx
  on zen_custom_assistants using gin (description gin_trgm_ops);
