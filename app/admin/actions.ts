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

  const tier = formData.get('tier')?.toString()
  const status = formData.get('status')?.toString()
  const role = formData.get('role')?.toString()
  const noteField = formData.get('note')
  const note =
    noteField === null ? undefined : noteField.toString().trim() || null
  const coreTokensIncluded = formData.get('coreTokensIncluded')?.toString()
  const tierTokensIncluded = formData.get('tierTokensIncluded')?.toString()
  const imageCreditsIncluded = formData.get('imageCreditsIncluded')?.toString()
  const dailyMessageLimit = formData.get('dailyMessageLimit')?.toString()
  const maxInputTokensPerRequest = formData.get('maxInputTokensPerRequest')?.toString()
  const maxOutputTokensPerRequest = formData.get('maxOutputTokensPerRequest')?.toString()
  const maxImagesPerDay = formData.get('maxImagesPerDay')?.toString()
  const allowedModelOverrides = formData
    .get('allowedModelOverrides')
    ?.toString()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const nextTier =
    tier === 'free' ||
    tier === 'basic' ||
    tier === 'pro' ||
    tier === 'ultra' ||
    tier === 'prime'
      ? tier
      : currentSubscription?.tier

  if (
    tier === 'free' ||
    tier === 'basic' ||
    tier === 'pro' ||
    tier === 'ultra' ||
    tier === 'prime'
  ) {
    if (typeof note === 'undefined') {
      await neonSubscriptionsRepository.updateTier(targetUserId, tier)
    } else {
      await neonSubscriptionsRepository.updateTier(targetUserId, tier, note)
    }
  }

  if (status === 'active' || status === 'paused' || status === 'cancelled') {
    await neonSubscriptionsRepository.updateStatus(targetUserId, status)
  }

  if (currentSubscription && nextTier) {
    const overridePatch = buildTierRebasedUsageOverridePatch({
      currentSubscription,
      currentOverride,
      nextTier,
      submittedOverrides: {
        coreTokensIncluded: coreTokensIncluded ? Number(coreTokensIncluded) : undefined,
        tierTokensIncluded: tierTokensIncluded ? Number(tierTokensIncluded) : undefined,
        imageCreditsIncluded: imageCreditsIncluded ? Number(imageCreditsIncluded) : undefined,
        dailyMessageLimit: dailyMessageLimit ? Number(dailyMessageLimit) : undefined,
        maxInputTokensPerRequest: maxInputTokensPerRequest
          ? Number(maxInputTokensPerRequest)
          : undefined,
        maxOutputTokensPerRequest: maxOutputTokensPerRequest
          ? Number(maxOutputTokensPerRequest)
          : undefined,
        maxImagesPerDay: maxImagesPerDay ? Number(maxImagesPerDay) : undefined,
      },
    })

    await neonUsageLimitOverridesRepository.upsert(targetUserId, {
      ...overridePatch,
      allowedModelOverrides,
      notes: typeof note === 'undefined' ? undefined : note,
    })
  }

  if (role === 'user' || role === 'admin') {
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
