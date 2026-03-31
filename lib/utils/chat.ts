import { AIMode, Conversation, ConversationSummary, Message, MessageRole, SessionSettings } from '@/types'

export function createId(prefix = ''): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return prefix ? `${prefix}-${id}` : id
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function getMessagePreview(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  return normalized.slice(0, 120)
}

export function deriveConversationTitle(content: string, fallback: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim()

  if (!normalized) return fallback
  if (normalized.length <= 56) return normalized

  return `${normalized.slice(0, 56).trimEnd()}...`
}

export function createMessage(input: {
  role: MessageRole
  content: string
  mode: AIMode
  model?: string
  provider?: Message['provider']
  createdAt?: string
  status?: Message['status']
  error?: string
}): Message {
  return {
    id: createId('msg'),
    createdAt: input.createdAt ?? nowIso(),
    status: input.status ?? 'complete',
    ...input,
  }
}

export function toConversationSummary(
  conversation: Conversation
): ConversationSummary {
  const latestMessage = [...conversation.messages]
    .reverse()
    .find((message) => message.role !== 'system')

  return {
    id: conversation.id,
    title: conversation.title,
    mode: conversation.mode,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    isPinned: conversation.isPinned,
    preview: latestMessage ? getMessagePreview(latestMessage.content) : '',
    messageCount: conversation.messages.length,
    sessionSettings: conversation.sessionSettings,
  }
}

export function updateConversationSnapshot(
  conversation: Conversation,
  next: Partial<Conversation> = {}
): Conversation {
  const merged: Conversation = {
    ...conversation,
    ...next,
    messages: next.messages ?? conversation.messages,
    sessionSettings: next.sessionSettings ?? conversation.sessionSettings,
    updatedAt: next.updatedAt ?? nowIso(),
  }

  const firstUserMessage = merged.messages.find((message) => message.role === 'user')
  const fallbackTitle = `New ${merged.mode} chat`

  merged.title = firstUserMessage
    ? deriveConversationTitle(firstUserMessage.content, fallbackTitle)
    : next.title ?? merged.title ?? fallbackTitle

  const summary = toConversationSummary(merged)

  return {
    ...merged,
    preview: summary.preview,
    messageCount: summary.messageCount,
  }
}

export function sortConversationSummaries<T extends ConversationSummary>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function getLastUserMessage(conversation: Conversation): Message | undefined {
  return [...conversation.messages].reverse().find((message) => message.role === 'user')
}

export function getLastAssistantMessage(
  conversation: Conversation
): Message | undefined {
  return [...conversation.messages]
    .reverse()
    .find((message) => message.role === 'assistant')
}

export function getDefaultConversationTitle(mode: AIMode): string {
  switch (mode) {
    case 'creative':
      return 'New Creative Writer Chat'
    case 'logic':
      return 'New Logic Focused Chat'
    case 'code':
      return 'New Code Assistant Chat'
  }
}

export function createConversation(input: {
  mode: AIMode
  sessionSettings: SessionSettings
  title?: string
  messages?: Message[]
  createdAt?: string
  updatedAt?: string
  isPinned?: boolean
}): Conversation {
  const createdAt = input.createdAt ?? nowIso()

  return updateConversationSnapshot({
    id: createId('conv'),
    title: input.title ?? getDefaultConversationTitle(input.mode),
    mode: input.mode,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    isPinned: input.isPinned ?? false,
    preview: '',
    messageCount: input.messages?.length ?? 0,
    sessionSettings: input.sessionSettings,
    messages: input.messages ?? [],
  })
}

export function replaceMessage(
  messages: Message[],
  messageId: string,
  updater: (message: Message) => Message
): Message[] {
  return messages.map((message) =>
    message.id === messageId ? updater(message) : message
  )
}
