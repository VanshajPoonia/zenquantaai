import 'server-only'

import { desc, eq } from 'drizzle-orm'
import {
  AuthUser,
  Subscription,
  SubscriptionTier,
  UsageLimitOverride,
} from '@/types'
import { PLAN_CONFIGS } from '@/lib/config'
import { getDatabaseClient } from '../client'
import { zenSubscriptions, zenUsageLimitOverrides } from '../schema'
import { compactObject, toIsoString, toNumber } from './helpers'
import { neonProfilesRepository } from './profiles'

type SubscriptionRow = typeof zenSubscriptions.$inferSelect
type SubscriptionInsert = typeof zenSubscriptions.$inferInsert
type OverrideRow = typeof zenUsageLimitOverrides.$inferSelect
type OverrideInsert = typeof zenUsageLimitOverrides.$inferInsert

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
    userId: row.userId,
    tier: row.tier as SubscriptionTier,
    status: row.status as Subscription['status'],
    displayMultiplier: toNumber(row.displayMultiplier),
    planPriceUsd: toNumber(row.planPriceUsd),
    coreTokensIncluded: row.coreTokensIncluded,
    coreTokensUsed: row.coreTokensUsed,
    tierTokensIncluded: row.tierTokensIncluded,
    tierTokensUsed: row.tierTokensUsed,
    imageCreditsIncluded: row.imageCreditsIncluded,
    imageCreditsUsed: row.imageCreditsUsed,
    dailyMessageLimit: row.dailyMessageLimit,
    dailyMessageCount: row.dailyMessageCount,
    maxInputTokensPerRequest: row.maxInputTokensPerRequest,
    maxOutputTokensPerRequest: row.maxOutputTokensPerRequest,
    maxImagesPerDay: row.maxImagesPerDay,
    dailyImageCount: row.dailyImageCount,
    currentPeriodStartedAt: toIsoString(row.currentPeriodStartedAt),
    currentPeriodEndsAt: toIsoString(row.currentPeriodEndsAt),
    lastDailyResetAt: toIsoString(row.lastDailyResetAt),
    notes: row.notes,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function rowToOverride(row: OverrideRow): UsageLimitOverride {
  return {
    id: row.id,
    userId: row.userId,
    coreTokensIncluded: row.coreTokensIncluded,
    tierTokensIncluded: row.tierTokensIncluded,
    imageCreditsIncluded: row.imageCreditsIncluded,
    dailyMessageLimit: row.dailyMessageLimit,
    maxInputTokensPerRequest: row.maxInputTokensPerRequest,
    maxOutputTokensPerRequest: row.maxOutputTokensPerRequest,
    maxImagesPerDay: row.maxImagesPerDay,
    allowedModelOverrides: row.allowedModelOverrides,
    notes: row.notes,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function buildPlanInsert(
  userId: string,
  tier: SubscriptionTier,
  now = new Date()
): Omit<SubscriptionInsert, 'id' | 'createdAt' | 'updatedAt'> {
  const plan = PLAN_CONFIGS[tier]
  const periodEnd = addDays(now, 30)

  return {
    userId,
    tier,
    status: 'active',
    displayMultiplier: String(plan.displayMultiplier),
    planPriceUsd: String(plan.priceUsd),
    coreTokensIncluded: plan.coreTokens,
    coreTokensUsed: 0,
    tierTokensIncluded: plan.tierTokens,
    tierTokensUsed: 0,
    imageCreditsIncluded: plan.imageCredits,
    imageCreditsUsed: 0,
    dailyMessageLimit: plan.dailyMessageLimit,
    dailyMessageCount: 0,
    maxInputTokensPerRequest: plan.maxInputTokensPerRequest,
    maxOutputTokensPerRequest: plan.maxOutputTokensPerRequest,
    maxImagesPerDay: plan.maxImagesPerDay,
    dailyImageCount: 0,
    currentPeriodStartedAt: now,
    currentPeriodEndsAt: periodEnd,
    lastDailyResetAt: now,
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

    patch[field] = null
  }

  return patch
}

class NeonUsageLimitOverridesRepository {
  async list(): Promise<UsageLimitOverride[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenUsageLimitOverrides)
      .orderBy(desc(zenUsageLimitOverrides.updatedAt))

    return rows.map(rowToOverride)
  }

  async getByUserId(userId: string): Promise<UsageLimitOverride | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenUsageLimitOverrides)
      .where(eq(zenUsageLimitOverrides.userId, userId))
      .limit(1)

    return rows[0] ? rowToOverride(rows[0]) : null
  }

  async upsert(
    userId: string,
    patch: Partial<UsageLimitOverride>
  ): Promise<UsageLimitOverride> {
    const values = compactObject<OverrideInsert>({
      userId,
      coreTokensIncluded: patch.coreTokensIncluded,
      tierTokensIncluded: patch.tierTokensIncluded,
      imageCreditsIncluded: patch.imageCreditsIncluded,
      dailyMessageLimit: patch.dailyMessageLimit,
      maxInputTokensPerRequest: patch.maxInputTokensPerRequest,
      maxOutputTokensPerRequest: patch.maxOutputTokensPerRequest,
      maxImagesPerDay: patch.maxImagesPerDay,
      allowedModelOverrides: patch.allowedModelOverrides,
      notes: patch.notes,
      updatedAt: new Date(),
    }) as OverrideInsert

    const rows = await getDatabaseClient()
      .insert(zenUsageLimitOverrides)
      .values(values)
      .onConflictDoUpdate({
        target: zenUsageLimitOverrides.userId,
        set: {
          ...values,
          updatedAt: new Date(),
        },
      })
      .returning()

    return rowToOverride(rows[0])
  }
}

