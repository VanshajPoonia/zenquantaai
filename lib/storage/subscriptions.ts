import {
  AuthUser,
  Subscription,
  SubscriptionTier,
  UsageLimitOverride,
} from '@/types'
import { PLAN_CONFIGS } from '@/lib/config'
import { supabaseRequest } from './supabase'
import { profilesStore } from './profiles'

const SUBSCRIPTIONS_TABLE = 'zen_subscriptions'
const OVERRIDES_TABLE = 'zen_usage_limit_overrides'

type SubscriptionRow = {
  id: string
  user_id: string
  tier: SubscriptionTier
  status: Subscription['status']
  display_multiplier: number
  plan_price_usd: number
  core_tokens_included: number
  core_tokens_used: number
  tier_tokens_included: number
  tier_tokens_used: number
  image_credits_included: number
  image_credits_used: number
  daily_message_limit: number
  daily_message_count: number
  max_input_tokens_per_request: number
  max_output_tokens_per_request: number
  max_images_per_day: number
  daily_image_count: number
  current_period_started_at: string
  current_period_ends_at: string
  last_daily_reset_at: string
  notes: string | null
  created_at: string
  updated_at: string
}

type OverrideRow = {
  id: string
  user_id: string
  core_tokens_included: number | null
  tier_tokens_included: number | null
  image_credits_included: number | null
  daily_message_limit: number | null
  max_input_tokens_per_request: number | null
  max_output_tokens_per_request: number | null
  max_images_per_day: number | null
  allowed_model_overrides: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    tier: row.tier,
    status: row.status,
    displayMultiplier: row.display_multiplier,
    planPriceUsd: row.plan_price_usd,
    coreTokensIncluded: row.core_tokens_included,
    coreTokensUsed: row.core_tokens_used,
    tierTokensIncluded: row.tier_tokens_included,
    tierTokensUsed: row.tier_tokens_used,
    imageCreditsIncluded: row.image_credits_included,
    imageCreditsUsed: row.image_credits_used,
    dailyMessageLimit: row.daily_message_limit,
    dailyMessageCount: row.daily_message_count,
    maxInputTokensPerRequest: row.max_input_tokens_per_request,
    maxOutputTokensPerRequest: row.max_output_tokens_per_request,
    maxImagesPerDay: row.max_images_per_day,
    dailyImageCount: row.daily_image_count,
    currentPeriodStartedAt: row.current_period_started_at,
    currentPeriodEndsAt: row.current_period_ends_at,
    lastDailyResetAt: row.last_daily_reset_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToOverride(row: OverrideRow): UsageLimitOverride {
  return {
    id: row.id,
    userId: row.user_id,
    coreTokensIncluded: row.core_tokens_included,
    tierTokensIncluded: row.tier_tokens_included,
    imageCreditsIncluded: row.image_credits_included,
    dailyMessageLimit: row.daily_message_limit,
    maxInputTokensPerRequest: row.max_input_tokens_per_request,
    maxOutputTokensPerRequest: row.max_output_tokens_per_request,
    maxImagesPerDay: row.max_images_per_day,
    allowedModelOverrides: row.allowed_model_overrides,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildPlanRow(
  userId: string,
  tier: SubscriptionTier,
  now = new Date()
): Omit<SubscriptionRow, 'id' | 'created_at' | 'updated_at'> {
  const plan = PLAN_CONFIGS[tier]
  const periodStart = now.toISOString()
  const periodEnd = addDays(now, 30).toISOString()

  return {
    user_id: userId,
    tier,
    status: 'active',
    display_multiplier: plan.displayMultiplier,
    plan_price_usd: plan.priceUsd,
    core_tokens_included: plan.coreTokens,
    core_tokens_used: 0,
    tier_tokens_included: plan.tierTokens,
    tier_tokens_used: 0,
    image_credits_included: plan.imageCredits,
    image_credits_used: 0,
    daily_message_limit: plan.dailyMessageLimit,
    daily_message_count: 0,
    max_input_tokens_per_request: plan.maxInputTokensPerRequest,
    max_output_tokens_per_request: plan.maxOutputTokensPerRequest,
    max_images_per_day: plan.maxImagesPerDay,
    daily_image_count: 0,
    current_period_started_at: periodStart,
    current_period_ends_at: periodEnd,
    last_daily_reset_at: periodStart,
    notes: null,
  }
}

function toIsoDay(input: string): string {
  return new Date(input).toISOString().slice(0, 10)
}

class UsageLimitOverridesStore {
  async getByUserId(userId: string): Promise<UsageLimitOverride | null> {
    const rows = await supabaseRequest<OverrideRow[]>(OVERRIDES_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        select: '*',
      },
    })

    return rows[0] ? rowToOverride(rows[0]) : null
  }

  async upsert(
    userId: string,
    patch: Partial<UsageLimitOverride>
  ): Promise<UsageLimitOverride> {
    const rows = await supabaseRequest<OverrideRow[]>(OVERRIDES_TABLE, {
      method: 'POST',
      body: {
        user_id: userId,
        ...(typeof patch.coreTokensIncluded !== 'undefined'
          ? { core_tokens_included: patch.coreTokensIncluded }
          : {}),
        ...(typeof patch.tierTokensIncluded !== 'undefined'
          ? { tier_tokens_included: patch.tierTokensIncluded }
          : {}),
        ...(typeof patch.imageCreditsIncluded !== 'undefined'
          ? { image_credits_included: patch.imageCreditsIncluded }
          : {}),
        ...(typeof patch.dailyMessageLimit !== 'undefined'
          ? { daily_message_limit: patch.dailyMessageLimit }
          : {}),
        ...(typeof patch.maxInputTokensPerRequest !== 'undefined'
          ? { max_input_tokens_per_request: patch.maxInputTokensPerRequest }
          : {}),
        ...(typeof patch.maxOutputTokensPerRequest !== 'undefined'
          ? { max_output_tokens_per_request: patch.maxOutputTokensPerRequest }
          : {}),
        ...(typeof patch.maxImagesPerDay !== 'undefined'
          ? { max_images_per_day: patch.maxImagesPerDay }
          : {}),
        ...(typeof patch.allowedModelOverrides !== 'undefined'
          ? { allowed_model_overrides: patch.allowedModelOverrides }
          : {}),
        ...(typeof patch.notes !== 'undefined' ? { notes: patch.notes } : {}),
      },
      prefer: 'resolution=merge-duplicates,return=representation',
    })

    return rowToOverride(rows[0])
  }
}

class SubscriptionsStore {
  async list(): Promise<Subscription[]> {
    const rows = await supabaseRequest<SubscriptionRow[]>(SUBSCRIPTIONS_TABLE, {
      query: {
        select: '*',
        order: 'updated_at.desc',
      },
    })

    return rows.map(rowToSubscription)
  }

  async getByUserId(userId: string): Promise<Subscription | null> {
    const rows = await supabaseRequest<SubscriptionRow[]>(SUBSCRIPTIONS_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        select: '*',
      },
    })

    return rows[0] ? rowToSubscription(rows[0]) : null
  }

  async ensureForUser(user: AuthUser): Promise<Subscription> {
    await profilesStore.ensureFromAuthUser(user)

    const existing = await this.getByUserId(user.id)
    if (existing) {
      return await this.refreshUsageWindow(existing)
    }

    const created = await supabaseRequest<SubscriptionRow[]>(SUBSCRIPTIONS_TABLE, {
      method: 'POST',
      body: buildPlanRow(user.id, 'free'),
      prefer: 'resolution=merge-duplicates,return=representation',
    })

    return rowToSubscription(created[0])
  }

  async refreshUsageWindow(subscription: Subscription): Promise<Subscription> {
    const now = new Date()
    const patch: Partial<SubscriptionRow> = {}

    if (new Date(subscription.currentPeriodEndsAt).getTime() <= now.getTime()) {
      const reset = buildPlanRow(subscription.userId, subscription.tier, now)
      patch.core_tokens_included = reset.core_tokens_included
      patch.core_tokens_used = 0
      patch.tier_tokens_included = reset.tier_tokens_included
      patch.tier_tokens_used = 0
      patch.image_credits_included = reset.image_credits_included
      patch.image_credits_used = 0
      patch.daily_message_limit = reset.daily_message_limit
      patch.daily_message_count = 0
      patch.max_input_tokens_per_request = reset.max_input_tokens_per_request
      patch.max_output_tokens_per_request = reset.max_output_tokens_per_request
      patch.max_images_per_day = reset.max_images_per_day
      patch.daily_image_count = 0
      patch.current_period_started_at = reset.current_period_started_at
      patch.current_period_ends_at = reset.current_period_ends_at
      patch.last_daily_reset_at = reset.last_daily_reset_at
      patch.display_multiplier = reset.display_multiplier
      patch.plan_price_usd = reset.plan_price_usd
    } else if (
      toIsoDay(subscription.lastDailyResetAt) !== toIsoDay(now.toISOString())
    ) {
      patch.daily_message_count = 0
      patch.daily_image_count = 0
      patch.last_daily_reset_at = now.toISOString()
    }

    if (Object.keys(patch).length === 0) {
      return subscription
    }

    const rows = await supabaseRequest<SubscriptionRow[]>(SUBSCRIPTIONS_TABLE, {
      method: 'PATCH',
      query: {
        user_id: `eq.${subscription.userId}`,
      },
      body: patch,
      prefer: 'return=representation',
    })

    return rowToSubscription(rows[0])
  }

  async updateTier(userId: string, tier: SubscriptionTier, note?: string | null) {
    const rows = await supabaseRequest<SubscriptionRow[]>(SUBSCRIPTIONS_TABLE, {
      method: 'PATCH',
      query: {
        user_id: `eq.${userId}`,
      },
      body: {
        ...buildPlanRow(userId, tier),
        notes: note ?? null,
      },
      prefer: 'return=representation',
    })

    return rowToSubscription(rows[0])
  }

  async updateStatus(userId: string, status: Subscription['status']) {
    const rows = await supabaseRequest<SubscriptionRow[]>(SUBSCRIPTIONS_TABLE, {
      method: 'PATCH',
      query: {
        user_id: `eq.${userId}`,
      },
      body: {
        status,
      },
      prefer: 'return=representation',
    })

    return rowToSubscription(rows[0])
  }

  async updateManual(
    userId: string,
    patch: Partial<Subscription>
  ): Promise<Subscription> {
    const rows = await supabaseRequest<SubscriptionRow[]>(SUBSCRIPTIONS_TABLE, {
      method: 'PATCH',
      query: {
        user_id: `eq.${userId}`,
      },
      body: {
        ...(typeof patch.planPriceUsd !== 'undefined'
          ? { plan_price_usd: patch.planPriceUsd }
          : {}),
        ...(typeof patch.displayMultiplier !== 'undefined'
          ? { display_multiplier: patch.displayMultiplier }
          : {}),
        ...(typeof patch.coreTokensIncluded !== 'undefined'
          ? { core_tokens_included: patch.coreTokensIncluded }
          : {}),
        ...(typeof patch.coreTokensUsed !== 'undefined'
          ? { core_tokens_used: patch.coreTokensUsed }
          : {}),
        ...(typeof patch.tierTokensIncluded !== 'undefined'
          ? { tier_tokens_included: patch.tierTokensIncluded }
          : {}),
        ...(typeof patch.tierTokensUsed !== 'undefined'
          ? { tier_tokens_used: patch.tierTokensUsed }
          : {}),
        ...(typeof patch.imageCreditsIncluded !== 'undefined'
          ? { image_credits_included: patch.imageCreditsIncluded }
          : {}),
        ...(typeof patch.imageCreditsUsed !== 'undefined'
          ? { image_credits_used: patch.imageCreditsUsed }
          : {}),
        ...(typeof patch.dailyMessageLimit !== 'undefined'
          ? { daily_message_limit: patch.dailyMessageLimit }
          : {}),
        ...(typeof patch.dailyMessageCount !== 'undefined'
          ? { daily_message_count: patch.dailyMessageCount }
          : {}),
        ...(typeof patch.maxInputTokensPerRequest !== 'undefined'
          ? { max_input_tokens_per_request: patch.maxInputTokensPerRequest }
          : {}),
        ...(typeof patch.maxOutputTokensPerRequest !== 'undefined'
          ? { max_output_tokens_per_request: patch.maxOutputTokensPerRequest }
          : {}),
        ...(typeof patch.maxImagesPerDay !== 'undefined'
          ? { max_images_per_day: patch.maxImagesPerDay }
          : {}),
        ...(typeof patch.dailyImageCount !== 'undefined'
          ? { daily_image_count: patch.dailyImageCount }
          : {}),
        ...(typeof patch.notes !== 'undefined' ? { notes: patch.notes } : {}),
      },
      prefer: 'return=representation',
    })

    return rowToSubscription(rows[0])
  }
}

export const subscriptionsStore = new SubscriptionsStore()
export const usageLimitOverridesStore = new UsageLimitOverridesStore()
