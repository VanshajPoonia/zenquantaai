import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonImageGenerationEventsRepository,
  neonPlanRequestsRepository,
  neonProfilesRepository,
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
  neonUsageEventsRepository,
} from '@/lib/db/repositories'
import {
  filterEventsForSubscriptionPeriod,
  getAssistantUsageBreakdown,
  getDisplayedCreditsSnapshot,
  getRemainingWallets,
} from '@/lib/billing/costs'
import { getEffectiveSubscription } from '@/lib/billing/enforce'
import { buildUsageLimitSnapshot } from '@/lib/billing/upgrade-nudges'
import { usdToDisplayedCredits } from '@/lib/config'
import { toSafeDashboardRecentImage } from '@/lib/security/user-scope'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const [subscription, override, textEvents, imageEvents, requests, conversations] =
    await Promise.all([
      neonSubscriptionsRepository.ensureForUser(auth.user),
      neonUsageLimitOverridesRepository.getByUserId(auth.user.id),
      neonUsageEventsRepository.listByUser(auth.user.id),
      neonImageGenerationEventsRepository.listByUser(auth.user.id),
      neonPlanRequestsRepository.listByUser(auth.user.id),
      neonConversationRepository.list(auth.user.id),
    ])
  const effectiveSubscription = getEffectiveSubscription(subscription, override)

  const periodTextEvents = filterEventsForSubscriptionPeriod(textEvents, subscription)
  const periodImageEvents = filterEventsForSubscriptionPeriod(imageEvents, subscription)

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
  const usedDisplayedCredits = usdToDisplayedCredits(totalDisplayedCostUsd)
  const displayedCreditsRemaining = Math.max(
    0,
    displayedCredits.totalDisplayedCredits - usedDisplayedCredits
  )
  const wallets = getRemainingWallets(effectiveSubscription)
  const latestPlanRequest = requests[0] ?? null

  const headers = new Headers()
  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  return NextResponse.json(
    {
      plan: {
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodEndsAt: subscription.currentPeriodEndsAt,
      },
      pendingRequest:
        requests.find((request) => request.status === 'pending') ?? null,
      latestPlanRequest,
      usage: {
        displayedCreditsTotal: displayedCredits.totalDisplayedCredits,
        displayedCreditsUsed: usedDisplayedCredits,
        displayedCreditsRemaining,
        textDisplayedCostUsd: displayedTextCostUsd,
        imageDisplayedCostUsd: displayedImageCostUsd,
        totalDisplayedCostUsd,
        assistantBreakdown: getAssistantUsageBreakdown({
          textEvents: periodTextEvents,
          imageEvents: periodImageEvents,
        }),
      },
      limits: {
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
          usedDisplayedCredits,
          displayedCredits.totalDisplayedCredits
        ),
      },
      recentConversations: conversations.slice(0, 8),
      recentImages: imageEvents.slice(0, 8).map(toSafeDashboardRecentImage),
    },
    { headers }
  )
}
