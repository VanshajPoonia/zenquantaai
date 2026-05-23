import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}

const assistantFamilyCheck = [
  'nova',
  'velora',
  'axiom',
  'forge',
  'pulse',
  'prism',
] as const

export const zenUsers = pgTable(
  'zen_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalAuthProvider: text('external_auth_provider'),
    externalAuthUserId: text('external_auth_user_id'),
    loginId: text('login_id'),
    email: text('email'),
    displayName: text('display_name'),
    role: text('role').notNull().default('user'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('zen_users_external_auth_identity_idx').on(
      table.externalAuthProvider,
      table.externalAuthUserId
    ),
    index('zen_users_email_idx').on(table.email),
    index('zen_users_login_id_idx').on(table.loginId),
    check('zen_users_role_check', sql`${table.role} in ('user', 'admin')`),
  ]
)

export const zenAuthIdentities = pgTable(
  'zen_auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    providerEmail: text('provider_email'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('zen_auth_identities_provider_user_idx').on(
      table.provider,
      table.providerUserId
    ),
    index('zen_auth_identities_user_idx').on(table.userId),
  ]
)

export const zenAuthCredentials = pgTable(
  'zen_auth_credentials',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    loginId: text('login_id').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    passwordSalt: text('password_salt').notNull(),
    passwordParams: jsonb('password_params').notNull().default({}),
    passwordUpdatedAt: timestamp('password_updated_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [index('zen_auth_credentials_login_id_idx').on(table.loginId)]
)

export const zenAuthSessions = pgTable(
  'zen_auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('zen_auth_sessions_user_idx').on(table.userId),
    index('zen_auth_sessions_token_hash_idx').on(table.tokenHash),
    index('zen_auth_sessions_expires_idx').on(table.expiresAt),
  ]
)

export const zenProfiles = pgTable(
  'zen_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    loginId: text('login_id'),
    email: text('email'),
    displayName: text('display_name'),
    role: text('role').notNull().default('user'),
    ...timestamps,
  },
  (table) => [
    check('zen_profiles_role_check', sql`${table.role} in ('user', 'admin')`),
  ]
)

export const zenSubscriptions = pgTable(
  'zen_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    tier: text('tier').notNull().default('free'),
    status: text('status').notNull().default('active'),
    activationSource: text('activation_source').notNull().default('manual'),
    displayMultiplier: numeric('display_multiplier', {
      precision: 8,
      scale: 4,
    })
      .notNull()
      .default('2.0'),
    planPriceUsd: numeric('plan_price_usd', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    coreTokensIncluded: bigint('core_tokens_included', { mode: 'number' })
      .notNull()
      .default(1000000),
    coreTokensUsed: bigint('core_tokens_used', { mode: 'number' })
      .notNull()
      .default(0),
    tierTokensIncluded: bigint('tier_tokens_included', { mode: 'number' })
      .notNull()
      .default(0),
    tierTokensUsed: bigint('tier_tokens_used', { mode: 'number' })
      .notNull()
      .default(0),
    imageCreditsIncluded: integer('image_credits_included').notNull().default(50),
    imageCreditsUsed: integer('image_credits_used').notNull().default(0),
    dailyMessageLimit: integer('daily_message_limit').notNull().default(50),
    dailyMessageCount: integer('daily_message_count').notNull().default(0),
    maxInputTokensPerRequest: integer('max_input_tokens_per_request')
      .notNull()
      .default(8000),
    maxOutputTokensPerRequest: integer('max_output_tokens_per_request')
      .notNull()
      .default(800),
    maxImagesPerDay: integer('max_images_per_day').notNull().default(2),
    dailyImageCount: integer('daily_image_count').notNull().default(0),
    currentPeriodStartedAt: timestamp('current_period_started_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    currentPeriodEndsAt: timestamp('current_period_ends_at', {
      withTimezone: true,
    })
      .notNull()
      .default(sql`timezone('utc', now()) + interval '30 days'`),
    lastDailyResetAt: timestamp('last_daily_reset_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedByUserId: uuid('activated_by_user_id').references(() => zenUsers.id, {
      onDelete: 'set null',
    }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    check(
      'zen_subscriptions_tier_check',
      sql`${table.tier} in ('free', 'basic', 'pro', 'ultra', 'prime')`
    ),
    check(
      'zen_subscriptions_status_check',
      sql`${table.status} in ('active', 'paused', 'cancelled')`
    ),
    check(
      'zen_subscriptions_activation_source_check',
      sql`${table.activationSource} in ('manual', 'admin', 'system')`
    ),
  ]
)

