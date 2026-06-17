# Per-User Cleanup SQL Fallback

This guide is for beta support only. Prefer the self-serve deletion routes first:

- User workspace/full-account deletion: `/api/account/delete-data/preview` and `/api/account/delete-data`
- Admin target-user purge: `/api/admin/users/[id]/purge/preview` and `/api/admin/users/[id]/purge`

Use this SQL only when the app flow fails, cannot be used, or needs manual follow-up after a partial object-storage cleanup failure.

## Safety Rules

- Run this only against the intended Neon environment. Confirm the project, branch, and database before every query.
- Take a Neon snapshot or branch backup first.
- Verify the target user by `zen_users.id`, login ID, email, and display name before deletion.
- Never paste real secrets, connection strings, tokens, object keys, or private URLs into this document, tickets, screenshots, or public logs.
- Export object references before deleting database rows. Object storage cleanup is separate unless the app purge flow completed it.
- Do not hard-delete `zen_users` for full-account cleanup. Tombstone it so admin audit logs keep valid references.
- Do not target `zen_auth_attempts`; it has no user foreign key and stores hashed subjects only.

## 1. Set The Target

Use `psql` variables so every later query uses the same target. Replace the placeholders locally; do not commit real values.

```sql
\set target_user_id '00000000-0000-0000-0000-000000000000'
\set target_login 'example-login-id'
```

## 2. Identify The User

Run at least one lookup by ID and one lookup by login/email/display name. Stop if more than one plausible user appears.

```sql
select
  u.id,
  coalesce(p.login_id, u.login_id) as login_id,
  coalesce(p.email, u.email) as email,
  coalesce(p.display_name, u.display_name) as display_name,
  coalesce(p.role, u.role) as role,
  u.created_at,
  u.updated_at
from public.zen_users u
left join public.zen_profiles p on p.user_id = u.id
where u.id = :'target_user_id';

select
  u.id,
  coalesce(p.login_id, u.login_id) as login_id,
  coalesce(p.email, u.email) as email,
  coalesce(p.display_name, u.display_name) as display_name,
  coalesce(p.role, u.role) as role
from public.zen_users u
left join public.zen_profiles p on p.user_id = u.id
where coalesce(p.login_id, u.login_id) = :'target_login'
   or coalesce(p.email, u.email) = :'target_login'
   or coalesce(p.display_name, u.display_name) = :'target_login'
order by u.created_at desc;
```

## 3. Export Object References First

These rows are needed for private object storage cleanup after DB access is revoked. Save them in a secure operator-only place, not in user-facing support notes.

```sql
select 'file' as object_type, id, bucket, storage_path
from public.zen_files
where user_id = :'target_user_id'
  and bucket is not null
  and storage_path is not null
order by created_at;

select 'generated_image' as object_type, id, storage_bucket as bucket, storage_path
from public.zen_generated_images
where user_id = :'target_user_id'
  and storage_bucket is not null
  and storage_path is not null
order by created_at;
```

If using `psql`, export to a secure local file outside the repo:

```sql
\copy (
  select 'file' as object_type, id::text, bucket, storage_path
  from public.zen_files
  where user_id = :'target_user_id'
    and bucket is not null
    and storage_path is not null
  union all
  select 'generated_image', id::text, storage_bucket, storage_path
  from public.zen_generated_images
  where user_id = :'target_user_id'
    and storage_bucket is not null
    and storage_path is not null
) to '/tmp/zenquanta-user-object-refs.csv' with csv header;
```

## 4. Dry-Run Counts

Run this before any destructive SQL. It covers current user-owned tables in the 19-migration Neon schema plus related cascade children and admin audit references.

