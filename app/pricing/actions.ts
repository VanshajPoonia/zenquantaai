'use server'

import { redirect } from 'next/navigation'
import { requireServerUser } from '@/lib/auth/require-admin'
import { planRequestsStore, subscriptionsStore } from '@/lib/storage'

export async function requestPlanAction(formData: FormData) {
  const { user } = await requireServerUser()
  const requestedTier = formData.get('requestedTier')
  const note = formData.get('note')?.toString().trim()
  const contact = formData.get('contact')?.toString().trim()

  if (
    requestedTier !== 'basic' &&
    requestedTier !== 'pro' &&
    requestedTier !== 'ultra' &&
    requestedTier !== 'prime'
  ) {
    redirect('/pricing?error=invalid-plan')
  }

  const subscription = await subscriptionsStore.ensureForUser(user)
  const pending = await planRequestsStore.getLatestPendingForUser(user.id)

  if (pending) {
    redirect('/pricing?error=pending')
  }

  await planRequestsStore.create({
    userId: user.id,
    currentTier: subscription.tier,
    requestedTier,
    note,
    contact,
  })

  redirect('/pricing?requested=1')
}
