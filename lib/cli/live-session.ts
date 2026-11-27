import { mergeMessagesByIdChronological } from '@/lib/conversations/message-pages'
import type { Conversation, ConversationMessagesAfterResponse, Message } from '@/types'

/** A zq session counts as live while it changed in the last two minutes. */
export const LIVE_WINDOW_MS = 2 * 60_000
export const LIVE_POLL_MS = 3_000
/** Sessions older than this by the browser clock are not checked at all. */
export const LIVE_CHECK_WINDOW_MS = 10 * 60_000
/** Asks for every entry when the view has none yet. */
export const LIVE_START_CURSOR = new Date(0).toISOString()

/** Time since the session last changed, on the server clock. */
export function sessionAgeMs(
  page: Pick<ConversationMessagesAfterResponse, 'updatedAt' | 'serverNow'>
): number {
  const age = Date.parse(page.serverNow) - Date.parse(page.updatedAt)
  return Number.isFinite(age) ? Math.max(0, age) : Number.POSITIVE_INFINITY
}

/** The newest createdAt in view. The route returns it again, so a running turn keeps updating. */
export function liveCursor(messages: Pick<Message, 'createdAt'>[]): string | null {
  let newest: string | null = null
  let newestTime = Number.NEGATIVE_INFINITY
  for (const message of messages) {
    const time = Date.parse(message.createdAt)
    if (Number.isFinite(time) && time > newestTime) {
      newest = message.createdAt
      newestTime = time
    }
  }
  return newest
}

function sameMessage(a: Message, b: Message): boolean {
  return (
    a.content === b.content &&
    a.status === b.status &&
    a.model === b.model &&
    (a.parts?.length ?? 0) === (b.parts?.length ?? 0)
  )
}

/** Merges a live page into the open conversation. Returns the same object when nothing changed. */
export function mergeLiveMessages(
  conversation: Conversation,
  page: Pick<ConversationMessagesAfterResponse, 'messages' | 'updatedAt'>
): Conversation {
  const byId = new Map(conversation.messages.map((message) => [message.id, message]))
  const changed = page.messages.filter((message) => {
    const existing = byId.get(message.id)
    return !existing || !sameMessage(existing, message)
  })
  if (changed.length === 0 && conversation.updatedAt === page.updatedAt) return conversation

  const messages = mergeMessagesByIdChronological(conversation.messages, changed)
  const added = messages.length - conversation.messages.length
  const latest = [...messages]
    .reverse()
    .find((message) => message.role !== 'system' && message.content.trim())
  const totalCount = Math.max(conversation.messageCount + added, messages.length)

  return {
    ...conversation,
    messages,
    updatedAt: page.updatedAt,
    messageCount: totalCount,
    preview: latest ? latest.content.replace(/\s+/g, ' ').trim().slice(0, 120) : conversation.preview,
    messagePageInfo: conversation.messagePageInfo
      ? { ...conversation.messagePageInfo, loadedCount: messages.length, totalCount }
      : conversation.messagePageInfo,
  }
}

export function formatLastUpdate(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1) return 'Last update just now'
  if (minutes < 60) return `Last update ${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Last update ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  return `Last update ${days} ${days === 1 ? 'day' : 'days'} ago`
}
