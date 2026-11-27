import type {
  AIMode,
  AssistantFamily,
  Conversation,
  ConversationShareSnapshot,
  Message,
  MessagePart,
  MessageSource,
  SharedChatMessage,
  SharedChatSource,
} from '@/types'
import { getAssistantFamilyFromMode } from '@/lib/config/assistants'
import { createRedactor } from './redact'

export const SHARED_TOOL_TEXT_LIMIT = 2_000
export const MAX_SHARED_MESSAGES = 500
export const MAX_SNAPSHOT_CHARS = 2_000_000
export const SHARED_IMAGE_PLACEHOLDER = 'Image not included in shared chats'

const MODES = new Set<AIMode>(['general', 'creative', 'logic', 'code', 'live', 'image'])
const MAX_TOOL_ARGS = 10

type Redact = (text: string) => string

export interface ConversationShareBuild {
  snapshot: ConversationShareSnapshot
  messageCount: number
  redactionCount: number
}

export function cutText(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text
}

export function toShareMode(value: unknown): AIMode {
  return typeof value === 'string' && MODES.has(value as AIMode) ? (value as AIMode) : 'general'
}

function safePublicUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function toSharedSource(source: MessageSource, redact: Redact): SharedChatSource {
  const url = source.kind === 'file' ? null : safePublicUrl(source.url)
  return {
    title: cutText(redact(source.title || source.domain || 'Source'), 300),
    url: url ? redact(url) : null,
  }
}

// Redact before cutting so a cut never leaves part of a key behind.
function cleanToolText(value: string, redact: Redact, limit = SHARED_TOOL_TEXT_LIMIT): string {
  return cutText(redact(value), limit)
}

function cleanToolArgs(args: unknown, redact: Redact): unknown {
  if (typeof args === 'string') return cleanToolText(args, redact)
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null

  const entries = Object.entries(args as Record<string, unknown>).slice(0, MAX_TOOL_ARGS)
  return Object.fromEntries(
    entries.flatMap(([key, value]): Array<[string, string | number | boolean]> => {
      const name = key.slice(0, 60)
      if (typeof value === 'string') return [[name, cleanToolText(value, redact)]]
      if (typeof value === 'number' || typeof value === 'boolean') return [[name, value]]
      if (value && typeof value === 'object') {
        return [[name, cleanToolText(JSON.stringify(value), redact)]]
      }
      return []
    })
  )
}

/** Keeps tool calls and results only. Result data, sources and ids that point at private records are dropped. */
function cleanToolParts(parts: MessagePart[] | undefined, redact: Redact): MessagePart[] {
  if (!parts?.length) return []

  return parts.flatMap((part): MessagePart[] => {
    if (part.type === 'tool_call') {
      return [
        {
          type: 'tool_call',
          callId: part.callId.slice(0, 100),
          name: part.name.slice(0, 80),
          label: cutText(redact(part.label), 120),
          args: cleanToolArgs(part.args, redact),
        },
      ]
    }
    if (part.type === 'tool_result') {
      return [
        {
          type: 'tool_result',
          callId: part.callId.slice(0, 100),
          name: part.name.slice(0, 80),
          ok: Boolean(part.ok),
          summary: cleanToolText(part.summary ?? '', redact, 300),
          ...(part.output ? { output: cleanToolText(part.output, redact) } : {}),
        },
      ]
    }
    return []
  })
}

function isShareable(message: Message): message is Message & { role: 'user' | 'assistant' } {
  if (message.role !== 'user' && message.role !== 'assistant') return false
  if (message.status === 'streaming') return false
  return message.role === 'user' || Boolean(message.content.trim()) || Boolean(message.parts?.length)
}

function toSharedMessage(
  message: Message & { role: 'user' | 'assistant' },
  redact: Redact
): SharedChatMessage {
  const mode = toShareMode(message.mode)
  const attachments = message.attachments ?? []
  const isPrismImage =
    message.role === 'assistant' && attachments.some((attachment) => attachment.kind === 'image')
  const assistantFamily: AssistantFamily | null =
    message.role === 'assistant' ? message.assistantFamily ?? getAssistantFamilyFromMode(mode) : null

  return {
    role: message.role,
    content: redact(message.content),
    mode,
    assistantFamily,
    customAssistant:
      message.role === 'assistant' && message.customAssistant
        ? {
            name: cutText(redact(message.customAssistant.name), 80),
            iconEmoji: message.customAssistant.iconEmoji.slice(0, 8),
          }
        : null,
    createdAt: message.createdAt,
    parts: cleanToolParts(message.parts, redact),
    sources: (message.sources ?? []).slice(0, 50).map((source) => toSharedSource(source, redact)),
    attachmentNames: isPrismImage
      ? []
      : attachments.map((attachment) => cutText(redact(attachment.name), 200)),
    imageOmitted: isPrismImage,
  }
}

/** Builds the public snapshot from a conversation the server loaded for its owner. */
export function buildConversationShareSnapshot(conversation: Conversation): ConversationShareBuild {
  const redactor = createRedactor()
  const redact: Redact = (text) => redactor.redact(text)

  const messages = conversation.messages.filter(isShareable).map((message) => toSharedMessage(message, redact))
  const snapshot: ConversationShareSnapshot = {
    version: 1,
    title: cutText(redact(conversation.title || 'Untitled chat'), 200),
    mode: toShareMode(conversation.mode),
    surface: conversation.surface === 'cli' ? 'cli' : 'web',
    messages,
  }

  return {
    snapshot,
    messageCount: messages.length,
    redactionCount: redactor.count,
  }
}
