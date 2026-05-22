import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApiUser } from '@/lib/auth/require-admin'
import {
  neonAdminAuditLogsRepository,
  neonAdminRepository,
  neonProfilesRepository,
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
  buildTierRebasedUsageOverridePatch,
} from '@/lib/db/repositories'
import { SubscriptionTier } from '@/types'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const { id } = await context.params
  const detail = await neonAdminRepository.getUserDetail(id)

  if (!detail) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  return NextResponse.json({ detail })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const { id } = await context.params
  const body = (await request.json().catch(() => null)) as
    | {
        tier?: SubscriptionTier
        status?: 'active' | 'paused' | 'cancelled'
        role?: 'user' | 'admin'
        note?: string
        coreTokensIncluded?: number
        tierTokensIncluded?: number
        imageCreditsIncluded?: number
        dailyMessageLimit?: number
        maxInputTokensPerRequest?: number
        maxOutputTokensPerRequest?: number
        maxImagesPerDay?: number
        allowedModelOverrides?: string[]
      }
    | null

  if (!body) {
    return NextResponse.json({ error: 'Update payload is required.' }, { status: 400 })
  }

  let updatedSubscription = await neonSubscriptionsRepository.getByUserId(id)
  const currentOverride = await neonUsageLimitOverridesRepository.getByUserId(id)

  if (!updatedSubscription) {
    return NextResponse.json({ error: 'User subscription not found.' }, { status: 404 })
  }

  const currentSubscription = updatedSubscription
  const nextTier = body.tier ?? updatedSubscription.tier

  if (body.tier) {
    updatedSubscription = await neonSubscriptionsRepository.updateTier(
      id,
      body.tier,
      body.note ?? null
    )
  }

  if (body.status) {
    updatedSubscription = await neonSubscriptionsRepository.updateStatus(id, body.status)
  }

  if (
    typeof body.coreTokensIncluded !== 'undefined' ||
    typeof body.tierTokensIncluded !== 'undefined' ||
    typeof body.imageCreditsIncluded !== 'undefined' ||
    typeof body.dailyMessageLimit !== 'undefined' ||
    typeof body.maxInputTokensPerRequest !== 'undefined' ||
    typeof body.maxOutputTokensPerRequest !== 'undefined' ||
    typeof body.maxImagesPerDay !== 'undefined' ||
    typeof body.allowedModelOverrides !== 'undefined' ||
    typeof body.note !== 'undefined'
  ) {
    const overridePatch = buildTierRebasedUsageOverridePatch({
      currentSubscription,
      currentOverride,
      nextTier,
      submittedOverrides: {
        coreTokensIncluded: body.coreTokensIncluded,
        tierTokensIncluded: body.tierTokensIncluded,
        imageCreditsIncluded: body.imageCreditsIncluded,
        dailyMessageLimit: body.dailyMessageLimit,
        maxInputTokensPerRequest: body.maxInputTokensPerRequest,
        maxOutputTokensPerRequest: body.maxOutputTokensPerRequest,
        maxImagesPerDay: body.maxImagesPerDay,
      },
    })

    await neonUsageLimitOverridesRepository.upsert(id, {
      ...overridePatch,
      allowedModelOverrides: body.allowedModelOverrides,
      notes: body.note,
    })
  }

  if (body.role) {
    await neonProfilesRepository.updateRole(id, body.role)
  }

  await neonAdminAuditLogsRepository.create({
    adminUserId: auth.user.id,
    targetUserId: id,
    action: 'admin_user_update',
    details: body as Record<string, unknown>,
  })

  const detail = await neonAdminRepository.getUserDetail(id)

  return NextResponse.json({ detail })
}
