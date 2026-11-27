import 'server-only'

import { neonConversationRepository } from '@/lib/db/repositories'
import {
  buildConversationShareSnapshot,
  ConversationShareBuild,
  MAX_SHARED_MESSAGES,
  MAX_SNAPSHOT_CHARS,
} from './snapshot'

export const MAX_ACTIVE_SHARES_PER_CHAT = 10

const TOO_LONG = `This chat has more than ${MAX_SHARED_MESSAGES} messages or too much text to share. Branch a shorter part and share that.`

export type ShareSnapshotResult =
  | { ok: true; build: ConversationShareBuild }
  | { ok: false; status: 404 }
  | { ok: false; status: 400; error: string }

/** Loads the owner's chat from Neon and builds the redacted snapshot. Nothing comes from the client. */
export async function loadConversationShareSnapshot(
  userId: string,
  conversationId: string
): Promise<ShareSnapshotResult> {
  const header = await neonConversationRepository.get(userId, conversationId, { messageLimit: 1 })
  if (!header) return { ok: false, status: 404 }
  if (header.messageCount > MAX_SHARED_MESSAGES) return { ok: false, status: 400, error: TOO_LONG }

  const conversation = await neonConversationRepository.get(userId, conversationId)
  if (!conversation) return { ok: false, status: 404 }

  const build = buildConversationShareSnapshot(conversation)
  if (build.messageCount === 0) {
    return { ok: false, status: 400, error: 'There is nothing to share in this chat yet.' }
  }
  if (JSON.stringify(build.snapshot).length > MAX_SNAPSHOT_CHARS) {
    return { ok: false, status: 400, error: TOO_LONG }
  }

  return { ok: true, build }
}

/** Share tokens are 43 base64url characters. Anything else is not worth a lookup. */
export function isValidShareToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{40,60}$/.test(value)
}

export function isValidConversationId(value: string): boolean {
  return value.length > 0 && value.length <= 200
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
