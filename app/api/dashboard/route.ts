import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonImageGenerationEventsRepository,
  neonPlanRequestsRepository,
  neonProfilesRepository,
  neonSubscriptionsRepository,
  neonUsageEventsRepository,
} from '@/lib/db/repositories'
import { getAssistantUsageBreakdown, getDisplayedCreditsSnapshot } from '@/lib/billing/costs'
import { usdToDisplayedCredits } from '@/lib/config'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const [subscription, textEvents, imageEvents, requests, conversations] =
    await Promise.all([
      neonSubscriptionsRepository.ensureForUser(auth.user),
      neonUsageEventsRepository.listByUser(auth.user.id),
      neonImageGenerationEventsRepository.listByUser(auth.user.id),
      neonPlanRequestsRepository.listByUser(auth.user.id),
      neonConversationRepository.list(auth.user.id),
    ])

  const displayedTextCostUsd = textEvents.reduce(
    (total, event) => total + event.displayedCostUsd,
    0
  )
  const displayedImageCostUsd = imageEvents.reduce(
    (total, event) => total + event.displayedCostUsd,
    0
  )
  const totalDisplayedCostUsd = displayedTextCostUsd + displayedImageCostUsd
  const displayedCredits = getDisplayedCreditsSnapshot(subscription)
  const usedDisplayedCredits = usdToDisplayedCredits(totalDisplayedCostUsd)

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
      usage: {
        displayedCreditsTotal: displayedCredits.totalDisplayedCredits,
        displayedCreditsUsed: usedDisplayedCredits,
        displayedCreditsRemaining: Math.max(
          0,
          displayedCredits.totalDisplayedCredits - usedDisplayedCredits
        ),
        textDisplayedCostUsd: displayedTextCostUsd,
        imageDisplayedCostUsd: displayedImageCostUsd,
        totalDisplayedCostUsd,
        assistantBreakdown: getAssistantUsageBreakdown({
          textEvents,
          imageEvents,
        }),
      },
      recentConversations: conversations.slice(0, 8),
      recentImages: imageEvents.slice(0, 8),
    },
    { headers }
  )
}
