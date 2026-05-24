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
import {
  isRole,
  isSubscriptionStatus,
  isSubscriptionTier,
  parseAllowedModelOverrides,
  parseNonNegativeInteger,
  parseOptionalNote,
} from '@/lib/admin/validation'

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

  const tier =
    typeof body.tier === 'undefined'
      ? undefined
      : isSubscriptionTier(body.tier)
        ? body.tier
        : null
  const status =
    typeof body.status === 'undefined'
      ? undefined
      : isSubscriptionStatus(body.status)
        ? body.status
        : null
  const role =
    typeof body.role === 'undefined'
      ? undefined
      : isRole(body.role)
        ? body.role
        : null

  if (tier === null || status === null || role === null) {
    return NextResponse.json({ error: 'Invalid admin update payload.' }, { status: 400 })
  }

  let parsed
  try {
    parsed = {
      note: parseOptionalNote(body.note),
      coreTokensIncluded: parseNonNegativeInteger(
        body.coreTokensIncluded,
        'coreTokensIncluded'
      ),
      tierTokensIncluded: parseNonNegativeInteger(
        body.tierTokensIncluded,
        'tierTokensIncluded'
      ),
      imageCreditsIncluded: parseNonNegativeInteger(
        body.imageCreditsIncluded,
        'imageCreditsIncluded'
      ),
      dailyMessageLimit: parseNonNegativeInteger(
        body.dailyMessageLimit,
        'dailyMessageLimit'
      ),
      maxInputTokensPerRequest: parseNonNegativeInteger(
        body.maxInputTokensPerRequest,
        'maxInputTokensPerRequest'
      ),
      maxOutputTokensPerRequest: parseNonNegativeInteger(
        body.maxOutputTokensPerRequest,
        'maxOutputTokensPerRequest'
      ),
      maxImagesPerDay: parseNonNegativeInteger(
        body.maxImagesPerDay,
        'maxImagesPerDay'
      ),
      allowedModelOverrides: parseAllowedModelOverrides(body.allowedModelOverrides),
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid admin update payload.' },
      { status: 400 }
    )
  }

  let updatedSubscription = await neonSubscriptionsRepository.getByUserId(id)
  const currentOverride = await neonUsageLimitOverridesRepository.getByUserId(id)

  if (!updatedSubscription) {
    return NextResponse.json({ error: 'User subscription not found.' }, { status: 404 })
  }

  const currentSubscription = updatedSubscription
  const nextTier = tier ?? updatedSubscription.tier

  if (tier) {
    updatedSubscription = await neonSubscriptionsRepository.updateTier(
      id,
      tier,
      parsed.note ?? null
    )
  }

  if (status) {
    updatedSubscription = await neonSubscriptionsRepository.updateStatus(id, status)
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
        coreTokensIncluded: parsed.coreTokensIncluded,
        tierTokensIncluded: parsed.tierTokensIncluded,
        imageCreditsIncluded: parsed.imageCreditsIncluded,
        dailyMessageLimit: parsed.dailyMessageLimit,
        maxInputTokensPerRequest: parsed.maxInputTokensPerRequest,
        maxOutputTokensPerRequest: parsed.maxOutputTokensPerRequest,
        maxImagesPerDay: parsed.maxImagesPerDay,
      },
    })

    await neonUsageLimitOverridesRepository.upsert(id, {
      ...overridePatch,
      allowedModelOverrides: parsed.allowedModelOverrides,
      notes: parsed.note,
    })
  }

  if (role) {
    await neonProfilesRepository.updateRole(id, role)
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
