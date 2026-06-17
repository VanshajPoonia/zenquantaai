import 'server-only'

import { getNeonSql } from '@/lib/db/client'
import {
  buildSafeUserPurgePreview,
  buildTombstoneUserPatch,
  normalizeUserPurgeObjectRefs,
  UserPurgeObjectRef,
} from '@/lib/account/user-purge-utils'
import {
  UserPurgeCounts,
  UserPurgePreview,
  UserPurgeScope,
} from '@/types'

interface UserPurgeIdentity {
  id: string
  loginId: string | null
  email: string | null
  displayName: string | null
  role: string
}

type CountRow = Record<keyof UserPurgeCounts, number | string>

function toCount(value: number | string | null | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
}

function rowToCounts(row: Partial<CountRow> | undefined): UserPurgeCounts {
  return {
    conversations: toCount(row?.conversations),
    projects: toCount(row?.projects),
    files: toCount(row?.files),
    generatedImages: toCount(row?.generatedImages),
    artifacts: toCount(row?.artifacts),
    prompts: toCount(row?.prompts),
    playbooks: toCount(row?.playbooks),
    customAssistants: toCount(row?.customAssistants),
    modelComparisons: toCount(row?.modelComparisons),
    integrations: toCount(row?.integrations),
    usageAndPlanData: toCount(row?.usageAndPlanData),
    telemetry: toCount(row?.telemetry),
    sessions: toCount(row?.sessions),
    objectRefs: toCount(row?.objectRefs),
  }
}

class NeonUserPurgeRepository {
  async getIdentity(userId: string): Promise<UserPurgeIdentity | null> {
    const rows = (await getNeonSql().query(
      `
        select
          u.id,
          coalesce(p.login_id, u.login_id) as "loginId",
          coalesce(p.email, u.email) as email,
          coalesce(p.display_name, u.display_name) as "displayName",
          coalesce(p.role, u.role) as role
        from public.zen_users u
        left join public.zen_profiles p on p.user_id = u.id
        where u.id = $1
        limit 1
      `,
      [userId]
    )) as UserPurgeIdentity[]

    return rows[0] ?? null
  }

  async collectObjectRefs(userId: string): Promise<UserPurgeObjectRef[]> {
    const rows = (await getNeonSql().query(
      `
        select bucket, storage_path as key
        from public.zen_files
        where user_id = $1 and bucket is not null and storage_path is not null
        union all
        select storage_bucket as bucket, storage_path as key
        from public.zen_generated_images
        where user_id = $1 and storage_bucket is not null and storage_path is not null
      `,
      [userId]
    )) as Array<{ bucket: string | null; key: string | null }>

    return normalizeUserPurgeObjectRefs(rows)
  }

  async preview(
    userId: string,
    scope: UserPurgeScope,
    options: { actor?: 'user' | 'admin' } = {}
  ): Promise<UserPurgePreview | null> {
    const identity = await this.getIdentity(userId)
    if (!identity) return null

    const objectRefs = await this.collectObjectRefs(userId)
    const rows = (await getNeonSql().query(
      `
        select
          (select count(*) from public.zen_conversations where user_id = $1)::int as "conversations",
          (select count(*) from public.zen_projects where user_id = $1)::int as "projects",
          (select count(*) from public.zen_files where user_id = $1)::int as "files",
          (select count(*) from public.zen_generated_images where user_id = $1)::int as "generatedImages",
          (select count(*) from public.zen_artifacts where user_id = $1)::int as "artifacts",
          (select count(*) from public.zen_prompt_library where user_id = $1)::int as "prompts",
          (
            (select count(*) from public.zen_prompt_workflows where user_id = $1) +
            (select count(*) from public.zen_prompt_workflow_runs where user_id = $1)
          )::int as "playbooks",
          (select count(*) from public.zen_custom_assistants where user_id = $1)::int as "customAssistants",
          (select count(*) from public.zen_model_comparisons where user_id = $1)::int as "modelComparisons",
          (
            (select count(*) from public.zen_integration_accounts where user_id = $1) +
            (select count(*) from public.zen_integration_items where user_id = $1)
          )::int as "integrations",
          (
            (select count(*) from public.zen_usage_events where user_id = $1) +
            (select count(*) from public.zen_image_generation_events where user_id = $1) +
            (select count(*) from public.zen_plan_change_requests where user_id = $1)
          )::int as "usageAndPlanData",
          (
            (select count(*) from public.zen_assistant_recommendation_events where user_id = $1) +
            (select count(*) from public.zen_feedback_events where user_id = $1)
          )::int as "telemetry",
          (select count(*) from public.zen_auth_sessions where user_id = $1)::int as "sessions",
          $2::int as "objectRefs"
      `,
      [userId, objectRefs.length]
    )) as CountRow[]

    return buildSafeUserPurgePreview({
      userId,
      scope,
      loginId: identity.loginId,
      actor: options.actor,
      counts: rowToCounts(rows[0]),
    })
  }

