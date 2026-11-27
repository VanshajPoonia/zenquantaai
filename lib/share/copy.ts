import type {
  AssistantFamily,
  Conversation,
  ConversationShareSnapshot,
  Message,
  MessageSource,
  SessionSettings,
  SharedChatMessage,
} from '@/types'
import { createConversation, createId } from '@/lib/utils/chat'
import { SHARED_IMAGE_PLACEHOLDER, toShareMode } from './snapshot'

const FAMILIES = new Set<AssistantFamily>(['nova', 'velora', 'axiom', 'forge', 'pulse', 'prism'])
const MAX_TITLE_LENGTH = 120

/** Adds a suffix such as " (shared)" while keeping the title within the rename limit. */
export function withTitleSuffix(title: string, suffix: string): string {
  const base = title.trim() || 'Untitled chat'
  return `${base.slice(0, MAX_TITLE_LENGTH - suffix.length).trimEnd()}${suffix}`
}

function toSources(message: SharedChatMessage): MessageSource[] {
  return message.sources.flatMap((source) => {
    if (!source.url) return []
    try {
      return [
        {
          id: createId('src'),
          title: source.title,
          url: source.url,
          domain: new URL(source.url).hostname,
          snippet: '',
          kind: 'web' as const,
        },
      ]
    } catch {
      return []
    }
  })
}

function toMessage(message: SharedChatMessage): Message {
  const createdAt = Number.isNaN(Date.parse(message.createdAt))
    ? new Date().toISOString()
    : message.createdAt
  const family = message.assistantFamily && FAMILIES.has(message.assistantFamily)
    ? message.assistantFamily
    : undefined

  return {
    id: createId('msg'),
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.imageOmitted
      ? [message.content, `_${SHARED_IMAGE_PLACEHOLDER}._`].filter(Boolean).join('\n\n')
      : message.content,
    mode: toShareMode(message.mode),
    createdAt,
    status: 'complete',
    assistantFamily: message.role === 'assistant' ? family : undefined,
    parts: message.parts.length > 0 ? message.parts : undefined,
    sources: toSources(message),
  }
}

/** Turns a shared snapshot into a new web chat for the visitor, with their own settings. */
export function buildConversationFromShare(
  snapshot: ConversationShareSnapshot,
  sessionSettings: SessionSettings
): Conversation {
  return createConversation({
    mode: toShareMode(snapshot.mode),
    title: withTitleSuffix(snapshot.title, ' (shared)'),
    sessionSettings,
    messages: snapshot.messages.map(toMessage),
  })
}
