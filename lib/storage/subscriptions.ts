import {
  AuthUser,
  Subscription,
  SubscriptionTier,
  UsageLimitOverride,
} from '@/types'
import { PLAN_CONFIGS } from '@/lib/config'
import { neonQuery, toNumber } from './neon'
import { profilesStore } from './profiles'

type SubscriptionRow = {
  id: string
  user_id: string
  tier: SubscriptionTier
  status: Subscription['status']
  display_multiplier: number | string
  plan_price_usd: number | string
  core_tokens_included: number | string
  core_tokens_used: number | string
  tier_tokens_included: number | string
  tier_tokens_used: number | string
  image_credits_included: number | string
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
  core_tokens_included: number | string | null
  tier_tokens_included: number | string | null
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

type RebasableUsageLimitField =
  | 'coreTokensIncluded'
  | 'tierTokensIncluded'
  | 'imageCreditsIncluded'
  | 'dailyMessageLimit'
  | 'maxInputTokensPerRequest'
  | 'maxOutputTokensPerRequest'
  | 'maxImagesPerDay'

const REBASABLE_USAGE_LIMIT_FIELDS: RebasableUsageLimitField[] = [
  'coreTokensIncluded',
  'tierTokensIncluded',
  'imageCreditsIncluded',
  'dailyMessageLimit',
  'maxInputTokensPerRequest',
  'maxOutputTokensPerRequest',
  'maxImagesPerDay',
]

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
    displayMultiplier: toNumber(row.display_multiplier),
    planPriceUsd: toNumber(row.plan_price_usd),
    coreTokensIncluded: toNumber(row.core_tokens_included),
    coreTokensUsed: toNumber(row.core_tokens_used),
    tierTokensIncluded: toNumber(row.tier_tokens_included),
    tierTokensUsed: toNumber(row.tier_tokens_used),
    imageCreditsIncluded: toNumber(row.image_credits_included),
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
    coreTokensIncluded:
      row.core_tokens_included == null ? null : toNumber(row.core_tokens_included),
    tierTokensIncluded:
      row.tier_tokens_included == null ? null : toNumber(row.tier_tokens_included),
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

function getSubscriptionFieldValue(
  subscription: Subscription,
  field: RebasableUsageLimitField
): number {
  switch (field) {
    case 'coreTokensIncluded':
      return subscription.coreTokensIncluded
    case 'tierTokensIncluded':
      return subscription.tierTokensIncluded
    case 'imageCreditsIncluded':
      return subscription.imageCreditsIncluded
    case 'dailyMessageLimit':
      return subscription.dailyMessageLimit
    case 'maxInputTokensPerRequest':
      return subscription.maxInputTokensPerRequest
    case 'maxOutputTokensPerRequest':
      return subscription.maxOutputTokensPerRequest
    case 'maxImagesPerDay':
      return subscription.maxImagesPerDay
  }
}

function getPlanFieldValue(
  tier: SubscriptionTier,
  field: RebasableUsageLimitField
): number {
  const plan = PLAN_CONFIGS[tier]

  switch (field) {
    case 'coreTokensIncluded':
      return plan.coreTokens
    case 'tierTokensIncluded':
      return plan.tierTokens
    case 'imageCreditsIncluded':
      return plan.imageCredits
    case 'dailyMessageLimit':
      return plan.dailyMessageLimit
    case 'maxInputTokensPerRequest':
      return plan.maxInputTokensPerRequest
    case 'maxOutputTokensPerRequest':
      return plan.maxOutputTokensPerRequest
    case 'maxImagesPerDay':
      return plan.maxImagesPerDay
  }
}

export function buildTierRebasedUsageOverridePatch(input: {
  currentSubscription: Subscription
  currentOverride: UsageLimitOverride | null
  nextTier: SubscriptionTier
  submittedOverrides?: Partial<Record<RebasableUsageLimitField, number | null | undefined>>
}): Partial<UsageLimitOverride> {
  const patch: Partial<UsageLimitOverride> = {}
  const tierChanged = input.currentSubscription.tier !== input.nextTier

  for (const field of REBASABLE_USAGE_LIMIT_FIELDS) {
    const currentPlanValue = getSubscriptionFieldValue(input.currentSubscription, field)
    const nextPlanValue = getPlanFieldValue(input.nextTier, field)
    const currentOverrideValue = input.currentOverride?.[field]
    const submittedValue = input.submittedOverrides?.[field]
    const submittedProvided = typeof submittedValue !== 'undefined'

    if (submittedProvided) {
      if (submittedValue === null) {
        patch[field] = null
        continue
      }

      if (tierChanged && (submittedValue === currentPlanValue || submittedValue === nextPlanValue)) {
        patch[field] = null
        continue
      }

      patch[field] = submittedValue
      continue
    }

    if (!tierChanged || currentOverrideValue == null) {
      continue
    }

    // Tier changes should reset old effective limits to the next plan defaults
    // unless the admin explicitly submits a new custom value in the same request.
    patch[field] = null
  }

  return patch
}

class UsageLimitOverridesStore {
  async list(): Promise<UsageLimitOverride[]> {
    const rows = await neonQuery<OverrideRow>(
      'select * from public.zen_usage_limit_overrides order by updated_at desc'
    )

    return rows.map(rowToOverride)
  }

  async getByUserId(userId: string): Promise<UsageLimitOverride | null> {
    const rows = await neonQuery<OverrideRow>(
      'select * from public.zen_usage_limit_overrides where user_id = $1',
      [userId]
    )

    return rows[0] ? rowToOverride(rows[0]) : null
  }

  async upsert(
    userId: string,
    patch: Partial<UsageLimitOverride>
  ): Promise<UsageLimitOverride> {
    const rows = await neonQuery<OverrideRow>(
      `
        insert into public.zen_usage_limit_overrides (
          user_id,
          core_tokens_included,
          tier_tokens_included,
          image_credits_included,
          daily_message_limit,
          max_input_tokens_per_request,
          max_output_tokens_per_request,
          max_images_per_day,
          allowed_model_overrides,
          notes
        )
        values ($1, $3, $5, $7, $9, $11, $13, $15, $17, $19)
        on conflict (user_id) do update
        set core_tokens_included = case when $2 then excluded.core_tokens_included else zen_usage_limit_overrides.core_tokens_included end,
            tier_tokens_included = case when $4 then excluded.tier_tokens_included else zen_usage_limit_overrides.tier_tokens_included end,
            image_credits_included = case when $6 then excluded.image_credits_included else zen_usage_limit_overrides.image_credits_included end,
            daily_message_limit = case when $8 then excluded.daily_message_limit else zen_usage_limit_overrides.daily_message_limit end,
            max_input_tokens_per_request = case when $10 then excluded.max_input_tokens_per_request else zen_usage_limit_overrides.max_input_tokens_per_request end,
            max_output_tokens_per_request = case when $12 then excluded.max_output_tokens_per_request else zen_usage_limit_overrides.max_output_tokens_per_request end,
            max_images_per_day = case when $14 then excluded.max_images_per_day else zen_usage_limit_overrides.max_images_per_day end,
            allowed_model_overrides = case when $16 then excluded.allowed_model_overrides else zen_usage_limit_overrides.allowed_model_overrides end,
            notes = case when $18 then excluded.notes else zen_usage_limit_overrides.notes end
        returning *
      `,
      [
        userId,
        typeof patch.coreTokensIncluded !== 'undefined',
        patch.coreTokensIncluded ?? null,
        typeof patch.tierTokensIncluded !== 'undefined',
        patch.tierTokensIncluded ?? null,
        typeof patch.imageCreditsIncluded !== 'undefined',
        patch.imageCreditsIncluded ?? null,
        typeof patch.dailyMessageLimit !== 'undefined',
        patch.dailyMessageLimit ?? null,
        typeof patch.maxInputTokensPerRequest !== 'undefined',
        patch.maxInputTokensPerRequest ?? null,
        typeof patch.maxOutputTokensPerRequest !== 'undefined',
        patch.maxOutputTokensPerRequest ?? null,
        typeof patch.maxImagesPerDay !== 'undefined',
        patch.maxImagesPerDay ?? null,
        typeof patch.allowedModelOverrides !== 'undefined',
        patch.allowedModelOverrides ?? null,
        typeof patch.notes !== 'undefined',
        patch.notes ?? null,
      ]
    )

    return rowToOverride(rows[0])
  }
}

class SubscriptionsStore {
  async list(): Promise<Subscription[]> {
    const rows = await neonQuery<SubscriptionRow>(
      'select * from public.zen_subscriptions order by updated_at desc'
    )

    return rows.map(rowToSubscription)
  }

  async getByUserId(userId: string): Promise<Subscription | null> {
    const rows = await neonQuery<SubscriptionRow>(
      'select * from public.zen_subscriptions where user_id = $1',
      [userId]
    )

    return rows[0] ? rowToSubscription(rows[0]) : null
  }

  async ensureForUser(user: AuthUser): Promise<Subscription> {
    await profilesStore.ensureFromAuthUser(user)

    const existing = await this.getByUserId(user.id)
    if (existing) {
      return await this.refreshUsageWindow(existing)
    }

    const created = await this.insertPlanRow(buildPlanRow(user.id, 'free'))

    return rowToSubscription(created)
  }

  private async insertPlanRow(
    planRow: Omit<SubscriptionRow, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SubscriptionRow> {
    const rows = await neonQuery<SubscriptionRow>(
      `
        insert into public.zen_subscriptions (
          user_id,
          tier,
          status,
          display_multiplier,
          plan_price_usd,
          core_tokens_included,
          core_tokens_used,
          tier_tokens_included,
          tier_tokens_used,
          image_credits_included,
          image_credits_used,
          daily_message_limit,
          daily_message_count,
          max_input_tokens_per_request,
          max_output_tokens_per_request,
          max_images_per_day,
          daily_image_count,
          current_period_started_at,
          current_period_ends_at,
          last_daily_reset_at,
          notes
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
        on conflict (user_id) do update
        set tier = excluded.tier,
            status = excluded.status,
            display_multiplier = excluded.display_multiplier,
            plan_price_usd = excluded.plan_price_usd,
            core_tokens_included = excluded.core_tokens_included,
            core_tokens_used = excluded.core_tokens_used,
            tier_tokens_included = excluded.tier_tokens_included,
            tier_tokens_used = excluded.tier_tokens_used,
            image_credits_included = excluded.image_credits_included,
            image_credits_used = excluded.image_credits_used,
            daily_message_limit = excluded.daily_message_limit,
            daily_message_count = excluded.daily_message_count,
            max_input_tokens_per_request = excluded.max_input_tokens_per_request,
            max_output_tokens_per_request = excluded.max_output_tokens_per_request,
            max_images_per_day = excluded.max_images_per_day,
            daily_image_count = excluded.daily_image_count,
            current_period_started_at = excluded.current_period_started_at,
            current_period_ends_at = excluded.current_period_ends_at,
            last_daily_reset_at = excluded.last_daily_reset_at,
            notes = excluded.notes
        returning *
      `,
      [
        planRow.user_id,
        planRow.tier,
        planRow.status,
        planRow.display_multiplier,
        planRow.plan_price_usd,
        planRow.core_tokens_included,
        planRow.core_tokens_used,
        planRow.tier_tokens_included,
        planRow.tier_tokens_used,
        planRow.image_credits_included,
        planRow.image_credits_used,
        planRow.daily_message_limit,
        planRow.daily_message_count,
        planRow.max_input_tokens_per_request,
        planRow.max_output_tokens_per_request,
        planRow.max_images_per_day,
        planRow.daily_image_count,
        planRow.current_period_started_at,
        planRow.current_period_ends_at,
        planRow.last_daily_reset_at,
        planRow.notes,
      ]
    )

    return rows[0]
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

    const rows = await neonQuery<SubscriptionRow>(
      `
        update public.zen_subscriptions
        set core_tokens_included = coalesce($2, core_tokens_included),
            core_tokens_used = coalesce($3, core_tokens_used),
            tier_tokens_included = coalesce($4, tier_tokens_included),
            tier_tokens_used = coalesce($5, tier_tokens_used),
            image_credits_included = coalesce($6, image_credits_included),
            image_credits_used = coalesce($7, image_credits_used),
            daily_message_limit = coalesce($8, daily_message_limit),
            daily_message_count = coalesce($9, daily_message_count),
            max_input_tokens_per_request = coalesce($10, max_input_tokens_per_request),
            max_output_tokens_per_request = coalesce($11, max_output_tokens_per_request),
            max_images_per_day = coalesce($12, max_images_per_day),
            daily_image_count = coalesce($13, daily_image_count),
            current_period_started_at = coalesce($14, current_period_started_at),
            current_period_ends_at = coalesce($15, current_period_ends_at),
            last_daily_reset_at = coalesce($16, last_daily_reset_at),
            display_multiplier = coalesce($17, display_multiplier),
            plan_price_usd = coalesce($18, plan_price_usd)
        where user_id = $1
        returning *
      `,
      [
        subscription.userId,
        patch.core_tokens_included ?? null,
        patch.core_tokens_used ?? null,
        patch.tier_tokens_included ?? null,
        patch.tier_tokens_used ?? null,
        patch.image_credits_included ?? null,
        patch.image_credits_used ?? null,
        patch.daily_message_limit ?? null,
        patch.daily_message_count ?? null,
        patch.max_input_tokens_per_request ?? null,
        patch.max_output_tokens_per_request ?? null,
        patch.max_images_per_day ?? null,
        patch.daily_image_count ?? null,
        patch.current_period_started_at ?? null,
        patch.current_period_ends_at ?? null,
        patch.last_daily_reset_at ?? null,
        patch.display_multiplier ?? null,
        patch.plan_price_usd ?? null,
      ]
    )

    return rowToSubscription(rows[0])
  }

  async updateTier(userId: string, tier: SubscriptionTier, note?: string | null) {
    const planRow = {
      ...buildPlanRow(userId, tier),
      notes: note ?? null,
    }
    const rows = await neonQuery<SubscriptionRow>(
      `
        update public.zen_subscriptions
        set tier = $2,
            status = $3,
            display_multiplier = $4,
            plan_price_usd = $5,
            core_tokens_included = $6,
            core_tokens_used = $7,
            tier_tokens_included = $8,
            tier_tokens_used = $9,
            image_credits_included = $10,
            image_credits_used = $11,
            daily_message_limit = $12,
            daily_message_count = $13,
            max_input_tokens_per_request = $14,
            max_output_tokens_per_request = $15,
            max_images_per_day = $16,
            daily_image_count = $17,
            current_period_started_at = $18,
            current_period_ends_at = $19,
            last_daily_reset_at = $20,
            notes = $21
        where user_id = $1
        returning *
      `,
      [
        userId,
        planRow.tier,
        planRow.status,
        planRow.display_multiplier,
        planRow.plan_price_usd,
        planRow.core_tokens_included,
        planRow.core_tokens_used,
        planRow.tier_tokens_included,
        planRow.tier_tokens_used,
        planRow.image_credits_included,
        planRow.image_credits_used,
        planRow.daily_message_limit,
        planRow.daily_message_count,
        planRow.max_input_tokens_per_request,
        planRow.max_output_tokens_per_request,
        planRow.max_images_per_day,
        planRow.daily_image_count,
        planRow.current_period_started_at,
        planRow.current_period_ends_at,
        planRow.last_daily_reset_at,
        planRow.notes,
      ]
    )

    return rowToSubscription(rows[0])
  }

  async updateStatus(userId: string, status: Subscription['status']) {
    const rows = await neonQuery<SubscriptionRow>(
      `
        update public.zen_subscriptions
        set status = $2
        where user_id = $1
        returning *
      `,
      [userId, status]
    )

    return rowToSubscription(rows[0])
  }

  async updateManual(
    userId: string,
    patch: Partial<Subscription>
  ): Promise<Subscription> {
    const rows = await neonQuery<SubscriptionRow>(
      `
        update public.zen_subscriptions
        set plan_price_usd = case when $2 then $3 else plan_price_usd end,
            display_multiplier = case when $4 then $5 else display_multiplier end,
            core_tokens_included = case when $6 then $7 else core_tokens_included end,
            core_tokens_used = case when $8 then $9 else core_tokens_used end,
            tier_tokens_included = case when $10 then $11 else tier_tokens_included end,
            tier_tokens_used = case when $12 then $13 else tier_tokens_used end,
            image_credits_included = case when $14 then $15 else image_credits_included end,
            image_credits_used = case when $16 then $17 else image_credits_used end,
            daily_message_limit = case when $18 then $19 else daily_message_limit end,
            daily_message_count = case when $20 then $21 else daily_message_count end,
            max_input_tokens_per_request = case when $22 then $23 else max_input_tokens_per_request end,
            max_output_tokens_per_request = case when $24 then $25 else max_output_tokens_per_request end,
            max_images_per_day = case when $26 then $27 else max_images_per_day end,
            daily_image_count = case when $28 then $29 else daily_image_count end,
            notes = case when $30 then $31 else notes end
        where user_id = $1
        returning *
      `,
      [
        userId,
        typeof patch.planPriceUsd !== 'undefined',
        patch.planPriceUsd ?? null,
        typeof patch.displayMultiplier !== 'undefined',
        patch.displayMultiplier ?? null,
        typeof patch.coreTokensIncluded !== 'undefined',
        patch.coreTokensIncluded ?? null,
        typeof patch.coreTokensUsed !== 'undefined',
        patch.coreTokensUsed ?? null,
        typeof patch.tierTokensIncluded !== 'undefined',
        patch.tierTokensIncluded ?? null,
        typeof patch.tierTokensUsed !== 'undefined',
        patch.tierTokensUsed ?? null,
        typeof patch.imageCreditsIncluded !== 'undefined',
        patch.imageCreditsIncluded ?? null,
        typeof patch.imageCreditsUsed !== 'undefined',
        patch.imageCreditsUsed ?? null,
        typeof patch.dailyMessageLimit !== 'undefined',
        patch.dailyMessageLimit ?? null,
        typeof patch.dailyMessageCount !== 'undefined',
        patch.dailyMessageCount ?? null,
        typeof patch.maxInputTokensPerRequest !== 'undefined',
        patch.maxInputTokensPerRequest ?? null,
        typeof patch.maxOutputTokensPerRequest !== 'undefined',
        patch.maxOutputTokensPerRequest ?? null,
        typeof patch.maxImagesPerDay !== 'undefined',
        patch.maxImagesPerDay ?? null,
        typeof patch.dailyImageCount !== 'undefined',
        patch.dailyImageCount ?? null,
        typeof patch.notes !== 'undefined',
        patch.notes ?? null,
      ]
    )

    return rowToSubscription(rows[0])
  }
}

export const subscriptionsStore = new SubscriptionsStore()
export const usageLimitOverridesStore = new UsageLimitOverridesStore()
