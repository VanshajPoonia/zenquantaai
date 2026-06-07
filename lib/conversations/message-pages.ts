import { Conversation, ConversationMessagesPageResponse, Message } from '@/types'

export function mergeMessagesByIdChronological(
  existing: Message[],
  incoming: Message[]
): Message[] {
  const byId = new Map(existing.map((message) => [message.id, message]))

  for (const message of incoming) {
    byId.set(message.id, message)
  }

  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}

export function mergeConversationMessagePage(
  existing: Conversation,
  incoming: ConversationMessagesPageResponse
): Conversation {
  const messages = mergeMessagesByIdChronological(
    existing.messages,
    incoming.messages
  )

  return {
    ...existing,
    messages,
    attachments: messages.flatMap((message) => message.attachments ?? []),
    messagePageInfo: {
      loadedCount: messages.length,
      totalCount: existing.messageCount,
      hasMoreBefore: incoming.hasMoreBefore,
      nextBefore: incoming.nextBefore,
    },
  }
}
