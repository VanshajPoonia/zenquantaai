'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  buildTierRebasedUsageOverridePatch,
  neonAdminAuditLogsRepository,
  neonPlanRequestsRepository,
  neonProfilesRepository,
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from '@/lib/db/repositories'
import {
  isRole,
  isSubscriptionStatus,
  isSubscriptionTier,
  parseAllowedModelOverrides,
  parseNonNegativeInteger,
  parseOptionalNote,
} from '@/lib/admin/validation'

export async function updatePlanRequestStatusAction(formData: FormData) {
  const { user } = await requireAdmin()
  const requestId = formData.get('requestId')?.toString()
  const status = formData.get('status')?.toString()
  const adminNote = formData.get('adminNote')?.toString().trim() ?? null

  if (!requestId || !status) {
    redirect('/admin?error=missing-request')
  }

  const requests = await neonPlanRequestsRepository.list()
  const request = requests.find((item) => item.id === requestId)
  if (!request) {
    redirect('/admin?error=request-not-found')
  }

  if (status !== 'approved' && status !== 'rejected' && status !== 'activated') {
    redirect('/admin?error=invalid-status')
  }

  await neonPlanRequestsRepository.updateStatus(requestId, status, adminNote)

  if (status === 'activated') {
    const currentSubscription = await neonSubscriptionsRepository.getByUserId(request.userId)
    const currentOverride =
      await neonUsageLimitOverridesRepository.getByUserId(request.userId)

    await neonSubscriptionsRepository.updateTier(request.userId, request.requestedTier)

    if (currentSubscription) {
      const overridePatch = buildTierRebasedUsageOverridePatch({
        currentSubscription,
        currentOverride,
        nextTier: request.requestedTier,
      })

      if (Object.keys(overridePatch).length > 0) {
        await neonUsageLimitOverridesRepository.upsert(request.userId, overridePatch)
      }
    }
  }

  await neonAdminAuditLogsRepository.create({
    adminUserId: user.id,
    targetUserId: request.userId,
    action: `plan_request_${status}`,
    details: {
      requestId,
      requestedTier: request.requestedTier,
      currentTier: request.currentTier,
      adminNote,
    },
  })

  redirect('/admin?updated=1')
}

export async function updateUserAdminAction(formData: FormData) {
  const { user } = await requireAdmin()
  const targetUserId = formData.get('targetUserId')?.toString()
  const returnTo = formData.get('returnTo')?.toString()

  if (!targetUserId) {
    redirect('/admin?error=missing-user')
  }

  const currentSubscription = await neonSubscriptionsRepository.getByUserId(targetUserId)
  const currentOverride =
    await neonUsageLimitOverridesRepository.getByUserId(targetUserId)

  const tierRaw = formData.get('tier')?.toString()
  const tier =
    typeof tierRaw === 'undefined' || tierRaw === ''
      ? undefined
      : isSubscriptionTier(tierRaw)
        ? tierRaw
        : null
  const statusRaw = formData.get('status')?.toString()
  const status =
    typeof statusRaw === 'undefined' || statusRaw === ''
      ? undefined
      : isSubscriptionStatus(statusRaw)
        ? statusRaw
        : null
  const roleRaw = formData.get('role')?.toString()
  const role =
    typeof roleRaw === 'undefined' || roleRaw === ''
      ? undefined
      : isRole(roleRaw)
        ? roleRaw
        : null

  if (tier === null || status === null || role === null) {
    redirect('/admin?error=invalid-user-update')
  }

  const noteField = formData.get('note')
  let note: string | null | undefined
  let coreTokensIncluded: number | undefined
  let tierTokensIncluded: number | undefined
  let imageCreditsIncluded: number | undefined
  let dailyMessageLimit: number | undefined
  let maxInputTokensPerRequest: number | undefined
  let maxOutputTokensPerRequest: number | undefined
  let maxImagesPerDay: number | undefined
  let allowedModelOverrides: string[] | undefined

  try {
    note = parseOptionalNote(noteField === null ? undefined : noteField)
    coreTokensIncluded = parseNonNegativeInteger(
      formData.get('coreTokensIncluded')?.toString(),
      'coreTokensIncluded'
    )
    tierTokensIncluded = parseNonNegativeInteger(
      formData.get('tierTokensIncluded')?.toString(),
      'tierTokensIncluded'
    )
    imageCreditsIncluded = parseNonNegativeInteger(
      formData.get('imageCreditsIncluded')?.toString(),
      'imageCreditsIncluded'
    )
    dailyMessageLimit = parseNonNegativeInteger(
      formData.get('dailyMessageLimit')?.toString(),
      'dailyMessageLimit'
    )
    maxInputTokensPerRequest = parseNonNegativeInteger(
      formData.get('maxInputTokensPerRequest')?.toString(),
      'maxInputTokensPerRequest'
    )
    maxOutputTokensPerRequest = parseNonNegativeInteger(
      formData.get('maxOutputTokensPerRequest')?.toString(),
      'maxOutputTokensPerRequest'
    )
    maxImagesPerDay = parseNonNegativeInteger(
      formData.get('maxImagesPerDay')?.toString(),
      'maxImagesPerDay'
    )
    allowedModelOverrides = parseAllowedModelOverrides(
      formData.get('allowedModelOverrides')?.toString()
    )
  } catch {
    redirect('/admin?error=invalid-user-update')
  }

  const nextTier = tier ?? currentSubscription?.tier

  if (tier) {
    if (typeof note === 'undefined') {
      await neonSubscriptionsRepository.updateTier(targetUserId, tier)
    } else {
      await neonSubscriptionsRepository.updateTier(targetUserId, tier, note)
    }
  }

  if (status) {
    await neonSubscriptionsRepository.updateStatus(targetUserId, status)
  }

  if (currentSubscription && nextTier) {
    const overridePatch = buildTierRebasedUsageOverridePatch({
      currentSubscription,
      currentOverride,
      nextTier,
      submittedOverrides: {
        coreTokensIncluded,
        tierTokensIncluded,
        imageCreditsIncluded,
        dailyMessageLimit,
        maxInputTokensPerRequest,
        maxOutputTokensPerRequest,
        maxImagesPerDay,
      },
    })

    await neonUsageLimitOverridesRepository.upsert(targetUserId, {
      ...overridePatch,
      allowedModelOverrides,
      notes: typeof note === 'undefined' ? undefined : note,
    })
  }

  if (role) {
    await neonProfilesRepository.updateRole(targetUserId, role)
  }

  await neonAdminAuditLogsRepository.create({
    adminUserId: user.id,
    targetUserId,
    action: 'admin_user_update',
    details: {
      tier,
      status,
      role,
      note,
      coreTokensIncluded,
      tierTokensIncluded,
      imageCreditsIncluded,
      dailyMessageLimit,
      maxInputTokensPerRequest,
      maxOutputTokensPerRequest,
      maxImagesPerDay,
      allowedModelOverrides,
    },
  })

  if (returnTo === 'admin') {
    redirect('/admin?updated=1')
  }

  redirect(`/admin/users/${targetUserId}?updated=1`)
}
