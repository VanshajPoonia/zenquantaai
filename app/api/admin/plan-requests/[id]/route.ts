import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApiUser } from '@/lib/auth/require-admin'
import {
  adminAuditLogsStore,
  buildTierRebasedUsageOverridePatch,
  planRequestsStore,
  profilesStore,
  subscriptionsStore,
  usageLimitOverridesStore,
} from '@/lib/storage'

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

  const requests = await planRequestsStore.list()
  const existing = requests.find((item) => item.id === id)
  if (!existing) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  }

  const updated = await planRequestsStore.updateStatus(
    id,
    body.status,
    body.adminNote?.trim()
  )

  if (body.status === 'activated') {
    const currentSubscription = await subscriptionsStore.getByUserId(existing.userId)
    const currentOverride = await usageLimitOverridesStore.getByUserId(existing.userId)

    await subscriptionsStore.updateTier(existing.userId, existing.requestedTier)

    if (currentSubscription) {
      const overridePatch = buildTierRebasedUsageOverridePatch({
        currentSubscription,
        currentOverride,
        nextTier: existing.requestedTier,
      })

      if (Object.keys(overridePatch).length > 0) {
        await usageLimitOverridesStore.upsert(existing.userId, overridePatch)
      }
    }
  }

  await adminAuditLogsStore.create({
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
