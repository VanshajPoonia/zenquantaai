'use server'

import { redirect } from 'next/navigation'
import { requireServerUser } from '@/lib/auth/require-admin'
import {
  neonPlanRequestsRepository,
  neonSubscriptionsRepository,
} from '@/lib/db/repositories'

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

  const subscription = await neonSubscriptionsRepository.ensureForUser(user)
  const pending = await neonPlanRequestsRepository.getLatestPendingForUser(user.id)
  const tierRank = {
    free: 0,
    basic: 1,
    pro: 2,
    ultra: 3,
    prime: 4,
  } as const

  if (pending) {
    redirect('/pricing?error=pending')
  }

  if (tierRank[requestedTier] <= tierRank[subscription.tier]) {
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