class NeonSubscriptionsRepository {
  async list(): Promise<Subscription[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenSubscriptions)
      .orderBy(desc(zenSubscriptions.updatedAt))

    return rows.map(rowToSubscription)
  }

  async getByUserId(userId: string): Promise<Subscription | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenSubscriptions)
      .where(eq(zenSubscriptions.userId, userId))
      .limit(1)

    return rows[0] ? rowToSubscription(rows[0]) : null
  }

  async ensureForUser(user: AuthUser): Promise<Subscription> {
    await neonProfilesRepository.ensureFromAuthUser(user)

    const existing = await this.getByUserId(user.id)
    if (existing) {
      return await this.refreshUsageWindow(existing)
    }

    const created = await getDatabaseClient()
      .insert(zenSubscriptions)
      .values(buildPlanInsert(user.id, 'free'))
      .onConflictDoNothing({ target: zenSubscriptions.userId })
      .returning()

    return created[0]
      ? rowToSubscription(created[0])
      : (await this.getByUserId(user.id))!
  }

  async refreshUsageWindow(subscription: Subscription): Promise<Subscription> {
    const now = new Date()
    const patch: Partial<SubscriptionInsert> = {}

    if (new Date(subscription.currentPeriodEndsAt).getTime() <= now.getTime()) {
      const reset = buildPlanInsert(subscription.userId, subscription.tier, now)
      patch.coreTokensIncluded = reset.coreTokensIncluded
      patch.coreTokensUsed = 0
      patch.tierTokensIncluded = reset.tierTokensIncluded
      patch.tierTokensUsed = 0
      patch.imageCreditsIncluded = reset.imageCreditsIncluded
      patch.imageCreditsUsed = 0
      patch.dailyMessageLimit = reset.dailyMessageLimit
      patch.dailyMessageCount = 0
      patch.maxInputTokensPerRequest = reset.maxInputTokensPerRequest
      patch.maxOutputTokensPerRequest = reset.maxOutputTokensPerRequest
      patch.maxImagesPerDay = reset.maxImagesPerDay
      patch.dailyImageCount = 0
      patch.currentPeriodStartedAt = reset.currentPeriodStartedAt
      patch.currentPeriodEndsAt = reset.currentPeriodEndsAt
      patch.lastDailyResetAt = reset.lastDailyResetAt
      patch.displayMultiplier = reset.displayMultiplier
      patch.planPriceUsd = reset.planPriceUsd
    } else if (
      toIsoDay(subscription.lastDailyResetAt) !== toIsoDay(now.toISOString())
    ) {
      patch.dailyMessageCount = 0
      patch.dailyImageCount = 0
      patch.lastDailyResetAt = now
    }

    if (Object.keys(patch).length === 0) {
      return subscription
    }

    const rows = await getDatabaseClient()
      .update(zenSubscriptions)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(zenSubscriptions.userId, subscription.userId))
      .returning()

    return rowToSubscription(rows[0])
  }

  async updateTier(
    userId: string,
    tier: SubscriptionTier,
    note?: string | null
  ) {
    const rows = await getDatabaseClient()
      .update(zenSubscriptions)
      .set({
        ...buildPlanInsert(userId, tier),
        notes: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(zenSubscriptions.userId, userId))
      .returning()

    return rowToSubscription(rows[0])
  }

  async updateStatus(userId: string, status: Subscription['status']) {
    const rows = await getDatabaseClient()
      .update(zenSubscriptions)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(zenSubscriptions.userId, userId))
      .returning()

    return rowToSubscription(rows[0])
  }

  async updateManual(
    userId: string,
    patch: Partial<Subscription>
  ): Promise<Subscription> {
    const values = compactObject<Partial<SubscriptionInsert>>({
      ...(typeof patch.planPriceUsd !== 'undefined'
        ? { planPriceUsd: String(patch.planPriceUsd) }
        : {}),
      ...(typeof patch.displayMultiplier !== 'undefined'
        ? { displayMultiplier: String(patch.displayMultiplier) }
        : {}),
      coreTokensIncluded: patch.coreTokensIncluded,
      coreTokensUsed: patch.coreTokensUsed,
      tierTokensIncluded: patch.tierTokensIncluded,
      tierTokensUsed: patch.tierTokensUsed,
      imageCreditsIncluded: patch.imageCreditsIncluded,
      imageCreditsUsed: patch.imageCreditsUsed,
      dailyMessageLimit: patch.dailyMessageLimit,
      dailyMessageCount: patch.dailyMessageCount,
      maxInputTokensPerRequest: patch.maxInputTokensPerRequest,
      maxOutputTokensPerRequest: patch.maxOutputTokensPerRequest,
      maxImagesPerDay: patch.maxImagesPerDay,
      dailyImageCount: patch.dailyImageCount,
      notes: patch.notes,
      updatedAt: new Date(),
    })

    const rows = await getDatabaseClient()
      .update(zenSubscriptions)
      .set(values)
      .where(eq(zenSubscriptions.userId, userId))
      .returning()

    return rowToSubscription(rows[0])
  }
}

export const neonSubscriptionsRepository = new NeonSubscriptionsRepository()
export const neonUsageLimitOverridesRepository =
  new NeonUsageLimitOverridesRepository()
