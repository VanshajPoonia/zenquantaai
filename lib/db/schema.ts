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
  uuid,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}

export const zenProfiles = pgTable(
  'zen_profiles',
  {
    userId: uuid('user_id').primaryKey(),
    loginId: text('login_id'),
    email: text('email'),
    role: text('role').notNull().default('user'),
    ...timestamps,
  },
  (table) => [
    check('zen_profiles_role_check', sql`${table.role} in ('user', 'admin')`),
  ]
)

export const zenProjects = pgTable(
  'zen_projects',
  {
    id: text('id').notNull(),
    userId: uuid('user_id').notNull(),
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
    userId: uuid('user_id').notNull(),
    projectId: text('project_id'),
    title: text('title').notNull(),
    mode: text('mode').notNull(),
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
    status: text('status'),
    model: text('model'),
    provider: text('provider'),
    error: text('error'),
    parentUserMessageId: text('parent_user_message_id'),
    branchLabel: text('branch_label'),
    attachments: jsonb('attachments').notNull().default([]),
    usage: jsonb('usage'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('zen_messages_conversation_created_idx').on(
      table.conversationId,
      table.createdAt
    ),
  ]
)

export const zenPromptLibrary = pgTable(
  'zen_prompt_library',
  {
    id: text('id').notNull(),
    userId: uuid('user_id').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    mode: text('mode').notNull().default('any'),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index('zen_prompt_library_user_updated_idx').on(table.userId, table.updatedAt),
  ]
)

export const zenUserSettings = pgTable('zen_user_settings', {
  userId: uuid('user_id').primaryKey(),
  payload: jsonb('payload').notNull().default({}),
  ...timestamps,
})

export const zenSubscriptions = pgTable(
  'zen_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().unique(),
    tier: text('tier').notNull().default('free'),
    status: text('status').notNull().default('active'),
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
  ]
)

export const zenUsageLimitOverrides = pgTable('zen_usage_limit_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),
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

export const zenUsageEvents = pgTable(
  'zen_usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => zenSubscriptions.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id'),
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
    userId: uuid('user_id').notNull(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => zenSubscriptions.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id'),
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
    userId: uuid('user_id').notNull(),
    currentTier: text('current_tier').notNull(),
    requestedTier: text('requested_tier').notNull(),
    note: text('note'),
    contact: text('contact'),
    adminNote: text('admin_note'),
    status: text('status').notNull().default('pending'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
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

export const zenAdminAuditLogs = pgTable('zen_admin_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: uuid('admin_user_id').notNull(),
  targetUserId: uuid('target_user_id').notNull(),
  action: text('action').notNull(),
  details: jsonb('details').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const zenAssistantRecommendationEvents = pgTable(
  'zen_assistant_recommendation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    conversationId: text('conversation_id'),
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
