import { access } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { neon, NeonQueryFunction } from '@neondatabase/serverless'
import { APIRequestContext, BrowserContext, expect, test } from '@playwright/test'

const databaseUrl = process.env.PURGE_E2E_DATABASE_URL?.trim() ?? ''
const storageDir =
  process.env.PURGE_E2E_STORAGE_DIR?.trim() ?? '/tmp/zenquanta-purge-e2e'
const purgeE2EEnabled =
  process.env.PURGE_E2E_CONFIRM === 'dedicated-neon-branch' &&
  databaseUrl.length > 0 &&
  path.resolve(storageDir).startsWith('/tmp/')

test.skip(
  !purgeE2EEnabled,
  'Requires PURGE_E2E_CONFIRM=dedicated-neon-branch, PURGE_E2E_DATABASE_URL, and test-only storage under /tmp.'
)

type Sql = NeonQueryFunction<false, false>

interface TestAccount {
  context: BrowserContext
  request: APIRequestContext
  userId: string
  loginId: string
  password: string
}

interface SeededUserData {
  fileUrls: string[]
  objectPaths: string[]
  dependentIds: {
    artifactId: string
    comparisonId: string
    conversationId: string
    runId: string
    workflowId: string
  }
}

interface UploadedAttachment {
  fileId: string
  bucket: string
  storagePath: string
}

const requiredTables = [
  'zen_users',
  'zen_profiles',
  'zen_auth_credentials',
  'zen_auth_sessions',
  'zen_subscriptions',
  'zen_projects',
  'zen_conversations',
  'zen_messages',
  'zen_prompt_library',
  'zen_prompt_workflows',
  'zen_prompt_workflow_steps',
  'zen_prompt_workflow_runs',
  'zen_prompt_workflow_step_runs',
  'zen_custom_assistants',
  'zen_artifacts',
  'zen_artifact_versions',
  'zen_artifact_shares',
  'zen_template_shares',
  'zen_model_comparisons',
  'zen_model_comparison_candidates',
  'zen_files',
  'zen_file_chunks',
  'zen_generated_images',
  'zen_usage_events',
  'zen_image_generation_events',
  'zen_plan_change_requests',
  'zen_assistant_recommendation_events',
  'zen_feedback_events',
  'zen_integration_accounts',
  'zen_integration_items',
  'zen_user_settings',
] as const

function safePayload(value: unknown) {
  const serialized = JSON.stringify(value)
  for (const forbidden of [
    'storagePath',
    'storageBucket',
    'sourceUrl',
    'rawCostUsd',
    'marginUsd',
    'providerToken',
    'encryptedTokenPayload',
    'passwordHash',
    'privateProviderUrl',
  ]) {
    expect(serialized).not.toContain(forbidden)
  }
}

async function signUpAccount(
  newContext: () => Promise<BrowserContext>,
  label: string,
  suffix: string
): Promise<TestAccount> {
  const context = await newContext()
  const loginId = `purge-${label}-${suffix}`.slice(0, 32)
  const password = `Purge-${suffix}-safe-password`
  const response = await context.request.post('/api/auth/password/sign-up', {
    data: { identifier: loginId, password },
  })
  if (!response.ok()) {
    throw new Error(`Unable to create purge test account: ${await response.text()}`)
  }
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { user: { id: string } }
  return { context, request: context.request, userId: body.user.id, loginId, password }
}

async function uploadObject(
  request: APIRequestContext,
  label: string
): Promise<UploadedAttachment> {
  const id = randomUUID()
  const bytes = Buffer.from(`private purge fixture ${label}`)
  const response = await request.post('/api/attachments', {
    multipart: {
      metadata: JSON.stringify([
        {
          id,
          name: `${label}.txt`,
          mimeType: 'text/plain',
          size: bytes.byteLength,
          createdAt: new Date().toISOString(),
          kind: 'text',
        },
      ]),
      files: {
        name: `${label}.txt`,
        mimeType: 'text/plain',
        buffer: bytes,
      },
    },
  })
  if (!response.ok()) {
    throw new Error(`Unable to upload purge fixture: ${await response.text()}`)
  }
  expect(response.status()).toBe(200)
  const attachments = (await response.json()) as UploadedAttachment[]
  expect(attachments).toHaveLength(1)
  return attachments[0]
}