```sql
with target as (
  select :'target_user_id'::uuid as user_id
),
target_conversations as (
  select id from public.zen_conversations where user_id = (select user_id from target)
),
target_workflows as (
  select id from public.zen_prompt_workflows where user_id = (select user_id from target)
),
target_workflow_runs as (
  select id from public.zen_prompt_workflow_runs where user_id = (select user_id from target)
),
target_model_comparisons as (
  select id from public.zen_model_comparisons where user_id = (select user_id from target)
),
target_files as (
  select id from public.zen_files where user_id = (select user_id from target)
),
target_artifacts as (
  select id from public.zen_artifacts where user_id = (select user_id from target)
)
select *
from (
  values
    ('zen_users', (select count(*) from public.zen_users where id = (select user_id from target))),
    ('zen_profiles', (select count(*) from public.zen_profiles where user_id = (select user_id from target))),
    ('zen_auth_identities', (select count(*) from public.zen_auth_identities where user_id = (select user_id from target))),
    ('zen_auth_credentials', (select count(*) from public.zen_auth_credentials where user_id = (select user_id from target))),
    ('zen_auth_sessions', (select count(*) from public.zen_auth_sessions where user_id = (select user_id from target))),
    ('zen_subscriptions', (select count(*) from public.zen_subscriptions where user_id = (select user_id from target))),
    ('zen_subscriptions_activated_by_target', (select count(*) from public.zen_subscriptions where activated_by_user_id = (select user_id from target))),
    ('zen_usage_limit_overrides', (select count(*) from public.zen_usage_limit_overrides where user_id = (select user_id from target))),
    ('zen_custom_assistants', (select count(*) from public.zen_custom_assistants where user_id = (select user_id from target))),
    ('zen_integration_accounts', (select count(*) from public.zen_integration_accounts where user_id = (select user_id from target))),
    ('zen_integration_items', (select count(*) from public.zen_integration_items where user_id = (select user_id from target))),
    ('zen_projects', (select count(*) from public.zen_projects where user_id = (select user_id from target))),
    ('zen_conversations', (select count(*) from public.zen_conversations where user_id = (select user_id from target))),
    ('zen_messages_cascading_from_conversations', (select count(*) from public.zen_messages where conversation_id in (select id from target_conversations))),
    ('zen_prompt_library', (select count(*) from public.zen_prompt_library where user_id = (select user_id from target))),
    ('zen_prompt_workflows', (select count(*) from public.zen_prompt_workflows where user_id = (select user_id from target))),
    ('zen_prompt_workflow_steps_cascading_from_workflows', (select count(*) from public.zen_prompt_workflow_steps where workflow_id in (select id from target_workflows))),
    ('zen_prompt_workflow_runs', (select count(*) from public.zen_prompt_workflow_runs where user_id = (select user_id from target))),
    ('zen_prompt_workflow_step_runs_cascading_from_runs', (select count(*) from public.zen_prompt_workflow_step_runs where run_id in (select id from target_workflow_runs))),
    ('zen_model_comparisons', (select count(*) from public.zen_model_comparisons where user_id = (select user_id from target))),
    ('zen_model_comparison_candidates_cascading_from_comparisons', (select count(*) from public.zen_model_comparison_candidates where comparison_id in (select id from target_model_comparisons))),
    ('zen_user_settings', (select count(*) from public.zen_user_settings where user_id = (select user_id from target))),
    ('zen_usage_events', (select count(*) from public.zen_usage_events where user_id = (select user_id from target))),
    ('zen_image_generation_events', (select count(*) from public.zen_image_generation_events where user_id = (select user_id from target))),
    ('zen_plan_change_requests', (select count(*) from public.zen_plan_change_requests where user_id = (select user_id from target))),
    ('zen_plan_change_requests_approved_by_target', (select count(*) from public.zen_plan_change_requests where approved_by_user_id = (select user_id from target))),
    ('zen_admin_audit_logs_target_user', (select count(*) from public.zen_admin_audit_logs where target_user_id = (select user_id from target))),
    ('zen_admin_audit_logs_admin_user', (select count(*) from public.zen_admin_audit_logs where admin_user_id = (select user_id from target))),
    ('zen_assistant_recommendation_events', (select count(*) from public.zen_assistant_recommendation_events where user_id = (select user_id from target))),
    ('zen_files', (select count(*) from public.zen_files where user_id = (select user_id from target))),
    ('zen_file_chunks', (select count(*) from public.zen_file_chunks where user_id = (select user_id from target))),
    ('zen_file_chunks_cascading_from_files', (select count(*) from public.zen_file_chunks where file_id in (select id from target_files))),
    ('zen_generated_images', (select count(*) from public.zen_generated_images where user_id = (select user_id from target))),
    ('zen_artifacts', (select count(*) from public.zen_artifacts where user_id = (select user_id from target))),
    ('zen_artifact_versions', (select count(*) from public.zen_artifact_versions where user_id = (select user_id from target))),
    ('zen_artifact_versions_cascading_from_artifacts', (select count(*) from public.zen_artifact_versions where artifact_id in (select id from target_artifacts))),
    ('zen_artifact_shares', (select count(*) from public.zen_artifact_shares where user_id = (select user_id from target))),
    ('zen_artifact_shares_cascading_from_artifacts', (select count(*) from public.zen_artifact_shares where artifact_id in (select id from target_artifacts))),
    ('zen_template_shares', (select count(*) from public.zen_template_shares where user_id = (select user_id from target))),
    ('zen_feedback_events', (select count(*) from public.zen_feedback_events where user_id = (select user_id from target)))
) as counts(table_name, rows_found)
order by table_name;
```

## 5. Workspace-Data Cleanup

This removes workspace/product data and resets usage counters while preserving the account, credentials, sessions, role, and subscription baseline.

Run the dry-run first. Export object refs first. Then run this transaction.

