'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  adminAuditLogsStore,
  planRequestsStore,
  profilesStore,
  subscriptionsStore,
  usageLimitOverridesStore,
} from '@/lib/storage'

export async function updatePlanRequestStatusAction(formData: FormData) {
  const { user } = await requireAdmin()
  const requestId = formData.get('requestId')?.toString()
  const status = formData.get('status')?.toString()
  const adminNote = formData.get('adminNote')?.toString().trim() ?? null

  if (!requestId || !status) {
    redirect('/admin?error=missing-request')
  }

  const requests = await planRequestsStore.list()
  const request = requests.find((item) => item.id === requestId)
  if (!request) {
    redirect('/admin?error=request-not-found')
  }

  if (status !== 'approved' && status !== 'rejected' && status !== 'activated') {
    redirect('/admin?error=invalid-status')
  }

  await planRequestsStore.updateStatus(requestId, status, adminNote)

  if (status === 'activated') {
    await subscriptionsStore.updateTier(request.userId, request.requestedTier)
  }

  await adminAuditLogsStore.create({
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

  if (
    tier === 'free' ||
    tier === 'basic' ||
    tier === 'pro' ||
    tier === 'ultra' ||
    tier === 'prime'
  ) {
    if (typeof note === 'undefined') {
      await subscriptionsStore.updateTier(targetUserId, tier)
    } else {
      await subscriptionsStore.updateTier(targetUserId, tier, note)
    }
  }

  if (status === 'active' || status === 'paused' || status === 'cancelled') {
    await subscriptionsStore.updateStatus(targetUserId, status)
  }

  await usageLimitOverridesStore.upsert(targetUserId, {
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
    allowedModelOverrides,
    notes: typeof note === 'undefined' ? undefined : note,
  })

  if (role === 'user' || role === 'admin') {
    await profilesStore.updateRole(targetUserId, role)
  }

  await adminAuditLogsStore.create({
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
