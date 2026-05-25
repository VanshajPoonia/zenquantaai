import 'server-only'

import {
  AdminAuditLog,
  AssistantFamily,
  AssistantRecommendationAnalyticsSummary,
  AssistantRecommendationEvent,
  DashboardUsageSummary,
  ImageGenerationEvent,
  PlanChangeRequest,
  Profile,
  Subscription,
  SubscriptionTier,
  UsageEvent,
  UsageLimitOverride,
} from '@/types'
import { usdToDisplayedCredits } from '@/lib/config'
import { neonAssistantRecommendationEventsRepository } from './assistant-recommendations'
import { neonConversationRepository } from './conversations'
import {
  neonAdminAuditLogsRepository,
  neonPlanRequestsRepository,
} from './plan-requests'
import { neonProfilesRepository } from './profiles'
import {
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from './subscriptions'
import {
  neonImageGenerationEventsRepository,
  neonUsageEventsRepository,
} from './usage-events'

export interface AdminOverview {
  filters: NormalizedAdminAnalyticsFilters
  activeUsers: number
  usersByTier: Record<Subscription['tier'], number>
  pendingPlanRequests: number
  rawTextCostUsd: number
  displayedTextCostUsd: number
  rawImageCostUsd: number
  displayedImageCostUsd: number
  totalRawCostUsd: number
  totalDisplayedCostUsd: number
  estimatedSubscriptionRevenueUsd: number
  estimatedGrossMarginUsd: number
  requestsToday: number
  mostExpensiveUsers: Array<{
    userId: string
    email: string | null
    loginId: string | null
    displayName: string | null
    displayedCostUsd: number
    rawCostUsd: number
    isUnusuallyHigh: boolean
  }>
  marginByPlan: Array<{
    tier: SubscriptionTier
    activeUsers: number
    estimatedRevenueUsd: number
    rawCostUsd: number
    displayedCostUsd: number
    estimatedGrossMarginUsd: number
    marginRate: number | null
    rawCostPerActiveUserUsd: number
  }>
  textVsImageCostSplit: {
    textRawCostUsd: number
    textDisplayedCostUsd: number
    textEvents: number
    imageRawCostUsd: number
    imageDisplayedCostUsd: number
    imageCount: number
  }
  mostExpensiveModels: Array<{
    model: string
    events: number
    rawCostUsd: number
    displayedCostUsd: number
  }>
  mostUsedAssistants: DashboardUsageSummary['assistantBreakdown']
  usersCloseToLimits: Array<{
    userId: string
    email: string | null
    loginId: string | null
    displayName: string | null
    tier: SubscriptionTier
    status: Subscription['status']
    highestUsageRatio: number
    limits: Array<{
      label: string
      used: number
      limit: number
      remaining: number
      ratio: number
    }>
  }>
}

export interface AdminAnalyticsFilters {
  from?: string | null
  to?: string | null
  tier?: string | null
  assistant?: string | null
  user?: string | null
}

export interface NormalizedAdminAnalyticsFilters {
  from: string
  to: string
  tier: SubscriptionTier | null
  assistant: AssistantFamily | null
  user: string | null
}

export interface AdminUserRow {
  profile: Profile | null
  subscription: Subscription
  override: UsageLimitOverride | null
  pendingRequest: PlanChangeRequest | null
  textTokensThisPeriod: number
  imageGenerationsThisPeriod: number
  rawCostUsd: number
  displayedCostUsd: number
  remainingDisplayedCredits: number
  requestsThisPeriod: number
  highestUsageRatio: number
}

export interface AdminUserDetail {
  profile: Profile | null
  subscription: Subscription
  override: UsageLimitOverride | null
  planRequests: PlanChangeRequest[]
  currentPlanRequestStatus: PlanChangeRequest | null
  usageEvents: UsageEvent[]
  imageEvents: ImageGenerationEvent[]
  recommendationEvents: AssistantRecommendationEvent[]
  auditLogs: AdminAuditLog[]
  conversations: Awaited<ReturnType<typeof neonConversationRepository.list>>
  assistantBreakdown: DashboardUsageSummary['assistantBreakdown']
  modelBreakdown: Array<{
    model: string
    count: number
    rawCostUsd: number
    displayedCostUsd: number
  }>
}

function sum<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((total, item) => total + getValue(item), 0)
}

