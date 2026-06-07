import 'server-only'

import { inArray } from 'drizzle-orm'
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
import { normalizeFileKnowledge } from '@/lib/files/intelligence'
import { getDatabaseClient } from '../client'
import {
  zenConversations,
  zenCustomAssistants,
  zenFiles,
  zenGeneratedImages,
  zenMessages,
  zenModelComparisonCandidates,
  zenModelComparisons,
  zenProjects,
  zenPromptLibrary,
  zenPromptWorkflowRuns,
  zenPromptWorkflowStepRuns,
} from '../schema'
import { toIsoString } from './helpers'
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
  productAnalytics: AdminProductAnalytics
}

export interface AdminProductAnalytics {
  activationFunnel: Array<{
    id: string
    label: string
    count: number
    rate: number
    detail: string
  }>
  featureAdoption: Array<{
    id: string
    label: string
    value: number
    detail: string
  }>
  fileIndexing: {
    indexed: number
    skipped: number
    unsupported: number
    failed: number
    pending: number
  }
  operationalSignals: Array<{
    id: string
    label: string
    value: number
    detail: string
    tone: 'neutral' | 'warning' | 'critical'
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

function modeToAssistantFamily(mode: unknown): AssistantFamily | null {
  switch (mode) {
    case 'general':
      return 'nova'
    case 'creative':
      return 'velora'
    case 'logic':
      return 'axiom'
    case 'code':
      return 'forge'
    case 'live':
      return 'pulse'
    case 'image':
      return 'prism'
    default:
      return null
  }
}

function matchesAssistantFilter(
  assistant: AssistantFamily | null,
  value: AssistantFamily | null
): boolean {
  return !assistant || value === assistant
}

function rowCreatedAt(row: { createdAt: Date | string }): string {
  return toIsoString(row.createdAt)
}

function isRowWithinPeriod(
  row: { createdAt: Date | string },
  filters: NormalizedAdminAnalyticsFilters
): boolean {
  return isWithinPeriod(rowCreatedAt(row), filters)
}

function hasPersistedSources(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function countFirstUserEvents<T>(
  rows: T[],
  filters: NormalizedAdminAnalyticsFilters,
  getUserId: (row: T) => string,
  getCreatedAt: (row: T) => string
): number {
  const firstByUser = new Map<string, string>()

  for (const row of rows) {
    const userId = getUserId(row)
    const createdAt = getCreatedAt(row)
    const previous = firstByUser.get(userId)
    if (!previous || new Date(createdAt).getTime() < new Date(previous).getTime()) {
      firstByUser.set(userId, createdAt)
    }
  }

  return [...firstByUser.values()].filter((createdAt) =>
    isWithinPeriod(createdAt, filters)
  ).length
}

function rate(count: number, denominator: number): number {
  return denominator > 0 ? count / denominator : 0
}

class NeonAdminRepository {
  normalizeAnalyticsFilters(filters?: AdminAnalyticsFilters) {
    return normalizeAdminAnalyticsFilters(filters)
  }

  async getOverview(filters: AdminAnalyticsFilters = {}): Promise<AdminOverview> {
    const normalizedFilters = normalizeAdminAnalyticsFilters(filters)
    const db = getDatabaseClient()
    const [profiles, subscriptions] = await Promise.all([
      neonProfilesRepository.list(),
      neonSubscriptionsRepository.list(),
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
    const filteredUserIdList = [...filteredUserIds]
    const filterFromDate = parseDateInput(normalizedFilters.from)!
    const filterToDate = endOfUtcDay(parseDateInput(normalizedFilters.to)!)

    const [
      usageEvents,
      imageEvents,
      requests,
      projects,
      promptLibraryItems,
      workflowRuns,
      modelComparisons,
      files,
      generatedImages,
      customAssistants,
      conversationRows,
    ] =
      filteredUserIdList.length === 0
        ? [[], [], [], [], [], [], [], [], [], [], []]
        : await Promise.all([
            neonUsageEventsRepository.list({
              userIds: filteredUserIdList,
              assistantFamily: normalizedFilters.assistant,
              from: filterFromDate,
              to: filterToDate,
            }),
            neonImageGenerationEventsRepository.list({
              userIds: filteredUserIdList,
              assistantFamily: normalizedFilters.assistant,
              from: filterFromDate,
              to: filterToDate,
            }),
            neonPlanRequestsRepository.list({ userIds: filteredUserIdList }),
            db
              .select()
              .from(zenProjects)
              .where(inArray(zenProjects.userId, filteredUserIdList)),
            db
              .select()
              .from(zenPromptLibrary)
              .where(inArray(zenPromptLibrary.userId, filteredUserIdList)),
            db
              .select()
              .from(zenPromptWorkflowRuns)
              .where(inArray(zenPromptWorkflowRuns.userId, filteredUserIdList)),
            db
              .select()
              .from(zenModelComparisons)
              .where(inArray(zenModelComparisons.userId, filteredUserIdList)),
            db
              .select()
              .from(zenFiles)
              .where(inArray(zenFiles.userId, filteredUserIdList)),
            db
              .select()
              .from(zenGeneratedImages)
              .where(inArray(zenGeneratedImages.userId, filteredUserIdList)),
            db
              .select()
              .from(zenCustomAssistants)
              .where(inArray(zenCustomAssistants.userId, filteredUserIdList)),
            db
              .select()
              .from(zenConversations)
              .where(inArray(zenConversations.userId, filteredUserIdList)),
          ])
    const workflowRunIds = workflowRuns.map((run) => run.id)
    const modelComparisonIds = modelComparisons.map((comparison) => comparison.id)
    const conversationIds = conversationRows.map((conversation) => conversation.id)
    const [workflowStepRuns, modelComparisonCandidates, messages] = await Promise.all([
      workflowRunIds.length > 0
        ? db
            .select()
            .from(zenPromptWorkflowStepRuns)
            .where(inArray(zenPromptWorkflowStepRuns.runId, workflowRunIds))
        : Promise.resolve([]),
      modelComparisonIds.length > 0
        ? db
            .select()
            .from(zenModelComparisonCandidates)
            .where(
              inArray(
                zenModelComparisonCandidates.comparisonId,
                modelComparisonIds
              )
            )
        : Promise.resolve([]),
      conversationIds.length > 0
        ? db
            .select()
            .from(zenMessages)
            .where(inArray(zenMessages.conversationId, conversationIds))
        : Promise.resolve([]),
    ])
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

    const comparisonById = new Map(
      modelComparisons.map((comparison) => [comparison.id, comparison])
    )
    const conversationUserById = new Map(
      conversationRows.map((conversation) => [
        conversation.id,
        conversation.userId,
      ])
    )
    const workflowRunIdsForAssistant = new Set(
      workflowStepRuns
        .filter((stepRun) =>
          matchesAssistantFilter(
            normalizedFilters.assistant,
            stepRun.assistantFamily as AssistantFamily
          )
        )
        .map((stepRun) => stepRun.runId)
    )
    const comparisonIdsForAssistant = new Set(
      modelComparisonCandidates
        .filter((candidate) =>
          matchesAssistantFilter(
            normalizedFilters.assistant,
            candidate.assistantFamily as AssistantFamily
          )
        )
        .map((candidate) => candidate.comparisonId)
    )
    const productUsers = subscriptionsForFilters.length
    const nonDefaultProjects = projects.filter(
      (project) => filteredUserIds.has(project.userId) && !project.isDefault
    )
    const promptItemsForAnalytics = promptLibraryItems.filter(
      (prompt) =>
        filteredUserIds.has(prompt.userId) &&
        (prompt.mode === 'any' ||
          matchesAssistantFilter(
            normalizedFilters.assistant,
            modeToAssistantFamily(prompt.mode)
          ))
    )
    const workflowRunsForAnalytics = workflowRuns.filter(
      (run) =>
        filteredUserIds.has(run.userId) &&
        (!normalizedFilters.assistant || workflowRunIdsForAssistant.has(run.id))
    )
    const modelComparisonsForAnalytics = modelComparisons.filter(
      (comparison) =>
        filteredUserIds.has(comparison.userId) &&
        (!normalizedFilters.assistant ||
          comparisonIdsForAssistant.has(comparison.id))
    )
    const filesForAnalytics = files.filter((file) => filteredUserIds.has(file.userId))
    const generatedImagesForAnalytics = generatedImages.filter(
      (image) =>
        filteredUserIds.has(image.userId) &&
        matchesAssistantFilter(normalizedFilters.assistant, 'prism')
    )
    const customAssistantsForAnalytics = customAssistants.filter(
      (assistant) =>
        filteredUserIds.has(assistant.userId) &&
        matchesAssistantFilter(
          normalizedFilters.assistant,
          modeToAssistantFamily(assistant.baseMode)
        )
    )
    const sourceBackedPulseMessages = messages.filter(
      (message) =>
        filteredUserIds.has(conversationUserById.get(message.conversationId) ?? '') &&
        message.role === 'assistant' &&
        message.mode === 'live' &&
        matchesAssistantFilter(normalizedFilters.assistant, 'pulse') &&
        hasPersistedSources(message.sources)
    )

    const periodProjects = nonDefaultProjects.filter((project) =>
      isRowWithinPeriod(project, normalizedFilters)
    )
    const periodPrompts = promptItemsForAnalytics.filter((prompt) =>
      isRowWithinPeriod(prompt, normalizedFilters)
    )
    const periodWorkflowRuns = workflowRunsForAnalytics.filter((run) =>
      isRowWithinPeriod(run, normalizedFilters)
    )
    const periodModelComparisons = modelComparisonsForAnalytics.filter((comparison) =>
      isRowWithinPeriod(comparison, normalizedFilters)
    )
    const periodFiles = filesForAnalytics.filter((file) =>
      isRowWithinPeriod(file, normalizedFilters)
    )
    const periodGeneratedImages = generatedImagesForAnalytics.filter((image) =>
      isRowWithinPeriod(image, normalizedFilters)
    )
    const periodCustomAssistants = customAssistantsForAnalytics.filter((assistant) =>
      isRowWithinPeriod(assistant, normalizedFilters)
    )
    const periodSourceBackedPulseMessages = sourceBackedPulseMessages.filter((message) =>
      isRowWithinPeriod(message, normalizedFilters)
    )

    const fileIndexing = periodFiles.reduce<AdminProductAnalytics['fileIndexing']>(
      (counts, file) => {
        const metadata =
          file.metadata && typeof file.metadata === 'object' && !Array.isArray(file.metadata)
            ? (file.metadata as Record<string, unknown>)
            : {}
        const status = normalizeFileKnowledge(metadata).knowledgeStatus
        counts[status] += 1
        return counts
      },
      {
        indexed: 0,
        skipped: 0,
        unsupported: 0,
        failed: 0,
        pending: 0,
      }
    )
    const failedWorkflowRuns = periodWorkflowRuns.filter(
      (run) => run.status === 'failed'
    ).length
    const failedModelDuelCandidates = modelComparisonCandidates.filter((candidate) => {
      const comparison = comparisonById.get(candidate.comparisonId)
      return (
        candidate.status === 'error' &&
        Boolean(comparison) &&
        filteredUserIds.has(comparison!.userId) &&
        (!normalizedFilters.assistant ||
          candidate.assistantFamily === normalizedFilters.assistant) &&
        isRowWithinPeriod(candidate, normalizedFilters)
      )
    }).length
    const failedGeneratedImages = periodGeneratedImages.filter(
      (image) => image.status === 'failed'
    ).length
    const topExpensiveModel = [...modelBuckets.values()].sort(
      (a, b) => b.rawCostUsd - a.rawCostUsd
    )[0]

    const activationFunnel: AdminProductAnalytics['activationFunnel'] = [
      {
        id: 'signed_up',
        label: 'Signed up',
        count: profiles.filter(
          (profile) =>
            filteredUserIds.has(profile.userId) &&
            isWithinPeriod(profile.createdAt, normalizedFilters)
        ).length,
        rate: rate(
          profiles.filter(
            (profile) =>
              filteredUserIds.has(profile.userId) &&
              isWithinPeriod(profile.createdAt, normalizedFilters)
          ).length,
          productUsers
        ),
        detail: 'Admin-visible profiles created in period.',
      },
      {
        id: 'first_message',
        label: 'Sent first message',
        count: countFirstUserEvents(
          usageEvents.filter(
            (event) =>
              filteredUserIds.has(event.userId) &&
              matchesAssistantFilter(
                normalizedFilters.assistant,
                event.assistantFamily
              )
          ),
          normalizedFilters,
          (event) => event.userId,
          (event) => event.createdAt
        ),
        rate: 0,
        detail: 'First recorded text usage event.',
      },
      {
        id: 'first_project',
        label: 'Created first project',
        count: countFirstUserEvents(
          nonDefaultProjects,
          normalizedFilters,
          (project) => project.userId,
          rowCreatedAt
        ),
        rate: 0,
        detail: 'Excludes the default Inbox project.',
      },
      {
        id: 'first_upload',
        label: 'Uploaded first file',
        count: countFirstUserEvents(
          filesForAnalytics,
          normalizedFilters,
          (file) => file.userId,
          rowCreatedAt
        ),
        rate: 0,
        detail: 'First private file metadata record.',
      },
      {
        id: 'first_playbook',
        label: 'Ran first playbook',
        count: countFirstUserEvents(
          workflowRunsForAnalytics,
          normalizedFilters,
          (run) => run.userId,
          rowCreatedAt
        ),
        rate: 0,
        detail: 'First AI Playbook run record.',
      },
      {
        id: 'first_image',
        label: 'Generated first image',
        count: countFirstUserEvents(
          imageEvents.filter((event) =>
            filteredUserIds.has(event.userId) &&
            matchesAssistantFilter(normalizedFilters.assistant, 'prism')
          ),
          normalizedFilters,
          (event) => event.userId,
          (event) => event.createdAt
        ),
        rate: 0,
        detail: 'First Prism image usage event.',
      },
      {
        id: 'first_model_duel',
        label: 'Used first Model Duel',
        count: countFirstUserEvents(
          modelComparisonsForAnalytics,
          normalizedFilters,
          (comparison) => comparison.userId,
          rowCreatedAt
        ),
        rate: 0,
        detail: 'First text comparison run.',
      },
    ].map((item) => ({
      ...item,
      rate: item.rate || rate(item.count, productUsers),
    }))

    const productAnalytics: AdminProductAnalytics = {
      activationFunnel,
      featureAdoption: [
        {
          id: 'projects',
          label: 'Projects created',
          value: periodProjects.length,
          detail: `${countFirstUserEvents(nonDefaultProjects, normalizedFilters, (project) => project.userId, rowCreatedAt)} users created their first project.`,
        },
        {
          id: 'prompts',
          label: 'Prompt library saves',
          value: periodPrompts.length,
          detail: 'Prompt creation is counted; prompt insertion is not separately logged yet.',
        },
        {
          id: 'playbooks',
          label: 'AI Playbook runs',
          value: periodWorkflowRuns.length,
          detail: `${failedWorkflowRuns} failed in the selected period.`,
        },
        {
          id: 'model_duels',
          label: 'Model Duel runs',
          value: periodModelComparisons.length,
          detail: `${failedModelDuelCandidates} failed candidates in the selected period.`,
        },
        {
          id: 'prism',
          label: 'Prism generations',
          value: sum(filteredImageEvents, (event) => event.imageCount),
          detail: `${failedGeneratedImages} failed generated-image metadata rows logged.`,
        },
        {
          id: 'pulse_sources',
          label: 'Pulse source-backed chats',
          value: periodSourceBackedPulseMessages.length,
          detail: 'Counts persisted web-source assistant messages; Tavily unavailable is not logged in v1.',
        },
        {
          id: 'files',
          label: 'File uploads',
          value: periodFiles.length,
          detail: `${fileIndexing.indexed} indexed, ${fileIndexing.skipped + fileIndexing.unsupported + fileIndexing.failed} skipped/unsupported/failed.`,
        },
        {
          id: 'custom_assistants',
          label: 'Custom assistants created',
          value: periodCustomAssistants.length,
          detail: 'Private custom text assistants created in the selected period.',
        },
      ],
      fileIndexing,
      operationalSignals: [
        {
          id: 'failed_images',
          label: 'Failed image generations',
          value: failedGeneratedImages,
          detail: 'Counts generated-image metadata rows with failed status.',
          tone: failedGeneratedImages > 0 ? 'warning' : 'neutral',
        },
        {
          id: 'file_indexing_issues',
          label: 'File indexing skipped/failed',
          value: fileIndexing.skipped + fileIndexing.unsupported + fileIndexing.failed,
          detail: `${fileIndexing.failed} failed, ${fileIndexing.unsupported} unsupported, ${fileIndexing.skipped} skipped.`,
          tone:
            fileIndexing.failed > 0
              ? 'critical'
              : fileIndexing.skipped + fileIndexing.unsupported > 0
                ? 'warning'
                : 'neutral',
        },
        {
          id: 'workflow_failures',
          label: 'Failed playbook runs',
          value: failedWorkflowRuns,
          detail: 'Foreground AI Playbook runs marked failed.',
          tone: failedWorkflowRuns > 0 ? 'warning' : 'neutral',
        },
        {
          id: 'model_duel_failures',
          label: 'Failed Model Duel candidates',
          value: failedModelDuelCandidates,
          detail: 'Candidate-level failures inside completed or failed duels.',
          tone: failedModelDuelCandidates > 0 ? 'warning' : 'neutral',
        },
        {
          id: 'users_near_limits',
          label: 'Users near limits',
          value: usersCloseToLimits.length,
          detail: 'Users at or above 80% of tracked token, image, or daily limits.',
          tone: usersCloseToLimits.length > 0 ? 'warning' : 'neutral',
        },
        {
          id: 'expensive_model_usage',
          label: 'Top raw-cost model',
          value: topExpensiveModel?.events ?? 0,
          detail: topExpensiveModel
            ? `${topExpensiveModel.model} · ${topExpensiveModel.events} events · $${topExpensiveModel.rawCostUsd.toFixed(2)} raw.`
            : 'No model usage in this filter.',
          tone:
            topExpensiveModel && topExpensiveModel.rawCostUsd > 0
              ? 'warning'
              : 'neutral',
        },
        {
          id: 'tavily_unavailable',
          label: 'Tavily unavailable cases',
          value: 0,
          detail: 'Not logged in v1; Pulse adoption uses persisted source-backed messages.',
          tone: 'neutral',
        },
      ],
    }

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
      productAnalytics,
    }
  }

  async listUserRows(filters: AdminAnalyticsFilters = {}): Promise<AdminUserRow[]> {
    const normalizedFilters = normalizeAdminAnalyticsFilters(filters)
    const [profiles, subscriptions, overrides] = await Promise.all([
      neonProfilesRepository.list(),
      neonSubscriptionsRepository.list(),
      neonUsageLimitOverridesRepository.list(),
    ])
    const scopedSubscriptions = subscriptions.filter((subscription) => {
      const profile =
        profiles.find((item) => item.userId === subscription.userId) ?? null
      return (
        (!normalizedFilters.tier ||
          subscription.tier === normalizedFilters.tier) &&
        matchesUserSearch(subscription, profile, normalizedFilters.user)
      )
    })
    const scopedUserIds = scopedSubscriptions.map(
      (subscription) => subscription.userId
    )
    const filterFromDate = parseDateInput(normalizedFilters.from)!
    const filterToDate = endOfUtcDay(parseDateInput(normalizedFilters.to)!)
    const [usageEvents, imageEvents, requests] =
      scopedUserIds.length === 0
        ? [[], [], []]
        : await Promise.all([
            neonUsageEventsRepository.list({
              userIds: scopedUserIds,
              assistantFamily: normalizedFilters.assistant,
              from: filterFromDate,
              to: filterToDate,
            }),
            neonImageGenerationEventsRepository.list({
              userIds: scopedUserIds,
              assistantFamily: normalizedFilters.assistant,
              from: filterFromDate,
              to: filterToDate,
            }),
            neonPlanRequestsRepository.list({ userIds: scopedUserIds }),
          ])

    return scopedSubscriptions
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