```sql
begin;

delete from public.zen_feedback_events where user_id = :'target_user_id';
delete from public.zen_assistant_recommendation_events where user_id = :'target_user_id';

delete from public.zen_integration_items where user_id = :'target_user_id';
delete from public.zen_integration_accounts where user_id = :'target_user_id';

delete from public.zen_artifact_shares where user_id = :'target_user_id';
delete from public.zen_artifact_versions where user_id = :'target_user_id';
delete from public.zen_artifacts where user_id = :'target_user_id';
delete from public.zen_template_shares where user_id = :'target_user_id';

delete from public.zen_file_chunks where user_id = :'target_user_id';
delete from public.zen_generated_images where user_id = :'target_user_id';
delete from public.zen_files where user_id = :'target_user_id';

delete from public.zen_image_generation_events where user_id = :'target_user_id';
delete from public.zen_usage_events where user_id = :'target_user_id';
delete from public.zen_plan_change_requests where user_id = :'target_user_id';

delete from public.zen_model_comparisons where user_id = :'target_user_id';
delete from public.zen_prompt_workflow_runs where user_id = :'target_user_id';
delete from public.zen_prompt_workflows where user_id = :'target_user_id';
delete from public.zen_prompt_library where user_id = :'target_user_id';
delete from public.zen_custom_assistants where user_id = :'target_user_id';
delete from public.zen_conversations where user_id = :'target_user_id';
delete from public.zen_projects where user_id = :'target_user_id';
delete from public.zen_user_settings where user_id = :'target_user_id';

update public.zen_subscriptions
set
  core_tokens_used = 0,
  tier_tokens_used = 0,
  image_credits_used = 0,
  daily_message_count = 0,
  daily_image_count = 0,
  updated_at = timezone('utc', now())
where user_id = :'target_user_id';

commit;
```

## 6. Full-Account Tombstone Cleanup

This does everything workspace-data cleanup does, then removes credentials/sessions/subscription rows and scrubs PII from `zen_users` and `zen_profiles`.

Do not run this for an admin account unless another admin has approved the action and account recovery is understood.

```sql
begin;

delete from public.zen_feedback_events where user_id = :'target_user_id';
delete from public.zen_assistant_recommendation_events where user_id = :'target_user_id';

delete from public.zen_integration_items where user_id = :'target_user_id';
delete from public.zen_integration_accounts where user_id = :'target_user_id';

delete from public.zen_artifact_shares where user_id = :'target_user_id';
delete from public.zen_artifact_versions where user_id = :'target_user_id';
delete from public.zen_artifacts where user_id = :'target_user_id';
delete from public.zen_template_shares where user_id = :'target_user_id';

delete from public.zen_file_chunks where user_id = :'target_user_id';
delete from public.zen_generated_images where user_id = :'target_user_id';
delete from public.zen_files where user_id = :'target_user_id';

delete from public.zen_image_generation_events where user_id = :'target_user_id';
delete from public.zen_usage_events where user_id = :'target_user_id';
delete from public.zen_plan_change_requests where user_id = :'target_user_id';

delete from public.zen_model_comparisons where user_id = :'target_user_id';
delete from public.zen_prompt_workflow_runs where user_id = :'target_user_id';
delete from public.zen_prompt_workflows where user_id = :'target_user_id';
delete from public.zen_prompt_library where user_id = :'target_user_id';
delete from public.zen_custom_assistants where user_id = :'target_user_id';
delete from public.zen_conversations where user_id = :'target_user_id';
delete from public.zen_projects where user_id = :'target_user_id';
delete from public.zen_user_settings where user_id = :'target_user_id';

update public.zen_subscriptions
set activated_by_user_id = null
where activated_by_user_id = :'target_user_id';

update public.zen_plan_change_requests
set approved_by_user_id = null
where approved_by_user_id = :'target_user_id';

delete from public.zen_usage_limit_overrides where user_id = :'target_user_id';
delete from public.zen_subscriptions where user_id = :'target_user_id';
delete from public.zen_auth_credentials where user_id = :'target_user_id';
delete from public.zen_auth_identities where user_id = :'target_user_id';
delete from public.zen_auth_sessions where user_id = :'target_user_id';

update public.zen_users
set
  external_auth_provider = null,
  external_auth_user_id = null,
  login_id = null,
  email = null,
  display_name = null,
  role = 'user',
  updated_at = timezone('utc', now())
where id = :'target_user_id';

update public.zen_profiles
set
  login_id = null,
  email = null,
  display_name = null,
  role = 'user',
  updated_at = timezone('utc', now())
where user_id = :'target_user_id';

commit;
```

## 7. Cascade Notes