async function seedUser(sql: Sql, account: TestAccount): Promise<SeededUserData> {
  const tag = account.loginId
  const projectId = `project-${tag}`
  const conversationId = `conversation-${tag}`
  const userMessageId = `message-user-${tag}`
  const assistantMessageId = `message-assistant-${tag}`
  const promptId = `prompt-${tag}`
  const workflowId = `workflow-${tag}`
  const workflowStepId = `workflow-step-${tag}`
  const customAssistantId = randomUUID()
  const runId = randomUUID()
  const comparisonId = randomUUID()
  const artifactId = randomUUID()
  const subscriptionRows = (await sql.query(
    `insert into public.zen_subscriptions (user_id)
     values ($1) on conflict (user_id) do update set updated_at = timezone('utc', now())
     returning id`,
    [account.userId]
  )) as Array<{ id: string }>
  const subscriptionId = subscriptionRows[0].id

  await sql.transaction((tx) => [
    tx.query(
      `insert into public.zen_projects (id, user_id, name) values ($1, $2, $3)`,
      [projectId, account.userId, 'Purge fixture project']
    ),
    tx.query(
      `insert into public.zen_custom_assistants
       (id, user_id, name, system_instructions) values ($1, $2, $3, $4)`,
      [customAssistantId, account.userId, 'Purge fixture assistant', 'Test only']
    ),
    tx.query(
      `insert into public.zen_conversations
       (id, user_id, project_id, title, mode, assistant_family, custom_assistant_id)
       values ($1, $2, $3, $4, 'general', 'nova', $5)`,
      [conversationId, account.userId, projectId, 'Purge fixture conversation', customAssistantId]
    ),
    tx.query(
      `insert into public.zen_prompt_library (id, user_id, title, content)
       values ($1, $2, $3, $4)`,
      [promptId, account.userId, 'Purge fixture prompt', 'Private prompt content']
    ),
    tx.query(
      `insert into public.zen_prompt_workflows (id, user_id, project_id, title)
       values ($1, $2, $3, $4)`,
      [workflowId, account.userId, projectId, 'Purge fixture workflow']
    ),
    tx.query(
      `insert into public.zen_user_settings (user_id, payload)
       values ($1, $2::jsonb) on conflict (user_id) do update set payload = excluded.payload`,
      [account.userId, JSON.stringify({ privateSetting: true })]
    ),
  ])

  await sql.transaction((tx) => [
    tx.query(
      `insert into public.zen_messages
       (id, conversation_id, role, content, mode, assistant_family, status)
       values ($1, $2, 'user', $3, 'general', 'nova', 'complete'),
              ($4, $2, 'assistant', $5, 'general', 'nova', 'complete')`,
      [userMessageId, conversationId, 'Private user message', assistantMessageId, 'Private answer']
    ),
    tx.query(
      `insert into public.zen_prompt_workflow_steps
       (id, workflow_id, step_order, assistant_family, mode, template)
       values ($1, $2, 0, 'nova', 'general', $3)`,
      [workflowStepId, workflowId, 'Private workflow step']
    ),
    tx.query(
      `insert into public.zen_prompt_workflow_runs
       (id, workflow_id, user_id, project_id, conversation_id, status)
       values ($1, $2, $3, $4, $5, 'complete')`,
      [runId, workflowId, account.userId, projectId, conversationId]
    ),
    tx.query(
      `insert into public.zen_model_comparisons
       (id, user_id, conversation_id, prompt_message_id, project_id, prompt, status)
       values ($1, $2, $3, $4, $5, $6, 'complete')`,
      [comparisonId, account.userId, conversationId, userMessageId, projectId, 'Private comparison']
    ),
    tx.query(
      `insert into public.zen_artifacts
       (id, user_id, project_id, conversation_id, source_message_id, source_type, title, content)
       values ($1, $2, $3, $4, $5, 'chat_message', $6, $7)`,
      [artifactId, account.userId, projectId, conversationId, assistantMessageId, 'Purge fixture artifact', 'Private artifact']
    ),
  ])

  await sql.transaction((tx) => [
    tx.query(
      `insert into public.zen_prompt_workflow_step_runs
       (run_id, workflow_step_id, step_order, assistant_family, mode, message_id, status)
       values ($1, $2, 0, 'nova', 'general', $3, 'complete')`,
      [runId, workflowStepId, assistantMessageId]
    ),
    tx.query(
      `insert into public.zen_model_comparison_candidates
       (comparison_id, mode, assistant_family, model, label, content)
       values ($1, 'general', 'nova', 'test/model', 'A', 'Private candidate')`,
      [comparisonId]
    ),
    tx.query(
      `insert into public.zen_artifact_versions
       (artifact_id, user_id, title, content) values ($1, $2, $3, $4)`,
      [artifactId, account.userId, 'Purge fixture version', 'Private version']
    ),
    tx.query(
      `insert into public.zen_artifact_shares
       (artifact_id, user_id, token_hash) values ($1, $2, $3)`,
      [artifactId, account.userId, `artifact-share-${tag}`]
    ),
    tx.query(
      `insert into public.zen_template_shares
       (template_type, template_id, user_id, token_hash)
       values ('prompt', $1, $2, $3)`,
      [promptId, account.userId, `template-share-${tag}`]
    ),
    tx.query(
      `insert into public.zen_usage_events
       (user_id, subscription_id, conversation_id, message_id, assistant_family, mode, model, wallet_type)
       values ($1, $2, $3, $4, 'nova', 'general', 'test/model', 'core_tokens')`,
      [account.userId, subscriptionId, conversationId, assistantMessageId]
    ),
    tx.query(
      `insert into public.zen_image_generation_events
       (user_id, subscription_id, conversation_id, message_id, model, prompt, output_urls)
       values ($1, $2, $3, $4, 'test/image-model', 'Private image prompt', $5::jsonb)`,
      [account.userId, subscriptionId, conversationId, assistantMessageId, JSON.stringify(['https://private.invalid/image'])]
    ),
    tx.query(
      `insert into public.zen_plan_change_requests
       (user_id, current_tier, requested_tier, note, contact)
       values ($1, 'free', 'basic', 'Private plan note', 'private-contact')`,
      [account.userId]
    ),
    tx.query(
      `insert into public.zen_assistant_recommendation_events
       (user_id, conversation_id, current_assistant, recommended_assistant, reason, outcome)
       values ($1, $2, 'nova', 'axiom', 'Private reason', 'shown')`,
      [account.userId, conversationId]
    ),
    tx.query(
      `insert into public.zen_feedback_events
       (user_id, entity_type, entity_id, rating, reason)
       values ($1, 'message', $2, 'up', 'Private feedback')`,
      [account.userId, assistantMessageId]
    ),
  ])

  const integrationRows = (await sql.query(
    `insert into public.zen_integration_accounts
     (user_id, provider, external_account_id, installation_id, encrypted_token_payload)
     values ($1, 'github', $2, $3, $4::jsonb) returning id`,
    [account.userId, `external-${tag}`, `installation-${tag}`, JSON.stringify({ token: 'private' })]
  )) as Array<{ id: string }>
  await sql.query(
    `insert into public.zen_integration_items
     (user_id, account_id, provider, external_id, project_id, title, source_url)
     values ($1, $2, 'github', $3, $4, 'Private integration item', $5)`,
    [account.userId, integrationRows[0].id, `item-${tag}`, projectId, 'https://private.invalid/repo']
  )

  const uploadedFile = await uploadObject(account.request, `${tag}-upload`)
  const generatedObject = await uploadObject(account.request, `${tag}-generated`)
  const zeroVector = `[${Array.from({ length: 1536 }, () => '0').join(',')}]`
  await sql.query(
    `insert into public.zen_file_chunks
     (user_id, project_id, conversation_id, message_id, file_id, chunk_index, content,
      content_hash, embedding_model, embedding)
     values ($1, $2, $3, $4, $5, 0, 'Private chunk', $6, 'test-embedding', $7::vector)`,
    [account.userId, projectId, conversationId, userMessageId, uploadedFile.fileId, `hash-${tag}`, zeroVector]
  )
  await sql.query(
    `insert into public.zen_generated_images
     (user_id, project_id, conversation_id, message_id, provider, model, prompt,
      storage_provider, storage_bucket, storage_path, source_url, status)
     values ($1, $2, $3, $4, 'local', 'test/image-model', 'Private image prompt',
      'local', $5, $6, $7, 'stored')`,
    [
      account.userId,
      projectId,
      conversationId,
      assistantMessageId,
      generatedObject.bucket,
      generatedObject.storagePath,
      'https://private.invalid/provider-image',
    ]
  )

  const refs = [uploadedFile, generatedObject]
  return {
    fileUrls: refs.map(
      ({ bucket, storagePath }) =>
        `/api/files/object?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(storagePath)}`
    ),
    objectPaths: refs.map(({ bucket, storagePath }) =>
      path.join(storageDir, bucket, storagePath)
    ),
    dependentIds: {
      artifactId,
      comparisonId,
      conversationId,
      runId,
      workflowId,
    },
  }
}