export const zenUsageLimitOverrides = pgTable('zen_usage_limit_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => zenUsers.id, { onDelete: 'cascade' }),
  coreTokensIncluded: bigint('core_tokens_included', { mode: 'number' }),
  tierTokensIncluded: bigint('tier_tokens_included', { mode: 'number' }),
  imageCreditsIncluded: integer('image_credits_included'),
  dailyMessageLimit: integer('daily_message_limit'),
  maxInputTokensPerRequest: integer('max_input_tokens_per_request'),
  maxOutputTokensPerRequest: integer('max_output_tokens_per_request'),
  maxImagesPerDay: integer('max_images_per_day'),
  allowedModelOverrides: text('allowed_model_overrides').array(),
  notes: text('notes'),
  ...timestamps,
})

export const zenProjects = pgTable(
  'zen_projects',
  {
    id: text('id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').notNull().default('general'),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index('zen_projects_user_updated_idx').on(table.userId, table.updatedAt),
  ]
)

export const zenConversations = pgTable(
  'zen_conversations',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    projectId: text('project_id'),
    title: text('title').notNull(),
    mode: text('mode').notNull(),
    assistantFamily: text('assistant_family').notNull().default('nova'),
    isPinned: boolean('is_pinned').notNull().default(false),
    preview: text('preview').notNull().default(''),
    messageCount: integer('message_count').notNull().default(0),
    sessionSettings: jsonb('session_settings').notNull().default({}),
    usage: jsonb('usage'),
    memorySummary: text('memory_summary'),
    memoryUpdatedAt: timestamp('memory_updated_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('zen_conversations_user_updated_idx').on(table.userId, table.updatedAt),
    index('zen_conversations_user_project_idx').on(table.userId, table.projectId),
    check(
      'zen_conversations_mode_check',
      sql`${table.mode} in ('general', 'creative', 'logic', 'code', 'live', 'image')`
    ),
    check(
      'zen_conversations_assistant_family_check',
      sql`${table.assistantFamily} in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')`
    ),
  ]
)

export const zenMessages = pgTable(
  'zen_messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => zenConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull().default(''),
    mode: text('mode').notNull(),
    assistantFamily: text('assistant_family'),
    status: text('status'),
    model: text('model'),
    provider: text('provider'),
    error: text('error'),
    parentUserMessageId: text('parent_user_message_id'),
    branchLabel: text('branch_label'),
    attachments: jsonb('attachments').notNull().default([]),
    usage: jsonb('usage'),
    sources: jsonb('sources').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('zen_messages_conversation_created_idx').on(
      table.conversationId,
      table.createdAt
    ),
    check('zen_messages_role_check', sql`${table.role} in ('system', 'user', 'assistant')`),
    check(
      'zen_messages_mode_check',
      sql`${table.mode} in ('general', 'creative', 'logic', 'code', 'live', 'image')`
    ),
    check(
      'zen_messages_assistant_family_check',
      sql`${table.assistantFamily} is null or ${table.assistantFamily} in (${sql.join(
        assistantFamilyCheck.map((family) => sql`${family}`),
        sql`, `
      )})`
    ),
    check(
      'zen_messages_status_check',
      sql`${table.status} is null or ${table.status} in ('complete', 'streaming', 'error')`
    ),
    check(
      'zen_messages_provider_check',
      sql`${table.provider} is null or ${table.provider} in ('openrouter')`
    ),
  ]
)

export const zenPromptLibrary = pgTable(
  'zen_prompt_library',
  {
    id: text('id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    mode: text('mode').notNull().default('any'),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index('zen_prompt_library_user_updated_idx').on(table.userId, table.updatedAt),
    check(
      'zen_prompt_library_mode_check',
      sql`${table.mode} in ('any', 'general', 'creative', 'logic', 'code', 'live', 'image')`
    ),
  ]
)

export const zenPromptWorkflows = pgTable(
  'zen_prompt_workflows',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    projectId: text('project_id'),
    title: text('title').notNull(),
    description: text('description'),
    variables: jsonb('variables').notNull().default([]),
    ...timestamps,
  },
  (table) => [
    index('zen_prompt_workflows_user_updated_idx').on(
      table.userId,
      table.updatedAt
    ),
    index('zen_prompt_workflows_user_project_idx').on(
      table.userId,
      table.projectId
    ),
  ]
)