  /**
   * Destructive deletion order:
   * 1. Call collectObjectRefs() before this method so object keys are captured
   *    while file/image metadata still exists.
   * 2. Delete user-owned database rows in dependency-safe order, including rows
   *    with ON DELETE SET NULL references that should not survive data erasure.
   * 3. For full account deletion, remove credentials/sessions/identities and
   *    tombstone the user/profile rows instead of deleting zen_users, preserving
   *    admin audit foreign keys without retaining PII or usable auth.
   * 4. Delete object-storage refs only after this method succeeds so protected
   *    app reads already 404 even if bucket cleanup partially fails.
   */
  async deleteDatabaseRows(
    userId: string,
    scope: UserPurgeScope
  ): Promise<void> {
    const sql = getNeonSql()
    const tombstone = buildTombstoneUserPatch()

    await sql.transaction((tx) => {
      const statements = [
        tx.query('delete from public.zen_feedback_events where user_id = $1', [userId]),
        tx.query(
          'delete from public.zen_assistant_recommendation_events where user_id = $1',
          [userId]
        ),
        tx.query('delete from public.zen_integration_items where user_id = $1', [userId]),
        tx.query('delete from public.zen_integration_accounts where user_id = $1', [userId]),
        tx.query('delete from public.zen_artifact_shares where user_id = $1', [userId]),
        tx.query('delete from public.zen_artifact_versions where user_id = $1', [userId]),
        tx.query('delete from public.zen_artifacts where user_id = $1', [userId]),
        tx.query('delete from public.zen_template_shares where user_id = $1', [userId]),
        tx.query('delete from public.zen_file_chunks where user_id = $1', [userId]),
        tx.query('delete from public.zen_generated_images where user_id = $1', [userId]),
        tx.query('delete from public.zen_files where user_id = $1', [userId]),
        tx.query('delete from public.zen_image_generation_events where user_id = $1', [userId]),
        tx.query('delete from public.zen_usage_events where user_id = $1', [userId]),
        tx.query('delete from public.zen_plan_change_requests where user_id = $1', [userId]),
        tx.query('delete from public.zen_model_comparisons where user_id = $1', [userId]),
        tx.query('delete from public.zen_prompt_workflow_runs where user_id = $1', [userId]),
        tx.query('delete from public.zen_prompt_workflows where user_id = $1', [userId]),
        tx.query('delete from public.zen_prompt_library where user_id = $1', [userId]),
        tx.query('delete from public.zen_custom_assistants where user_id = $1', [userId]),
        tx.query('delete from public.zen_conversations where user_id = $1', [userId]),
        tx.query('delete from public.zen_projects where user_id = $1', [userId]),
        tx.query('delete from public.zen_user_settings where user_id = $1', [userId]),
      ]

      if (scope === 'workspace_data') {
        statements.push(
          tx.query(
            `
              update public.zen_subscriptions
              set
                core_tokens_used = 0,
                tier_tokens_used = 0,
                image_credits_used = 0,
                daily_message_count = 0,
                daily_image_count = 0,
                updated_at = timezone('utc', now())
              where user_id = $1
            `,
            [userId]
          )
        )
        return statements
      }

      statements.push(
        tx.query(
          'update public.zen_subscriptions set activated_by_user_id = null where activated_by_user_id = $1',
          [userId]
        ),
        tx.query(
          'update public.zen_plan_change_requests set approved_by_user_id = null where approved_by_user_id = $1',
          [userId]
        ),
        tx.query('delete from public.zen_usage_limit_overrides where user_id = $1', [userId]),
        tx.query('delete from public.zen_subscriptions where user_id = $1', [userId]),
        tx.query('delete from public.zen_auth_credentials where user_id = $1', [userId]),
        tx.query('delete from public.zen_auth_identities where user_id = $1', [userId]),
        tx.query('delete from public.zen_auth_sessions where user_id = $1', [userId]),
        tx.query(
          `
            update public.zen_users
            set
              external_auth_provider = null,
              external_auth_user_id = null,
              login_id = null,
              email = null,
              display_name = null,
              role = $2,
              updated_at = $3
            where id = $1
          `,
          [userId, tombstone.role, tombstone.updatedAt]
        ),
        tx.query(
          `
            update public.zen_profiles
            set
              login_id = null,
              email = null,
              display_name = null,
              role = $2,
              updated_at = $3
            where user_id = $1
          `,
          [userId, tombstone.role, tombstone.updatedAt]
        )
      )

      return statements
    })
  }
}

export const neonUserPurgeRepository = new NeonUserPurgeRepository()
