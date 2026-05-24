'use server'

import { redirect } from 'next/navigation'
import { requireServerUser } from '@/lib/auth/require-admin'
import {
  neonPlanRequestsRepository,
  neonSubscriptionsRepository,
} from '@/lib/db/repositories'
import {
  isPaidSubscriptionTier,
  requestedTierIsUpgrade,
} from '@/lib/admin/validation'

export async function requestPlanAction(formData: FormData) {
  const { user } = await requireServerUser()
  const requestedTier = formData.get('requestedTier')
  const note = formData.get('note')?.toString().trim()
  const contact = formData.get('contact')?.toString().trim()

  if (!isPaidSubscriptionTier(requestedTier)) {
    redirect('/pricing?error=invalid-plan')
  }

  const subscription = await neonSubscriptionsRepository.ensureForUser(user)
  const pending = await neonPlanRequestsRepository.getLatestPendingForUser(user.id)
  if (pending) {
    redirect('/pricing?error=pending')
  }

  if (!requestedTierIsUpgrade(subscription.tier, requestedTier)) {
    redirect('/pricing?error=already-covered')
  }

  await neonPlanRequestsRepository.create({
    userId: user.id,
    currentTier: subscription.tier,
    requestedTier,
    note,
    contact,
  })

  redirect('/pricing?requested=1')
}
