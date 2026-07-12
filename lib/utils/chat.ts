import {
  AIMode,
  AppSettings,
  Attachment,
  Conversation,
  ConversationSummary,
  CustomAssistant,
  CustomAssistantReference,
  Message,
  MessageRole,
  Project,
  PromptLibraryItem,
  SessionSettings,
} from '@/types'
import { createSessionSettings, DEFAULT_APP_SETTINGS, DEFAULT_PROJECT_ID } from '@/lib/config'
import { sumConversationUsage } from './cost'

export function normalizeAppSettingsState(input: AppSettings): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...input,
    assistantRecommendations: {
      ...DEFAULT_APP_SETTINGS.assistantRecommendations,
      ...input.assistantRecommendations,
    },
    sessionDefaults: createSessionSettings(input.defaultMode, input.sessionDefaults),
    onboarding: {
      ...DEFAULT_APP_SETTINGS.onboarding,
      ...input.onboarding,
      installedPromptIds: Array.isArray(input.onboarding?.installedPromptIds)
        ? input.onboarding.installedPromptIds
        : [],
    },
  }
}

export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })
}

export function sortPrompts(prompts: PromptLibraryItem[]): PromptLibraryItem[] {
  return [...prompts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function sortCustomAssistants(assistants: CustomAssistant[]): CustomAssistant[] {
  return [...assistants].sort((a, b) => {
    if (a.isEnabled !== b.isEnabled) {
      return a.isEnabled ? -1 : 1
    }

    if (Boolean(a.metadata.isPinned) !== Boolean(b.metadata.isPinned)) {
      return a.metadata.isPinned ? -1 : 1
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

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

export function nextMessageTimestamp(
  ...precedingTimestamps: Array<string | undefined>
): string {
  const parsed = precedingTimestamps
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))

  const latest = parsed.length > 0 ? Math.max(...parsed) : Date.now()

  return new Date(latest + 1).toISOString()
}

export function compareMessagesChronologically(
  a: { createdAt: string | Date; role: string },
  b: { createdAt: string | Date; role: string }
): number {
  const timeDifference =
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

  if (timeDifference !== 0) return timeDifference

  if (a.role === 'user' && b.role === 'assistant') return -1
  if (a.role === 'assistant' && b.role === 'user') return 1

  return 0
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
  attachments?: Attachment[]
  usage?: Message['usage']
  sources?: Message['sources']
  parentUserMessageId?: string
  branchLabel?: string
  customAssistantId?: string | null
  customAssistant?: CustomAssistantReference | null
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
    projectId: conversation.projectId,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    isPinned: conversation.isPinned,
    preview: latestMessage ? getMessagePreview(latestMessage.content) : '',
    messageCount: conversation.messages.length,
    sessionSettings: conversation.sessionSettings,
    memorySummary: conversation.memorySummary,
    memoryUpdatedAt: conversation.memoryUpdatedAt,
    customAssistantId: conversation.customAssistantId,
    customAssistant: conversation.customAssistant,
  }
}

export function updateConversationSnapshot(
  conversation: Conversation,
  next: Partial<Conversation> = {}
): Conversation {
  const mergedMessages = next.messages ?? conversation.messages
  const attachments = [
    ...(next.attachments ?? conversation.attachments ?? []),
    ...mergedMessages.flatMap((message) => message.attachments ?? []),
  ].filter(
    (attachment, index, all) =>
      all.findIndex((item) => item.id === attachment.id) === index
  )

  const merged: Conversation = {
    ...conversation,
    ...next,
    messages: mergedMessages,
    projectId: next.projectId ?? conversation.projectId ?? DEFAULT_PROJECT_ID,
    sessionSettings: next.sessionSettings ?? conversation.sessionSettings,
    attachments,
    memorySummary: next.memorySummary ?? conversation.memorySummary,
    memoryUpdatedAt: next.memoryUpdatedAt ?? conversation.memoryUpdatedAt,
    customAssistantId:
      typeof next.customAssistantId !== 'undefined'
        ? next.customAssistantId
        : conversation.customAssistantId,
    customAssistant:
      typeof next.customAssistant !== 'undefined'
        ? next.customAssistant
        : conversation.customAssistant,
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
    usage: next.usage ?? sumConversationUsage(merged),
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
    case 'general':
      return 'New Nova Chat'
    case 'creative':
      return 'New Velora Chat'
    case 'logic':
      return 'New Axiom Chat'
    case 'code':
      return 'New Forge Chat'
    case 'live':
      return 'New Pulse Chat'
    case 'image':
      return 'New Prism Chat'
  }
}

export function createConversation(input: {
  id?: string
  mode: AIMode
  projectId?: string
  sessionSettings: SessionSettings
  title?: string
  messages?: Message[]
  createdAt?: string
  updatedAt?: string
  isPinned?: boolean
  attachments?: Attachment[]
  usage?: Conversation['usage']
  memorySummary?: string
  memoryUpdatedAt?: string
  customAssistantId?: string | null
  customAssistant?: CustomAssistantReference | null
}): Conversation {
  const createdAt = input.createdAt ?? nowIso()

  return updateConversationSnapshot({
    id: input.id ?? createId('conv'),
    title: input.title ?? getDefaultConversationTitle(input.mode),
    mode: input.mode,
    projectId: input.projectId ?? DEFAULT_PROJECT_ID,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    isPinned: input.isPinned ?? false,
    preview: '',
    messageCount: input.messages?.length ?? 0,
    sessionSettings: input.sessionSettings,
    messages: input.messages ?? [],
    attachments: input.attachments ?? [],
    usage: input.usage,
    memorySummary: input.memorySummary,
    memoryUpdatedAt: input.memoryUpdatedAt,
    customAssistantId: input.customAssistantId ?? null,
    customAssistant: input.customAssistant ?? null,
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
