import { NextRequest, NextResponse } from 'next/server'
import { requireApiTokenUser } from '@/lib/auth/api-token'
import { isModelApiEnabledFor } from '@/lib/agent/flags'
import { listZqModels } from '@/lib/agent/model-names'
import { getEffectiveSubscription } from '@/lib/billing/enforce'
import { AGENT_PLAN_LIMITS } from '@/lib/config'
import {
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

/** What `zq /usage` and the startup banner show. Displayed values only. */
export async function GET(request: NextRequest) {
  const auth = await requireApiTokenUser(request, 'cli')
  if (auth.response) return auth.response

  const subscription = await neonSubscriptionsRepository.ensureForUser(auth.user)
  const override = await neonUsageLimitOverridesRepository.getByUserId(auth.user.id)
  const effective = getEffectiveSubscription(subscription, override)
  const limits = AGENT_PLAN_LIMITS[subscription.tier]
  const wallet = (included: number, used: number) => ({
    included,
    used,
    left: Math.max(included - used, 0),
  })

  return NextResponse.json({
    loginId: auth.user.loginId,
    plan: subscription.tier,
    cliAccess: limits.cliAccess,
    modelApi: isModelApiEnabledFor(auth.user),
    models: isModelApiEnabledFor(auth.user) ? listZqModels(subscription.tier, override) : [],
    coreTokens: wallet(effective.coreTokensIncluded, subscription.coreTokensUsed),
    tierTokens: wallet(effective.tierTokensIncluded, subscription.tierTokensUsed),
    agentSteps: wallet(limits.agentStepsPerDay, subscription.dailyAgentStepCount),
    maxStepsPerRun: limits.maxStepsPerRun,
    maxAgentInputTokens: limits.maxAgentInputTokens,
    maxAgentOutputTokens: limits.maxAgentOutputTokens,
  })
}
