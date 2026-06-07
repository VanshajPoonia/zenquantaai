-- Zenquanta AI post-feature performance indexes.
-- Forward-only additive indexes for common user-scoped lists, admin filters,
-- private object lookups, and existing ILIKE search paths.

create extension if not exists pg_trgm;

create index if not exists zen_conversations_user_project_updated_perf_idx
  on zen_conversations (user_id, project_id, updated_at desc);

create index if not exists zen_conversations_user_assistant_updated_perf_idx
  on zen_conversations (user_id, assistant_family, updated_at desc);

create index if not exists zen_files_user_project_created_perf_idx
  on zen_files (user_id, project_id, created_at desc);

create index if not exists zen_files_user_object_ref_perf_idx
  on zen_files (user_id, bucket, storage_path);

create index if not exists zen_prompt_workflows_user_project_updated_perf_idx
  on zen_prompt_workflows (user_id, project_id, updated_at desc);

create index if not exists zen_prompt_workflow_runs_user_project_created_perf_idx
  on zen_prompt_workflow_runs (user_id, project_id, created_at desc);

create index if not exists zen_model_comparisons_user_project_created_perf_idx
  on zen_model_comparisons (user_id, project_id, created_at desc);

create index if not exists zen_usage_events_subscription_created_perf_idx
  on zen_usage_events (subscription_id, created_at desc);

create index if not exists zen_usage_events_assistant_created_perf_idx
  on zen_usage_events (assistant_family, created_at desc);

create index if not exists zen_image_generation_events_subscription_created_perf_idx
  on zen_image_generation_events (subscription_id, created_at desc);

create index if not exists zen_image_generation_events_model_created_perf_idx
  on zen_image_generation_events (model, created_at desc);

create index if not exists zen_plan_change_requests_status_updated_perf_idx
  on zen_plan_change_requests (status, updated_at desc);

create index if not exists zen_integration_items_user_project_status_imported_perf_idx
  on zen_integration_items (user_id, project_id, status, last_imported_at desc);

-- Trigram indexes accelerate existing leading-wildcard ILIKE search without
-- changing the Neon-backed search architecture.
create index if not exists zen_conversations_title_trgm_idx
  on zen_conversations using gin (title gin_trgm_ops);

create index if not exists zen_conversations_preview_trgm_idx
  on zen_conversations using gin (preview gin_trgm_ops);

create index if not exists zen_messages_content_trgm_idx
  on zen_messages using gin (content gin_trgm_ops);

create index if not exists zen_artifacts_title_trgm_idx
  on zen_artifacts using gin (title gin_trgm_ops);

create index if not exists zen_artifacts_content_trgm_idx
  on zen_artifacts using gin (content gin_trgm_ops);

create index if not exists zen_prompt_library_title_trgm_idx
  on zen_prompt_library using gin (title gin_trgm_ops);

create index if not exists zen_prompt_library_content_trgm_idx
  on zen_prompt_library using gin (content gin_trgm_ops);

create index if not exists zen_files_file_name_trgm_idx
  on zen_files using gin (file_name gin_trgm_ops);

create index if not exists zen_generated_images_prompt_trgm_idx
  on zen_generated_images using gin (prompt gin_trgm_ops);

create index if not exists zen_model_comparisons_prompt_trgm_idx
  on zen_model_comparisons using gin (prompt gin_trgm_ops);

create index if not exists zen_custom_assistants_name_trgm_idx
  on zen_custom_assistants using gin (name gin_trgm_ops);

create index if not exists zen_custom_assistants_system_instructions_trgm_idx
  on zen_custom_assistants using gin (system_instructions gin_trgm_ops);
