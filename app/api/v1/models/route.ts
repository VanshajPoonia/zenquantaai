import { NextRequest, NextResponse } from 'next/server'
import { requireApiTokenUser } from '@/lib/auth/api-token'
import { isModelApiEnabledFor } from '@/lib/agent/flags'
import { listZqModels, ZQ_MODEL_DESCRIPTIONS } from '@/lib/agent/model-names'
import {
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireApiTokenUser(request, 'cli')
  if (auth.response) return auth.response

  if (!isModelApiEnabledFor(auth.user)) return NextResponse.json({ object: 'list', data: [] })

  const subscription = await neonSubscriptionsRepository.ensureForUser(auth.user)
  const override = await neonUsageLimitOverridesRepository.getByUserId(auth.user.id)

  return NextResponse.json({
    object: 'list',
    data: listZqModels(subscription.tier, override).map((id) => ({
      id,
      object: 'model',
      owned_by: 'zenquanta',
      description: ZQ_MODEL_DESCRIPTIONS[id],
    })),
  })
}