async function userOwnedRowCount(sql: Sql, userId: string): Promise<number> {
  const tablesWithUserId = [
    'zen_feedback_events',
    'zen_assistant_recommendation_events',
    'zen_integration_items',
    'zen_integration_accounts',
    'zen_artifact_shares',
    'zen_artifact_versions',
    'zen_artifacts',
    'zen_template_shares',
    'zen_file_chunks',
    'zen_generated_images',
    'zen_files',
    'zen_image_generation_events',
    'zen_usage_events',
    'zen_plan_change_requests',
    'zen_model_comparisons',
    'zen_prompt_workflow_runs',
    'zen_prompt_workflows',
    'zen_prompt_library',
    'zen_custom_assistants',
    'zen_conversations',
    'zen_projects',
    'zen_user_settings',
  ]
  let count = 0
  for (const table of tablesWithUserId) {
    const rows = (await sql.query(
      `select count(*)::int as count from public.${table} where user_id = $1`,
      [userId]
    )) as Array<{ count: number }>
    count += Number(rows[0].count)
  }
  return count
}

async function dependentRowCount(
  sql: Sql,
  ids: SeededUserData['dependentIds']
): Promise<number> {
  const rows = (await sql.query(
    `select (
       (select count(*) from public.zen_messages where conversation_id = $1) +
       (select count(*) from public.zen_prompt_workflow_steps where workflow_id = $2) +
       (select count(*) from public.zen_prompt_workflow_step_runs where run_id = $3) +
       (select count(*) from public.zen_model_comparison_candidates where comparison_id = $4) +
       (select count(*) from public.zen_artifact_versions where artifact_id = $5) +
       (select count(*) from public.zen_artifact_shares where artifact_id = $5)
     )::int as count`,
    [
      ids.conversationId,
      ids.workflowId,
      ids.runId,
      ids.comparisonId,
      ids.artifactId,
    ]
  )) as Array<{ count: number }>
  return Number(rows[0].count)
}