export const zenPromptWorkflowSteps = pgTable(
  'zen_prompt_workflow_steps',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => zenPromptWorkflows.id, { onDelete: 'cascade' }),
    stepOrder: integer('step_order').notNull(),
    assistantFamily: text('assistant_family').notNull(),
    mode: text('mode').notNull(),
    title: text('title'),
    template: text('template').notNull(),
    variableNames: jsonb('variable_names').notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('zen_prompt_workflow_steps_workflow_order_idx').on(
      table.workflowId,
      table.stepOrder
    ),
    index('zen_prompt_workflow_steps_workflow_idx').on(table.workflowId),
    check(
      'zen_prompt_workflow_steps_assistant_family_check',
      sql`${table.assistantFamily} in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')`
    ),
    check(
      'zen_prompt_workflow_steps_mode_check',
      sql`${table.mode} in ('general', 'creative', 'logic', 'code', 'live', 'image')`
    ),
  ]
)

export const zenPromptWorkflowRuns = pgTable(
  'zen_prompt_workflow_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowId: text('workflow_id').references(() => zenPromptWorkflows.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => zenConversations.id, {
      onDelete: 'set null',
    }),
    projectId: text('project_id'),
    status: text('status').notNull().default('queued'),
    variableValues: jsonb('variable_values').notNull().default({}),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('zen_prompt_workflow_runs_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    index('zen_prompt_workflow_runs_workflow_created_idx').on(
      table.workflowId,
      table.createdAt
    ),
    index('zen_prompt_workflow_runs_conversation_idx').on(table.conversationId),
    check(
      'zen_prompt_workflow_runs_status_check',
      sql`${table.status} in ('queued', 'running', 'complete', 'failed', 'cancelled')`
    ),
  ]
)

export const zenPromptWorkflowStepRuns = pgTable(
  'zen_prompt_workflow_step_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => zenPromptWorkflowRuns.id, { onDelete: 'cascade' }),
    workflowStepId: text('workflow_step_id').references(
      () => zenPromptWorkflowSteps.id,
      { onDelete: 'set null' }
    ),
    stepOrder: integer('step_order').notNull(),
    assistantFamily: text('assistant_family').notNull(),
    mode: text('mode').notNull(),
    messageId: text('message_id'),
    status: text('status').notNull().default('queued'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('zen_prompt_workflow_step_runs_run_idx').on(table.runId),
    check(
      'zen_prompt_workflow_step_runs_assistant_family_check',
      sql`${table.assistantFamily} in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')`
    ),
    check(
      'zen_prompt_workflow_step_runs_mode_check',
      sql`${table.mode} in ('general', 'creative', 'logic', 'code', 'live', 'image')`
    ),
    check(
      'zen_prompt_workflow_step_runs_status_check',
      sql`${table.status} in ('queued', 'running', 'complete', 'failed', 'cancelled')`
    ),
  ]
)

export const zenModelComparisons = pgTable(
  'zen_model_comparisons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => zenConversations.id, { onDelete: 'cascade' }),
    promptMessageId: text('prompt_message_id').notNull(),
    projectId: text('project_id'),
    prompt: text('prompt').notNull(),
    status: text('status').notNull().default('running'),
    selectedCandidateId: uuid('selected_candidate_id'),
    settings: jsonb('settings').notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index('zen_model_comparisons_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    index('zen_model_comparisons_conversation_idx').on(table.conversationId),
    check(
      'zen_model_comparisons_status_check',
      sql`${table.status} in ('running', 'complete', 'failed')`
    ),
  ]
)

export const zenModelComparisonCandidates = pgTable(
  'zen_model_comparison_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    comparisonId: uuid('comparison_id')
      .notNull()
      .references(() => zenModelComparisons.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(),
    assistantFamily: text('assistant_family').notNull(),
    model: text('model').notNull(),
    label: text('label').notNull(),
    content: text('content').notNull().default(''),
    status: text('status').notNull().default('complete'),
    error: text('error'),
    latencyMs: integer('latency_ms'),
    usage: jsonb('usage'),
    sources: jsonb('sources').notNull().default([]),
    ...timestamps,
  },
  (table) => [
    index('zen_model_comparison_candidates_comparison_idx').on(
      table.comparisonId
    ),
    check(
      'zen_model_comparison_candidates_mode_check',
      sql`${table.mode} in ('general', 'creative', 'logic', 'code', 'live')`
    ),
    check(
      'zen_model_comparison_candidates_assistant_family_check',
      sql`${table.assistantFamily} in ('nova', 'velora', 'axiom', 'forge', 'pulse')`
    ),
    check(
      'zen_model_comparison_candidates_status_check',
      sql`${table.status} in ('complete', 'error')`
    ),
  ]
)

