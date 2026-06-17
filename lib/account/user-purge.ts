import 'server-only'

import { neonUserPurgeRepository } from '@/lib/db/repositories'
import { getObjectStore } from '@/lib/storage/object-store'
import {
  UserPurgeConfirmationContext,
  validateUserPurgeConfirmation,
} from './user-purge-utils'
import {
  UserPurgeResult,
  UserPurgeScope,
} from '@/types'

export class UserPurgeConfirmationError extends Error {
  status = 400
}

export class UserPurgeNotFoundError extends Error {
  status = 404
}

export async function previewUserPurge(input: {
  userId: string
  scope: UserPurgeScope
  actor?: 'user' | 'admin'
}) {
  return neonUserPurgeRepository.preview(input.userId, input.scope, {
    actor: input.actor,
  })
}

export async function executeUserPurge(input: {
  userId: string
  scope: UserPurgeScope
  confirmation: unknown
  actor?: 'user' | 'admin'
}): Promise<UserPurgeResult> {
  const identity = await neonUserPurgeRepository.getIdentity(input.userId)
  if (!identity) {
    throw new UserPurgeNotFoundError('User not found.')
  }

  const confirmationContext: UserPurgeConfirmationContext = {
    actor: input.actor ?? 'user',
    scope: input.scope,
    loginId: identity.loginId,
    targetUserId: input.userId,
  }
  if (!validateUserPurgeConfirmation(input.confirmation, confirmationContext)) {
    throw new UserPurgeConfirmationError('Confirmation did not match.')
  }

  const preview = await previewUserPurge({
    userId: input.userId,
    scope: input.scope,
    actor: input.actor,
  })
  if (!preview) {
    throw new UserPurgeNotFoundError('User not found.')
  }

  const objectRefs = await neonUserPurgeRepository.collectObjectRefs(input.userId)
  await neonUserPurgeRepository.deleteDatabaseRows(input.userId, input.scope)

  const objectStore = getObjectStore()
  let deleted = 0
  let failed = 0
  for (const ref of objectRefs) {
    try {
      await objectStore.deleteObject({
        bucket: ref.bucket,
        key: ref.key,
      })
      deleted += 1
    } catch {
      failed += 1
    }
  }

  return {
    userId: input.userId,
    scope: input.scope,
    deletedAt: new Date().toISOString(),
    counts: preview.counts,
    objectDeletion: {
      attempted: objectRefs.length,
      deleted,
      failed,
    },
    partialFailure: failed > 0,
    signedOut: input.scope === 'full_account',
  }
}
