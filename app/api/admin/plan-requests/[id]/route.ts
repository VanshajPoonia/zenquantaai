import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApiUser } from '@/lib/auth/require-admin'
import {
  buildTierRebasedUsageOverridePatch,
  neonAdminAuditLogsRepository,
  neonPlanRequestsRepository,
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const { id } = await context.params
  const body = (await request.json().catch(() => null)) as
    | {
        status?: 'approved' | 'rejected' | 'activated'
        adminNote?: string
      }
    | null

  if (!body?.status) {
    return NextResponse.json({ error: 'Status is required.' }, { status: 400 })
  }

  const requests = await neonPlanRequestsRepository.list()
  const existing = requests.find((item) => item.id === id)
  if (!existing) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  }

  const updated = await neonPlanRequestsRepository.updateStatus(
    id,
    body.status,
    body.adminNote?.trim()
  )

  if (body.status === 'activated') {
    const currentSubscription = await neonSubscriptionsRepository.getByUserId(existing.userId)
    const currentOverride = await neonUsageLimitOverridesRepository.getByUserId(existing.userId)

    await neonSubscriptionsRepository.updateTier(existing.userId, existing.requestedTier)

    if (currentSubscription) {
      const overridePatch = buildTierRebasedUsageOverridePatch({
        currentSubscription,
        currentOverride,
        nextTier: existing.requestedTier,
      })

      if (Object.keys(overridePatch).length > 0) {
        await neonUsageLimitOverridesRepository.upsert(existing.userId, overridePatch)
      }
    }
  }

  await neonAdminAuditLogsRepository.create({
    adminUserId: auth.user.id,
    targetUserId: existing.userId,
    action: `plan_request_${body.status}`,
    details: {
      requestId: existing.id,
      requestedTier: existing.requestedTier,
      currentTier: existing.currentTier,
      adminNote: body.adminNote ?? null,
    },
  })

  return NextResponse.json({ request: updated })
}