function isSameDay(iso: string, target = new Date()): boolean {
  const date = new Date(iso)
  return (
    date.getUTCFullYear() === target.getUTCFullYear() &&
    date.getUTCMonth() === target.getUTCMonth() &&
    date.getUTCDate() === target.getUTCDate()
  )
}

const PLAN_TIERS: SubscriptionTier[] = ['free', 'basic', 'pro', 'ultra', 'prime']
const ASSISTANT_FAMILIES: AssistantFamily[] = [
  'nova',
  'velora',
  'axiom',
  'forge',
  'pulse',
  'prism',
]
const LIMIT_WARNING_RATIO = 0.8

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getCurrentUtcMonthRange(now = new Date()) {
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  )
  return {
    from: toDateInputValue(from),
    to: toDateInputValue(now),
  }
}

function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) return null
  return date
}

function endOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      23,
      59,
      59,
      999
    )
  )
}

function isSubscriptionTier(value: string | null | undefined): value is SubscriptionTier {
  return PLAN_TIERS.includes(value as SubscriptionTier)
}

function isAssistantFamily(value: string | null | undefined): value is AssistantFamily {
  return ASSISTANT_FAMILIES.includes(value as AssistantFamily)
}

export function normalizeAdminAnalyticsFilters(
  filters: AdminAnalyticsFilters = {}
): NormalizedAdminAnalyticsFilters {
  const defaults = getCurrentUtcMonthRange()
  let from = parseDateInput(filters.from) ?? parseDateInput(defaults.from)!
  let to = parseDateInput(filters.to) ?? parseDateInput(defaults.to)!

  if (from.getTime() > to.getTime()) {
    from = parseDateInput(defaults.from)!
    to = parseDateInput(defaults.to)!
  }

  const user = filters.user?.trim() || null

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
    tier: isSubscriptionTier(filters.tier) ? filters.tier : null,
    assistant: isAssistantFamily(filters.assistant) ? filters.assistant : null,
    user,
  }
}

function isWithinPeriod(iso: string, filters: NormalizedAdminAnalyticsFilters): boolean {
  const date = new Date(iso)
  const from = parseDateInput(filters.from)!
  const to = endOfUtcDay(parseDateInput(filters.to)!)
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime()
}

function matchesUserSearch(
  subscription: Subscription,
  profile: Profile | null,
  userSearch: string | null
): boolean {
  if (!userSearch) return true
  const normalized = userSearch.toLowerCase()
  return [
    subscription.userId,
    profile?.displayName ?? '',
    profile?.email ?? '',
    profile?.loginId ?? '',
  ].some((value) => value.toLowerCase().includes(normalized))
}

function getEffectiveLimit(
  subscription: Subscription,
  override: UsageLimitOverride | null,
  field:
    | 'coreTokensIncluded'
    | 'tierTokensIncluded'
    | 'imageCreditsIncluded'
    | 'dailyMessageLimit'
    | 'maxImagesPerDay'
): number {
  return override?.[field] ?? subscription[field]
}

function calculateRatio(used: number, limit: number): number {
  if (limit <= 0) return 0
  return used / limit
}

function buildLimitUsageDetails(
  subscription: Subscription,
  override: UsageLimitOverride | null
) {
  return [
    {
      label: 'Core tokens',
      used: subscription.coreTokensUsed,
      limit: getEffectiveLimit(subscription, override, 'coreTokensIncluded'),
    },
    {
      label: 'Tier tokens',
      used: subscription.tierTokensUsed,
      limit: getEffectiveLimit(subscription, override, 'tierTokensIncluded'),
    },
    {
      label: 'Image credits',
      used: subscription.imageCreditsUsed,
      limit: getEffectiveLimit(subscription, override, 'imageCreditsIncluded'),
    },
    {
      label: 'Daily messages',
      used: subscription.dailyMessageCount,
      limit: getEffectiveLimit(subscription, override, 'dailyMessageLimit'),
    },
    {
      label: 'Daily images',
      used: subscription.dailyImageCount,
      limit: getEffectiveLimit(subscription, override, 'maxImagesPerDay'),
    },
  ].map((limit) => ({
    ...limit,
    remaining: Math.max(0, limit.limit - limit.used),
    ratio: calculateRatio(limit.used, limit.limit),
  }))
}

