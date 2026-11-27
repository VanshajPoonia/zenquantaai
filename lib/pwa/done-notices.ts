import { ASSISTANT_FAMILY_COPY, MODE_TO_FAMILY } from '@/lib/config/assistants'
import type { Conversation, Message, StreamingState } from '@/types'

export const DONE_NOTICES_KEY = 'zenquanta:done-notices:v1'
const APP_TITLE = 'Zenquanta AI'

/** Desktop browsers only. Android needs a service worker to show one and iPhone needs push. */
export function canShowNotices(env: { hasNotification: boolean; userAgent: string }): boolean {
  return env.hasNotification && !/Android|iPhone|iPad|iPod/i.test(env.userAgent)
}

export function unreadTitle(count: number): string {
  return `(${count}) ${APP_TITLE}`
}

/** The reply that just stopped streaming, unless it failed. */
export function finishedReply(
  previous: StreamingState,
  next: StreamingState
): { conversationId: string; messageId: string } | null {
  if (previous.status !== 'streaming' || !previous.conversationId || !previous.messageId) return null
  if (next.status === 'streaming' && next.messageId === previous.messageId) return null
  if (next.status === 'error' && next.messageId === previous.messageId) return null
  return { conversationId: previous.conversationId, messageId: previous.messageId }
}

/** The finished assistant message. The server can swap the placeholder id, so the last reply is the fallback. */
export function findFinishedMessage(
  conversations: Pick<Conversation, 'id' | 'messages'>[],
  finished: { conversationId: string; messageId: string }
): Message | null {
  const messages = conversations.find((item) => item.id === finished.conversationId)?.messages ?? []
  const message =
    messages.find((item) => item.id === finished.messageId) ??
    [...messages].reverse().find((item) => item.role === 'assistant')
  if (!message || message.role !== 'assistant' || message.status === 'error' || message.error) return null
  return message
}

export function noticeText(message: Pick<Message, 'content' | 'mode' | 'assistantFamily' | 'customAssistant'>): string {
  const name =
    message.customAssistant?.name ??
    ASSISTANT_FAMILY_COPY[message.assistantFamily ?? MODE_TO_FAMILY[message.mode]].shortName
  const snippet = message.content.replace(/\s+/g, ' ').trim().slice(0, 80)
  return snippet ? `${name} finished: ${snippet}` : `${name} finished your reply.`
}

/** Storage can be blocked in private windows, which reads as off. */
export function readDoneNoticesSetting(): boolean {
  try {
    return window.localStorage.getItem(DONE_NOTICES_KEY) === 'on'
  } catch {
    return false
  }
}

export function writeDoneNoticesSetting(on: boolean): boolean {
  try {
    window.localStorage.setItem(DONE_NOTICES_KEY, on ? 'on' : 'off')
    return true
  } catch {
    return false
  }
}
