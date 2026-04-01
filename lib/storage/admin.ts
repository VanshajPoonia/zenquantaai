import {
  AdminAuditLog,
  AssistantRecommendationAnalyticsSummary,
  AssistantRecommendationEvent,
  DashboardUsageSummary,
  ImageGenerationEvent,
  PlanChangeRequest,
  Profile,
  Subscription,
  UsageEvent,
  UsageLimitOverride,
} from '@/types'
import { PLAN_CONFIGS, usdToDisplayedCredits } from '@/lib/config'
import { profilesStore } from './profiles'
import { subscriptionsStore, usageLimitOverridesStore } from './subscriptions'
import { imageGenerationEventsStore, usageEventsStore } from './usage-events'
import { adminAuditLogsStore, planRequestsStore } from './plan-requests'
import { conversationStore } from './conversations'
import { assistantRecommendationEventsStore } from './assistant-recommendations'

export interface AdminOverview {
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
    displayedCostUsd: number
    rawCostUsd: number
  }>
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
  conversations: Awaited<ReturnType<typeof conversationStore.list>>
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

function buildAssistantBreakdown(
  usageEvents: UsageEvent[],
  imageEvents: ImageGenerationEvent[],
  includeRaw: boolean
): DashboardUsageSummary['assistantBreakdown'] {
  const buckets = new Map<
    string,
    { family: UsageEvent['assistantFamily']; events: number; displayedCostUsd: number; rawCostUsd: number }
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

class AdminStore {
  async getOverview(): Promise<AdminOverview> {
    const [profiles, subscriptions, usageEvents, imageEvents, requests] =
      await Promise.all([
        profilesStore.list(),
        subscriptionsStore.list(),
        usageEventsStore.list(),
        imageGenerationEventsStore.list(),
        planRequestsStore.list(),
      ])

    const rawTextCostUsd = sum(usageEvents, (event) => event.rawCostUsd)
    const displayedTextCostUsd = sum(usageEvents, (event) => event.displayedCostUsd)
    const rawImageCostUsd = sum(imageEvents, (event) => event.rawCostUsd)
    const displayedImageCostUsd = sum(imageEvents, (event) => event.displayedCostUsd)
    const totalRawCostUsd = rawTextCostUsd + rawImageCostUsd
    const totalDisplayedCostUsd = displayedTextCostUsd + displayedImageCostUsd
    const estimatedSubscriptionRevenueUsd = sum(
      subscriptions.filter((subscription) => subscription.status === 'active'),
      (subscription) => subscription.planPriceUsd
    )
    const requestsToday = requests.filter((request) =>
      isSameDay(request.createdAt)
    ).length

    const mostExpensiveUsers = subscriptions
      .map((subscription) => {
        const profile = profiles.find((item) => item.userId === subscription.userId) ?? null
        const userUsage = usageEvents.filter((event) => event.userId === subscription.userId)
        const userImageUsage = imageEvents.filter((event) => event.userId === subscription.userId)
        const rawCostUsd =
          sum(userUsage, (event) => event.rawCostUsd) +
          sum(userImageUsage, (event) => event.rawCostUsd)
        const displayedCostUsd =
          sum(userUsage, (event) => event.displayedCostUsd) +
          sum(userImageUsage, (event) => event.displayedCostUsd)

        return {
          userId: subscription.userId,
          email: profile?.email ?? null,
          rawCostUsd,
          displayedCostUsd,
        }
      })
      .sort((a, b) => b.rawCostUsd - a.rawCostUsd)
      .slice(0, 5)

    return {
      activeUsers: subscriptions.filter((subscription) => subscription.status === 'active')
        .length,
      usersByTier: {
        free: subscriptions.filter((subscription) => subscription.tier === 'free')
          .length,
        basic: subscriptions.filter((subscription) => subscription.tier === 'basic')
          .length,
        pro: subscriptions.filter((subscription) => subscription.tier === 'pro')
          .length,
        ultra: subscriptions.filter((subscription) => subscription.tier === 'ultra')
          .length,
        prime: subscriptions.filter((subscription) => subscription.tier === 'prime')
          .length,
      },
      pendingPlanRequests: requests.filter((request) => request.status === 'pending')
        .length,
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
    }
  }

  async listUserRows(): Promise<AdminUserRow[]> {
    const [profiles, subscriptions, overrides, usageEvents, imageEvents, requests] =
      await Promise.all([
        profilesStore.list(),
        subscriptionsStore.list(),
        usageLimitOverridesStore.list(),
        usageEventsStore.list(),
        imageGenerationEventsStore.list(),
        planRequestsStore.list(),
      ])

    return subscriptions.map((subscription) => {
      const profile = profiles.find((item) => item.userId === subscription.userId) ?? null
      const override =
        overrides.find((item) => item.userId === subscription.userId) ?? null
      const userUsage = usageEvents.filter((event) => event.userId === subscription.userId)
      const userImages = imageEvents.filter((event) => event.userId === subscription.userId)
      const pendingRequest =
        requests.find(
          (request) =>
            request.userId === subscription.userId && request.status === 'pending'
        ) ?? null
      const displayedCreditsTotal = usdToDisplayedCredits(
        subscription.planPriceUsd * subscription.displayMultiplier
      )
      const displayedCostUsd =
        sum(userUsage, (event) => event.displayedCostUsd) +
        sum(userImages, (event) => event.displayedCostUsd)

      return {
        profile,
        subscription,
        override,
        pendingRequest,
        textTokensThisPeriod: sum(userUsage, (event) => event.totalTokens),
        imageGenerationsThisPeriod: sum(userImages, (event) => event.imageCount),
        rawCostUsd:
          sum(userUsage, (event) => event.rawCostUsd) +
          sum(userImages, (event) => event.rawCostUsd),
        displayedCostUsd,
        remainingDisplayedCredits: Math.max(
          0,
          displayedCreditsTotal - usdToDisplayedCredits(displayedCostUsd)
        ),
        requestsThisPeriod: userUsage.length + userImages.length,
      }
    })
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail | null> {
    const [profile, subscription, override, planRequests, usageEvents, imageEvents, recommendationEvents, auditLogs, conversations] =
      await Promise.all([
        profilesStore.get(userId),
        subscriptionsStore.getByUserId(userId),
        usageLimitOverridesStore.getByUserId(userId),
        planRequestsStore.listByUser(userId),
        usageEventsStore.listByUser(userId),
        imageGenerationEventsStore.listByUser(userId),
        assistantRecommendationEventsStore.listByUser(userId),
        adminAuditLogsStore.listByTargetUser(userId),
        conversationStore.list(userId),
      ])

    if (!subscription) return null

    const modelCounts = new Map<string, { count: number; rawCostUsd: number; displayedCostUsd: number }>()
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
      auditLogs: auditLogs as AdminAuditLog[],
      conversations,
      assistantBreakdown: buildAssistantBreakdown(usageEvents, imageEvents, true),
      modelBreakdown: [...modelCounts.entries()].map(([model, value]) => ({
        model,
        ...value,
      })),
    }
  }

  async getAssistantRecommendationAnalyticsSummary(): Promise<AssistantRecommendationAnalyticsSummary> {
    return assistantRecommendationEventsStore.getAnalyticsSummary()
  }
}

export const adminStore = new AdminStore()