function median(values: number[]): number {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function buildAssistantBreakdown(
  usageEvents: UsageEvent[],
  imageEvents: ImageGenerationEvent[],
  includeRaw: boolean
): DashboardUsageSummary['assistantBreakdown'] {
  const buckets = new Map<
    string,
    {
      family: UsageEvent['assistantFamily']
      events: number
      displayedCostUsd: number
      rawCostUsd: number
    }
  >()

  for (const event of usageEvents) {
    const current = buckets.get(event.assistantFamily) ?? {
      family: event.assistantFamily,
      events: 0,
      displayedCostUsd: 0,
      rawCostUsd: 0,
    }

    current.events += 1
    current.displayedCostUsd += event.displayedCostUsd
    current.rawCostUsd += event.rawCostUsd
    buckets.set(event.assistantFamily, current)
  }

  for (const event of imageEvents) {
    const current = buckets.get(event.assistantFamily) ?? {
      family: event.assistantFamily,
      events: 0,
      displayedCostUsd: 0,
      rawCostUsd: 0,
    }

    current.events += event.imageCount
    current.displayedCostUsd += event.displayedCostUsd
    current.rawCostUsd += event.rawCostUsd
    buckets.set(event.assistantFamily, current)
  }

  return [...buckets.values()]
    .sort((a, b) => b.displayedCostUsd - a.displayedCostUsd)
    .map((item) => ({
      family: item.family,
      events: item.events,
      displayedCostUsd: item.displayedCostUsd,
      ...(includeRaw ? { rawCostUsd: item.rawCostUsd } : {}),
    }))
}

class NeonAdminRepository {
  normalizeAnalyticsFilters(filters?: AdminAnalyticsFilters) {
    return normalizeAdminAnalyticsFilters(filters)
  }

  async getOverview(filters: AdminAnalyticsFilters = {}): Promise<AdminOverview> {
    const normalizedFilters = normalizeAdminAnalyticsFilters(filters)
    const [profiles, subscriptions, usageEvents, imageEvents, requests] =
      await Promise.all([
        neonProfilesRepository.list(),
        neonSubscriptionsRepository.list(),
        neonUsageEventsRepository.list(),
        neonImageGenerationEventsRepository.list(),
        neonPlanRequestsRepository.list(),
      ])

    const profileByUserId = new Map(
      profiles.map((profile) => [profile.userId, profile])
    )
    const subscriptionsForFilters = subscriptions.filter((subscription) => {
      const profile = profileByUserId.get(subscription.userId) ?? null
      return (
        (!normalizedFilters.tier ||
          subscription.tier === normalizedFilters.tier) &&
        matchesUserSearch(subscription, profile, normalizedFilters.user)
      )
    })
    const filteredUserIds = new Set(
      subscriptionsForFilters.map((subscription) => subscription.userId)
    )
    const filteredUsageEvents = usageEvents.filter(
      (event) =>
        filteredUserIds.has(event.userId) &&
        isWithinPeriod(event.createdAt, normalizedFilters) &&
        (!normalizedFilters.assistant ||
          event.assistantFamily === normalizedFilters.assistant)
    )
    const filteredImageEvents = imageEvents.filter(
      (event) =>
        filteredUserIds.has(event.userId) &&
        isWithinPeriod(event.createdAt, normalizedFilters) &&
        (!normalizedFilters.assistant ||
          event.assistantFamily === normalizedFilters.assistant)
    )
    const filteredRequests = requests.filter((request) =>
      filteredUserIds.has(request.userId)
    )

    const rawTextCostUsd = sum(filteredUsageEvents, (event) => event.rawCostUsd)
    const displayedTextCostUsd = sum(
      filteredUsageEvents,
      (event) => event.displayedCostUsd
    )
    const rawImageCostUsd = sum(filteredImageEvents, (event) => event.rawCostUsd)
    const displayedImageCostUsd = sum(
      filteredImageEvents,
      (event) => event.displayedCostUsd
    )
    const totalRawCostUsd = rawTextCostUsd + rawImageCostUsd
    const totalDisplayedCostUsd = displayedTextCostUsd + displayedImageCostUsd
    const estimatedSubscriptionRevenueUsd = sum(
      subscriptionsForFilters.filter(
        (subscription) => subscription.status === 'active'
      ),
      (subscription) => subscription.planPriceUsd
    )
    const requestsToday = filteredRequests.filter((request) =>
      isSameDay(request.createdAt)
    ).length

    const userRawCosts = subscriptionsForFilters.map((subscription) => {
      const profile = profileByUserId.get(subscription.userId) ?? null
      const userUsage = filteredUsageEvents.filter(
        (event) => event.userId === subscription.userId
      )
      const userImageUsage = filteredImageEvents.filter(
        (event) => event.userId === subscription.userId
      )
      const rawCostUsd =
        sum(userUsage, (event) => event.rawCostUsd) +
        sum(userImageUsage, (event) => event.rawCostUsd)
      const displayedCostUsd =
        sum(userUsage, (event) => event.displayedCostUsd) +
        sum(userImageUsage, (event) => event.displayedCostUsd)

      return {
        userId: subscription.userId,
        email: profile?.email ?? null,
        loginId: profile?.loginId ?? null,
        displayName: profile?.displayName ?? null,
        rawCostUsd,
        displayedCostUsd,
      }
    })
    const highCostMedian = median(userRawCosts.map((item) => item.rawCostUsd))
    const usersWithRawCost = userRawCosts.filter((item) => item.rawCostUsd > 0)
    const mostExpensiveUsers = userRawCosts
      .filter((item) => item.rawCostUsd > 0 || item.displayedCostUsd > 0)
      .sort((a, b) => b.rawCostUsd - a.rawCostUsd)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        isUnusuallyHigh:
          usersWithRawCost.length >= 3 &&
          highCostMedian > 0 && item.rawCostUsd >= highCostMedian * 2,
      }))

    const modelBuckets = new Map<
      string,
      { model: string; events: number; rawCostUsd: number; displayedCostUsd: number }
    >()
    for (const event of filteredUsageEvents) {
      const current = modelBuckets.get(event.model) ?? {
        model: event.model,
        events: 0,
        rawCostUsd: 0,
        displayedCostUsd: 0,
      }
      current.events += 1
      current.rawCostUsd += event.rawCostUsd
      current.displayedCostUsd += event.displayedCostUsd
      modelBuckets.set(event.model, current)
    }
    for (const event of filteredImageEvents) {
      const current = modelBuckets.get(event.model) ?? {
        model: event.model,
        events: 0,
        rawCostUsd: 0,
        displayedCostUsd: 0,
      }
      current.events += event.imageCount
      current.rawCostUsd += event.rawCostUsd
      current.displayedCostUsd += event.displayedCostUsd
      modelBuckets.set(event.model, current)
    }

    const marginByPlan = PLAN_TIERS.map((tier) => {
      const tierSubscriptions = subscriptionsForFilters.filter(
        (subscription) => subscription.tier === tier
      )
      const activeTierSubscriptions = tierSubscriptions.filter(
        (subscription) => subscription.status === 'active'
      )
      const tierUserIds = new Set(
        tierSubscriptions.map((subscription) => subscription.userId)
      )
      const tierUsage = filteredUsageEvents.filter((event) =>
        tierUserIds.has(event.userId)
      )
      const tierImages = filteredImageEvents.filter((event) =>
        tierUserIds.has(event.userId)
      )
      const rawCostUsd =
        sum(tierUsage, (event) => event.rawCostUsd) +
        sum(tierImages, (event) => event.rawCostUsd)
      const displayedCostUsd =
        sum(tierUsage, (event) => event.displayedCostUsd) +
        sum(tierImages, (event) => event.displayedCostUsd)
      const estimatedRevenueUsd = sum(
        activeTierSubscriptions,
        (subscription) => subscription.planPriceUsd
      )

      return {
        tier,
        activeUsers: activeTierSubscriptions.length,
        estimatedRevenueUsd,
        rawCostUsd,
        displayedCostUsd,
        estimatedGrossMarginUsd: estimatedRevenueUsd - rawCostUsd,
        marginRate:
          estimatedRevenueUsd > 0
            ? (estimatedRevenueUsd - rawCostUsd) / estimatedRevenueUsd
            : null,
        rawCostPerActiveUserUsd:
          activeTierSubscriptions.length > 0
            ? rawCostUsd / activeTierSubscriptions.length
            : 0,
      }
    })

    const overridesByUserId = new Map(
      (await neonUsageLimitOverridesRepository.list()).map((override) => [
        override.userId,
        override,
      ])
    )
    const usersCloseToLimits = subscriptionsForFilters
      .map((subscription) => {
        const profile = profileByUserId.get(subscription.userId) ?? null
        const override = overridesByUserId.get(subscription.userId) ?? null
        const limits = buildLimitUsageDetails(subscription, override).filter(
          (limit) => limit.limit > 0 && limit.ratio >= LIMIT_WARNING_RATIO
        )

        const highestUsageRatio = limits.reduce(
          (highest, limit) => Math.max(highest, limit.ratio),
          0
        )

        return {
          userId: subscription.userId,
          email: profile?.email ?? null,
          loginId: profile?.loginId ?? null,
          displayName: profile?.displayName ?? null,
          tier: subscription.tier,
          status: subscription.status,
          highestUsageRatio,
          limits,
        }
      })
      .filter((item) => item.limits.length > 0)
      .sort((a, b) => b.highestUsageRatio - a.highestUsageRatio)
      .slice(0, 10)

    return {
      filters: normalizedFilters,
      activeUsers: subscriptionsForFilters.filter(
        (subscription) => subscription.status === 'active'
      ).length,
      usersByTier: {
        free: subscriptionsForFilters.filter(
          (subscription) => subscription.tier === 'free'
        ).length,
        basic: subscriptionsForFilters.filter(
          (subscription) => subscription.tier === 'basic'
        ).length,
        pro: subscriptionsForFilters.filter(
          (subscription) => subscription.tier === 'pro'
        ).length,
        ultra: subscriptionsForFilters.filter(
          (subscription) => subscription.tier === 'ultra'
        ).length,
        prime: subscriptionsForFilters.filter(
          (subscription) => subscription.tier === 'prime'
        ).length,
      },
      pendingPlanRequests: filteredRequests.filter(
        (request) => request.status === 'pending'
      ).length,
      rawTextCostUsd,
      displayedTextCostUsd,
      rawImageCostUsd,
      displayedImageCostUsd,
      totalRawCostUsd,
      totalDisplayedCostUsd,
      estimatedSubscriptionRevenueUsd,
      estimatedGrossMarginUsd: estimatedSubscriptionRevenueUsd - totalRawCostUsd,
      requestsToday,
      mostExpensiveUsers,
      marginByPlan,
      textVsImageCostSplit: {
        textRawCostUsd: rawTextCostUsd,
        textDisplayedCostUsd: displayedTextCostUsd,
        textEvents: filteredUsageEvents.length,
        imageRawCostUsd: rawImageCostUsd,
        imageDisplayedCostUsd: displayedImageCostUsd,
        imageCount: sum(filteredImageEvents, (event) => event.imageCount),
      },
      mostExpensiveModels: [...modelBuckets.values()]
        .sort((a, b) => b.rawCostUsd - a.rawCostUsd)
        .slice(0, 10),
      mostUsedAssistants: buildAssistantBreakdown(
        filteredUsageEvents,
        filteredImageEvents,
        true
      ),
      usersCloseToLimits,
    }
  }

  async listUserRows(filters: AdminAnalyticsFilters = {}): Promise<AdminUserRow[]> {
    const normalizedFilters = normalizeAdminAnalyticsFilters(filters)
    const [profiles, subscriptions, overrides, usageEvents, imageEvents, requests] =
      await Promise.all([
        neonProfilesRepository.list(),
        neonSubscriptionsRepository.list(),
        neonUsageLimitOverridesRepository.list(),
        neonUsageEventsRepository.list(),
        neonImageGenerationEventsRepository.list(),
        neonPlanRequestsRepository.list(),
      ])

    return subscriptions
      .filter((subscription) => {
        const profile =
          profiles.find((item) => item.userId === subscription.userId) ?? null
        return (
          (!normalizedFilters.tier ||
            subscription.tier === normalizedFilters.tier) &&
          matchesUserSearch(subscription, profile, normalizedFilters.user)
        )
      })
      .map((subscription) => {
        const profile =
          profiles.find((item) => item.userId === subscription.userId) ?? null
        const override =
          overrides.find((item) => item.userId === subscription.userId) ?? null
        const userUsage = usageEvents.filter(
          (event) =>
            event.userId === subscription.userId &&
            isWithinPeriod(event.createdAt, normalizedFilters) &&
            (!normalizedFilters.assistant ||
              event.assistantFamily === normalizedFilters.assistant)
        )
        const userImages = imageEvents.filter(
          (event) =>
            event.userId === subscription.userId &&
            isWithinPeriod(event.createdAt, normalizedFilters) &&
            (!normalizedFilters.assistant ||
              event.assistantFamily === normalizedFilters.assistant)
        )
        const pendingRequest =
          requests.find(
            (request) =>
              request.userId === subscription.userId &&
              request.status === 'pending'
          ) ?? null
        const displayedCreditsTotal = usdToDisplayedCredits(
          subscription.planPriceUsd * subscription.displayMultiplier
        )
        const displayedCostUsd =
          sum(userUsage, (event) => event.displayedCostUsd) +
          sum(userImages, (event) => event.displayedCostUsd)
        const riskLimits = buildLimitUsageDetails(subscription, override)
        const highestUsageRatio = riskLimits.reduce(
          (highest, limit) =>
            limit.limit > 0 ? Math.max(highest, limit.ratio) : highest,
          0
        )

        return {
          profile,
          subscription,
          override,
          pendingRequest,
          textTokensThisPeriod: sum(userUsage, (event) => event.totalTokens),
          imageGenerationsThisPeriod: sum(
            userImages,
            (event) => event.imageCount
          ),
          rawCostUsd:
            sum(userUsage, (event) => event.rawCostUsd) +
            sum(userImages, (event) => event.rawCostUsd),
          displayedCostUsd,
          remainingDisplayedCredits: Math.max(
            0,
            displayedCreditsTotal - usdToDisplayedCredits(displayedCostUsd)
          ),
          requestsThisPeriod: userUsage.length + userImages.length,
          highestUsageRatio,
        }
      })
      .sort((a, b) => {
        if (b.highestUsageRatio !== a.highestUsageRatio) {
          return b.highestUsageRatio - a.highestUsageRatio
        }
        if (b.rawCostUsd !== a.rawCostUsd) {
          return b.rawCostUsd - a.rawCostUsd
        }
        return b.displayedCostUsd - a.displayedCostUsd
      })
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail | null> {
    const [
      profile,
      subscription,
      override,
      planRequests,
      usageEvents,
      imageEvents,
      recommendationEvents,
      auditLogs,
      conversations,
    ] = await Promise.all([
      neonProfilesRepository.get(userId),
      neonSubscriptionsRepository.getByUserId(userId),
      neonUsageLimitOverridesRepository.getByUserId(userId),
      neonPlanRequestsRepository.listByUser(userId),
      neonUsageEventsRepository.listByUser(userId),
      neonImageGenerationEventsRepository.listByUser(userId),
      neonAssistantRecommendationEventsRepository.listByUser(userId),
      neonAdminAuditLogsRepository.listByTargetUser(userId),
      neonConversationRepository.list(userId),
    ])

    if (!subscription) return null

    const modelCounts = new Map<
      string,
      { count: number; rawCostUsd: number; displayedCostUsd: number }
    >()
    for (const event of usageEvents) {
      const current = modelCounts.get(event.model) ?? {
        count: 0,
        rawCostUsd: 0,
        displayedCostUsd: 0,
      }
      current.count += 1
      current.rawCostUsd += event.rawCostUsd
      current.displayedCostUsd += event.displayedCostUsd
      modelCounts.set(event.model, current)
    }
    for (const event of imageEvents) {
      const current = modelCounts.get(event.model) ?? {
        count: 0,
        rawCostUsd: 0,
        displayedCostUsd: 0,
      }
      current.count += event.imageCount
      current.rawCostUsd += event.rawCostUsd
      current.displayedCostUsd += event.displayedCostUsd
      modelCounts.set(event.model, current)
    }

    return {
      profile,
      subscription,
      override,
      planRequests,
      currentPlanRequestStatus:
        planRequests.find((request) => request.status === 'pending') ?? null,
      usageEvents,
      imageEvents,
      recommendationEvents,
      auditLogs,
      conversations,
      assistantBreakdown: buildAssistantBreakdown(usageEvents, imageEvents, true),
      modelBreakdown: [...modelCounts.entries()].map(([model, value]) => ({
        model,
        ...value,
      })),
    }
  }

  async getAssistantRecommendationAnalyticsSummary(): Promise<AssistantRecommendationAnalyticsSummary> {
    return neonAssistantRecommendationEventsRepository.getAnalyticsSummary()
  }
}

export const neonAdminRepository = new NeonAdminRepository()