export const zenUserSettings = pgTable('zen_user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => zenUsers.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull().default({}),
  ...timestamps,
})

export const zenUsageEvents = pgTable(
  'zen_usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => zenSubscriptions.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => zenConversations.id, {
      onDelete: 'set null',
    }),
    messageId: text('message_id'),
    assistantFamily: text('assistant_family').notNull(),
    mode: text('mode').notNull(),
    model: text('model').notNull(),
    walletType: text('wallet_type').notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    rawCostUsd: numeric('raw_cost_usd', { precision: 12, scale: 6 })
      .notNull()
      .default('0'),
    displayedCostUsd: numeric('displayed_cost_usd', {
      precision: 12,
      scale: 6,
    })
      .notNull()
      .default('0'),
    displayMultiplier: numeric('display_multiplier', {
      precision: 8,
      scale: 4,
    })
      .notNull()
      .default('1'),
    marginUsd: numeric('margin_usd', { precision: 12, scale: 6 })
      .notNull()
      .default('0'),
    creditsConsumed: integer('credits_consumed').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('zen_usage_events_user_created_idx').on(table.userId, table.createdAt),
    index('zen_usage_events_conversation_idx').on(table.conversationId),
    check(
      'zen_usage_events_assistant_family_check',
      sql`${table.assistantFamily} in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')`
    ),
    check(
      'zen_usage_events_mode_check',
      sql`${table.mode} in ('general', 'creative', 'logic', 'code', 'live', 'image')`
    ),
    check(
      'zen_usage_events_wallet_type_check',
      sql`${table.walletType} in ('core_tokens', 'tier_tokens', 'image_credits')`
    ),
  ]
)

export const zenImageGenerationEvents = pgTable(
  'zen_image_generation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => zenSubscriptions.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => zenConversations.id, {
      onDelete: 'set null',
    }),
    messageId: text('message_id'),
    assistantFamily: text('assistant_family').notNull().default('prism'),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    negativePrompt: text('negative_prompt'),
    size: text('size'),
    aspectRatio: text('aspect_ratio'),
    imageCount: integer('image_count').notNull().default(1),
    imageCreditsConsumed: integer('image_credits_consumed')
      .notNull()
      .default(0),
    rawCostUsd: numeric('raw_cost_usd', { precision: 12, scale: 6 })
      .notNull()
      .default('0'),
    displayedCostUsd: numeric('displayed_cost_usd', {
      precision: 12,
      scale: 6,
    })
      .notNull()
      .default('0'),
    displayMultiplier: numeric('display_multiplier', {
      precision: 8,
      scale: 4,
    })
      .notNull()
      .default('1'),
    marginUsd: numeric('margin_usd', { precision: 12, scale: 6 })
      .notNull()
      .default('0'),
    outputUrls: jsonb('output_urls').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('zen_image_generation_events_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    check(
      'zen_image_generation_events_assistant_family_check',
      sql`${table.assistantFamily} = 'prism'`
    ),
  ]
)

export const zenPlanChangeRequests = pgTable(
  'zen_plan_change_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    currentTier: text('current_tier').notNull(),
    requestedTier: text('requested_tier').notNull(),
    note: text('note'),
    contact: text('contact'),
    adminNote: text('admin_note'),
    status: text('status').notNull().default('pending'),
    approvedByUserId: uuid('approved_by_user_id').references(() => zenUsers.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('zen_plan_change_requests_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    index('zen_plan_change_requests_status_created_idx').on(
      table.status,
      table.createdAt
    ),
    check(
      'zen_plan_change_requests_current_tier_check',
      sql`${table.currentTier} in ('free', 'basic', 'pro', 'ultra', 'prime')`
    ),
    check(
      'zen_plan_change_requests_requested_tier_check',
      sql`${table.requestedTier} in ('basic', 'pro', 'ultra', 'prime')`
    ),
    check(
      'zen_plan_change_requests_status_check',
      sql`${table.status} in ('pending', 'approved', 'rejected', 'activated')`
    ),
  ]
)