- `zen_messages` cascades from `zen_conversations`.
- `zen_prompt_workflow_steps` cascades from `zen_prompt_workflows`.
- `zen_prompt_workflow_step_runs` cascades from `zen_prompt_workflow_runs`.
- `zen_model_comparison_candidates` cascades from `zen_model_comparisons`.
- `zen_file_chunks` cascades from `zen_files`, but this guide deletes chunks explicitly first for clearer cleanup.
- `zen_artifact_versions` and `zen_artifact_shares` cascade from `zen_artifacts`, but this guide deletes them explicitly first for clearer cleanup.
- `zen_integration_items` cascades from `zen_integration_accounts`, but this guide deletes items explicitly first for clearer cleanup.
- `zen_usage_events` and `zen_image_generation_events` also reference subscriptions. They are deleted before subscription rows in the full-account path.
- `zen_admin_audit_logs` are intentionally not deleted. They preserve admin history and remain valid because full-account cleanup tombstones the user instead of hard-deleting `zen_users`.
- `zen_auth_attempts` has no `user_id`; do not attempt per-user deletion there.

## 8. Object Storage Cleanup

After the DB transaction commits, protected app routes should no longer return the deleted user's files/images. Delete exported object refs from the configured private storage provider separately:

- Local dev: remove the exact exported object paths under the configured `FILE_STORAGE_LOCAL_DIR`.
- S3/R2: delete the exact exported bucket/key pairs using the storage console or CLI.

Never paste object keys or private URLs into user-facing support responses. Record only safe counts, for example: "8 object refs attempted, 8 deleted."

## 9. Verification Queries

Run the dry-run count query again. For workspace-data cleanup, account/auth/subscription rows may remain. For full-account cleanup, user/profile tombstones should remain but PII/auth rows should be gone.

```sql
select
  u.id,
  u.login_id,
  u.email,
  u.display_name,
  u.external_auth_provider,
  u.external_auth_user_id,
  u.role,
  p.login_id as profile_login_id,
  p.email as profile_email,
  p.display_name as profile_display_name,
  p.role as profile_role
from public.zen_users u
left join public.zen_profiles p on p.user_id = u.id
where u.id = :'target_user_id';

select *
from (
  values
    ('zen_auth_credentials', (select count(*) from public.zen_auth_credentials where user_id = :'target_user_id')),
    ('zen_auth_identities', (select count(*) from public.zen_auth_identities where user_id = :'target_user_id')),
    ('zen_auth_sessions', (select count(*) from public.zen_auth_sessions where user_id = :'target_user_id')),
    ('zen_conversations', (select count(*) from public.zen_conversations where user_id = :'target_user_id')),
    ('zen_projects', (select count(*) from public.zen_projects where user_id = :'target_user_id')),
    ('zen_files', (select count(*) from public.zen_files where user_id = :'target_user_id')),
    ('zen_generated_images', (select count(*) from public.zen_generated_images where user_id = :'target_user_id')),
    ('zen_artifacts', (select count(*) from public.zen_artifacts where user_id = :'target_user_id')),
    ('zen_prompt_workflows', (select count(*) from public.zen_prompt_workflows where user_id = :'target_user_id')),
    ('zen_usage_events', (select count(*) from public.zen_usage_events where user_id = :'target_user_id')),
    ('zen_image_generation_events', (select count(*) from public.zen_image_generation_events where user_id = :'target_user_id')),
    ('zen_plan_change_requests', (select count(*) from public.zen_plan_change_requests where user_id = :'target_user_id')),
    ('zen_assistant_recommendation_events', (select count(*) from public.zen_assistant_recommendation_events where user_id = :'target_user_id')),
    ('zen_feedback_events', (select count(*) from public.zen_feedback_events where user_id = :'target_user_id')),
    ('zen_integration_accounts', (select count(*) from public.zen_integration_accounts where user_id = :'target_user_id')),
    ('zen_integration_items', (select count(*) from public.zen_integration_items where user_id = :'target_user_id'))
) as remaining(table_name, rows_found)
order by table_name;
```

## 10. Protected URL Verification

Use an authenticated browser or API client:

- Try a previously valid `/api/files/object?bucket=...&path=...` URL for the target user's file. It should return 404/403 after metadata is gone.
- Try a previously visible Prism/generated-image preview. It should no longer appear in `/api/images/history`, and protected object reads should fail.
- Sign-in should still work after workspace-data cleanup. Sign-in should fail after full-account tombstone cleanup because credentials and sessions are gone.

## 11. Audit / Support Logging

Record a safe internal note with:

- date/time and environment;
- operator/admin who performed the cleanup;
- target `zen_users.id`;
- cleanup scope: workspace-data or full-account tombstone;
- safe row/object counts;
- whether object cleanup fully succeeded;
- any follow-up needed.

Do not include passwords, auth cookies, tokens, object keys, connection strings, raw provider payloads, or private file contents.
