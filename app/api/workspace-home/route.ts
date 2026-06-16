import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  filterEventsForSubscriptionPeriod,
  getDisplayedCreditsSnapshot,
  getRemainingWallets,
} from '@/lib/billing/costs'
import { getEffectiveSubscription } from '@/lib/billing/enforce'
import { buildUsageLimitSnapshot } from '@/lib/billing/upgrade-nudges'
import { usdToDisplayedCredits } from '@/lib/config'
import {
  neonImageGenerationEventsRepository,
  neonPlanRequestsRepository,
  neonProfilesRepository,
  neonSubscriptionsRepository,
  neonUsageEventsRepository,
  neonUsageLimitOverridesRepository,
  neonWorkspaceHomeRepository,
} from '@/lib/db/repositories'
import { WorkspaceHomeUsageSnapshot } from '@/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const [subscription, override] = await Promise.all([
    neonSubscriptionsRepository.ensureForUser(auth.user),
    neonUsageLimitOverridesRepository.getByUserId(auth.user.id),
  ])
  const effectiveSubscription = getEffectiveSubscription(subscription, override)
  const periodStart = new Date(subscription.currentPeriodStartedAt)
  const periodEnd = new Date(subscription.currentPeriodEndsAt)

  const [textEvents, imageEvents, requests] = await Promise.all([
    neonUsageEventsRepository.listByUser(auth.user.id, {
      from: periodStart,
      to: periodEnd,
    }),
    neonImageGenerationEventsRepository.listByUser(auth.user.id, {
      from: periodStart,
      to: periodEnd,
    }),
    neonPlanRequestsRepository.listByUser(auth.user.id),
  ])

  const periodTextEvents = filterEventsForSubscriptionPeriod(
    textEvents,
    subscription
  )
  const periodImageEvents = filterEventsForSubscriptionPeriod(
    imageEvents,
    subscription
  )
  const displayedTextCostUsd = periodTextEvents.reduce(
    (total, event) => total + event.displayedCostUsd,
    0
  )
  const displayedImageCostUsd = periodImageEvents.reduce(
    (total, event) => total + event.displayedCostUsd,
    0
  )
  const totalDisplayedCostUsd = displayedTextCostUsd + displayedImageCostUsd
  const displayedCredits = getDisplayedCreditsSnapshot(subscription)
  const displayedCreditsUsed = usdToDisplayedCredits(totalDisplayedCostUsd)
  const displayedCreditsRemaining = Math.max(
    0,
    displayedCredits.totalDisplayedCredits - displayedCreditsUsed
  )
  const wallets = getRemainingWallets(effectiveSubscription)
  const pendingRequest =
    requests.find((request) => request.status === 'pending') ?? null

  const usageSnapshot: WorkspaceHomeUsageSnapshot = {
    planTier: subscription.tier,
    subscriptionStatus: subscription.status,
    displayedCreditsTotal: displayedCredits.totalDisplayedCredits,
    displayedCreditsUsed,
    displayedCreditsRemaining,
    dailyMessages: buildUsageLimitSnapshot(
      effectiveSubscription.dailyMessageCount,
      effectiveSubscription.dailyMessageLimit
    ),
    dailyImages: buildUsageLimitSnapshot(
      effectiveSubscription.dailyImageCount,
      effectiveSubscription.maxImagesPerDay
    ),
    imageCredits: buildUsageLimitSnapshot(
      effectiveSubscription.imageCreditsIncluded - wallets.imageCredits,
      effectiveSubscription.imageCreditsIncluded
    ),
    displayedCredits: buildUsageLimitSnapshot(
      displayedCreditsUsed,
      displayedCredits.totalDisplayedCredits
    ),
    pendingPlanRequest: pendingRequest
      ? {
          id: pendingRequest.id,
          requestedTier: pendingRequest.requestedTier,
          status: pendingRequest.status,
          createdAt: pendingRequest.createdAt,
          updatedAt: pendingRequest.updatedAt,
        }
      : null,
  }

  const home = await neonWorkspaceHomeRepository.get(
    auth.user.id,
    usageSnapshot
  )
  const response = NextResponse.json(home)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