test('self-service and admin purge remove only the intended user data', async ({
  browser,
}) => {
  const sql = neon(databaseUrl)
  const tableRows = (await sql.query(
    `select table_name as "tableName"
     from information_schema.tables
     where table_schema = 'public' and table_name = any($1::text[])`,
    [requiredTables]
  )) as Array<{ tableName: string }>
  expect(tableRows.map((row) => row.tableName).sort()).toEqual(
    [...requiredTables].sort()
  )

  const suffix = randomUUID().replaceAll('-', '').slice(0, 8)
  const makeContext = () => browser.newContext()
  const workspace = await signUpAccount(makeContext, 'workspace', suffix)
  const fullAccount = await signUpAccount(makeContext, 'full', suffix)
  const adminTarget = await signUpAccount(makeContext, 'target', suffix)
  const admin = await signUpAccount(makeContext, 'admin', suffix)
  const control = await signUpAccount(makeContext, 'control', suffix)
  const accounts = [workspace, fullAccount, adminTarget, admin, control]

  try {
    await sql.query(
      `update public.zen_profiles set role = 'admin' where user_id = $1`,
      [admin.userId]
    )
    await sql.query(`update public.zen_users set role = 'admin' where id = $1`, [
      admin.userId,
    ])
    const workspaceData = await seedUser(sql, workspace)
    const fullData = await seedUser(sql, fullAccount)
    const adminTargetData = await seedUser(sql, adminTarget)
    await sql.query(
      `insert into public.zen_projects (id, user_id, name) values ($1, $2, 'Control sentinel')`,
      [`control-${suffix}`, control.userId]
    )

    for (const filePath of [
      ...workspaceData.objectPaths,
      ...fullData.objectPaths,
      ...adminTargetData.objectPaths,
    ]) {
      await expect(access(filePath)).resolves.toBeUndefined()
    }
    for (const url of workspaceData.fileUrls) {
      expect((await workspace.request.get(url)).status()).toBe(200)
      expect((await control.request.get(url)).status()).toBe(404)
    }

    const workspacePreviewResponse = await workspace.request.post(
      '/api/account/delete-data/preview',
      { data: { scope: 'workspace_data', userId: control.userId } }
    )
    expect(workspacePreviewResponse.status()).toBe(200)
    const workspacePreview = await workspacePreviewResponse.json()
    safePayload(workspacePreview)
    expect(workspacePreview.preview.userId).toBe(workspace.userId)
    expect(workspacePreview.preview.counts).toMatchObject({
      conversations: 1,
      projects: 1,
      files: 2,
      generatedImages: 1,
      artifacts: 1,
      prompts: 1,
      customAssistants: 1,
      modelComparisons: 1,
      integrations: 2,
      usageAndPlanData: 3,
      telemetry: 2,
      objectRefs: 2,
    })

    const workspaceDeleteResponse = await workspace.request.post(
      '/api/account/delete-data',
      {
        data: {
          scope: 'workspace_data',
          confirmation: 'DELETE DATA',
          userId: control.userId,
        },
      }
    )
    expect(workspaceDeleteResponse.status()).toBe(200)
    safePayload(await workspaceDeleteResponse.json())
    expect(await userOwnedRowCount(sql, workspace.userId)).toBe(0)
    expect(await dependentRowCount(sql, workspaceData.dependentIds)).toBe(0)
    expect((await workspace.request.get('/api/auth/session')).status()).toBe(200)
    for (const url of workspaceData.fileUrls) {
      expect((await workspace.request.get(url)).status()).toBe(404)
    }
    for (const filePath of workspaceData.objectPaths) {
      await expect(access(filePath)).rejects.toThrow()
    }

    const fullPreviewResponse = await fullAccount.request.post(
      '/api/account/delete-data/preview',
      { data: { scope: 'full_account' } }
    )
    expect(fullPreviewResponse.status()).toBe(200)
    safePayload(await fullPreviewResponse.json())
    const fullDeleteResponse = await fullAccount.request.post(
      '/api/account/delete-data',
      { data: { scope: 'full_account', confirmation: fullAccount.loginId } }
    )
    expect(fullDeleteResponse.status()).toBe(200)
    const fullDelete = await fullDeleteResponse.json()
    safePayload(fullDelete)
    expect(fullDelete).toMatchObject({
      redirectTo: '/?accountDeleted=1',
      result: { signedOut: true },
    })
    expect(fullDeleteResponse.headers()['set-cookie']).toContain('Max-Age=0')
    expect((await fullAccount.request.get('/api/files')).status()).toBe(401)
    expect(
      (
        await fullAccount.request.post('/api/auth/password/sign-in', {
          data: { identifier: fullAccount.loginId, password: fullAccount.password },
        })
      ).status()
    ).toBe(401)
    const tombstoneRows = (await sql.query(
      `select u.login_id as "userLoginId", u.email as "userEmail",
              p.login_id as "profileLoginId", p.email as "profileEmail",
              exists(select 1 from public.zen_auth_credentials where user_id = $1) as credentials,
              exists(select 1 from public.zen_auth_sessions where user_id = $1) as sessions
       from public.zen_users u join public.zen_profiles p on p.user_id = u.id
       where u.id = $1`,
      [fullAccount.userId]
    )) as Array<Record<string, unknown>>
    expect(tombstoneRows[0]).toMatchObject({
      userLoginId: null,
      userEmail: null,
      profileLoginId: null,
      profileEmail: null,
      credentials: false,
      sessions: false,
    })
    expect(await userOwnedRowCount(sql, fullAccount.userId)).toBe(0)
    expect(await dependentRowCount(sql, fullData.dependentIds)).toBe(0)
    for (const url of fullData.fileUrls) {
      expect((await control.request.get(url)).status()).toBe(404)
    }
    for (const filePath of fullData.objectPaths) {
      await expect(access(filePath)).rejects.toThrow()
    }

    const denied = await workspace.request.post(
      `/api/admin/users/${adminTarget.userId}/purge/preview`,
      { data: { scope: 'full_account' } }
    )
    expect(denied.status()).toBe(403)
    const selfPurge = await admin.request.post(
      `/api/admin/users/${admin.userId}/purge/preview`,
      { data: { scope: 'full_account' } }
    )
    expect(selfPurge.status()).toBe(400)
    const adminPreviewResponse = await admin.request.post(
      `/api/admin/users/${adminTarget.userId}/purge/preview`,
      { data: { scope: 'full_account' } }
    )
    expect(adminPreviewResponse.status()).toBe(200)
    safePayload(await adminPreviewResponse.json())
    const adminPurgeResponse = await admin.request.post(
      `/api/admin/users/${adminTarget.userId}/purge`,
      {
        data: {
          scope: 'full_account',
          confirmation: `${adminTarget.userId} PURGE`,
        },
      }
    )
    expect(adminPurgeResponse.status()).toBe(200)
    safePayload(await adminPurgeResponse.json())
    expect(await userOwnedRowCount(sql, adminTarget.userId)).toBe(0)
    expect(await dependentRowCount(sql, adminTargetData.dependentIds)).toBe(0)
    for (const filePath of adminTargetData.objectPaths) {
      await expect(access(filePath)).rejects.toThrow()
    }

    const controlRows = (await sql.query(
      `select count(*)::int as count from public.zen_projects where user_id = $1`,
      [control.userId]
    )) as Array<{ count: number }>
    expect(Number(controlRows[0].count)).toBe(1)
    const auditRows = (await sql.query(
      `select action, details from public.zen_admin_audit_logs
       where admin_user_id = $1 and target_user_id = $2 order by created_at`,
      [admin.userId, adminTarget.userId]
    )) as Array<{ action: string; details: unknown }>
    expect(auditRows.map((row) => row.action)).toEqual([
      'admin_user_purge_previewed',
      'admin_user_purged',
    ])
    safePayload(auditRows)
  } finally {
    await Promise.all(accounts.map((account) => account.context.close()))
  }
})