export const zenAdminAuditLogs = pgTable(
  'zen_admin_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    details: jsonb('details').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('zen_admin_audit_logs_target_created_idx').on(
      table.targetUserId,
      table.createdAt
    ),
  ]
)

export const zenAssistantRecommendationEvents = pgTable(
  'zen_assistant_recommendation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => zenConversations.id, {
      onDelete: 'set null',
    }),
    currentAssistant: text('current_assistant').notNull(),
    recommendedAssistant: text('recommended_assistant').notNull(),
    confidence: numeric('confidence', { precision: 6, scale: 4 })
      .notNull()
      .default('0'),
    matchedSignals: text('matched_signals').array().notNull().default(sql`'{}'::text[]`),
    reason: text('reason').notNull(),
    outcome: text('outcome').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('zen_assistant_recommendation_events_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    check(
      'zen_assistant_recommendation_events_current_assistant_check',
      sql`${table.currentAssistant} in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')`
    ),
    check(
      'zen_assistant_recommendation_events_recommended_assistant_check',
      sql`${table.recommendedAssistant} in ('nova', 'velora', 'axiom', 'forge', 'pulse', 'prism')`
    ),
    check(
      'zen_assistant_recommendation_events_outcome_check',
      sql`${table.outcome} in ('shown', 'accepted', 'continued', 'cancelled', 'autoswitched', 'not_shown')`
    ),
  ]
)

export const zenFiles = pgTable(
  'zen_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => zenConversations.id, {
      onDelete: 'set null',
    }),
    projectId: text('project_id'),
    messageId: text('message_id'),
    provider: text('provider').notNull().default('local'),
    bucket: text('bucket'),
    storagePath: text('storage_path'),
    publicUrl: text('public_url'),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type'),
    byteSize: bigint('byte_size', { mode: 'number' }),
    checksum: text('checksum'),
    visibility: text('visibility').notNull().default('private'),
    metadata: jsonb('metadata').notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index('zen_files_user_created_idx').on(table.userId, table.createdAt),
    index('zen_files_conversation_idx').on(table.conversationId),
    check(
      'zen_files_provider_check',
      sql`${table.provider} in ('external', 'local')`
    ),
    check(
      'zen_files_visibility_check',
      sql`${table.visibility} in ('private', 'public')`
    ),
  ]
)

export const zenFileChunks = pgTable(
  'zen_file_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    projectId: text('project_id'),
    conversationId: text('conversation_id').references(() => zenConversations.id, {
      onDelete: 'set null',
    }),
    messageId: text('message_id'),
    fileId: uuid('file_id')
      .notNull()
      .references(() => zenFiles.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    tokenCountEstimate: integer('token_count_estimate').notNull().default(0),
    embeddingModel: text('embedding_model').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('zen_file_chunks_file_index_idx').on(
      table.fileId,
      table.chunkIndex
    ),
    index('zen_file_chunks_user_created_idx').on(table.userId, table.createdAt),
    index('zen_file_chunks_user_project_idx').on(table.userId, table.projectId),
    index('zen_file_chunks_conversation_idx').on(table.conversationId),
    index('zen_file_chunks_file_idx').on(table.fileId),
  ]
)

export const zenGeneratedImages = pgTable(
  'zen_generated_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => zenUsers.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => zenConversations.id, {
      onDelete: 'set null',
    }),
    messageId: text('message_id'),
    imageGenerationEventId: uuid('image_generation_event_id').references(
      () => zenImageGenerationEvents.id,
      { onDelete: 'set null' }
    ),
    provider: text('provider').notNull().default('openrouter'),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    negativePrompt: text('negative_prompt'),
    storageProvider: text('storage_provider'),
    storageBucket: text('storage_bucket'),
    storagePath: text('storage_path'),
    sourceUrl: text('source_url'),
    width: integer('width'),
    height: integer('height'),
    status: text('status').notNull().default('created'),
    metadata: jsonb('metadata').notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index('zen_generated_images_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    index('zen_generated_images_conversation_idx').on(table.conversationId),
    check(
      'zen_generated_images_provider_check',
      sql`${table.provider} in ('openrouter', 'external', 'local')`
    ),
    check(
      'zen_generated_images_storage_provider_check',
      sql`${table.storageProvider} is null or ${table.storageProvider} in ('external', 'local')`
    ),
    check(
      'zen_generated_images_status_check',
      sql`${table.status} in ('created', 'stored', 'failed', 'deleted')`
    ),
  ]
)
