import { Conversation, Message } from '@/types'
import { nowIso } from '@/lib/utils/chat'

const RECENT_TURN_MESSAGE_LIMIT = 8
const MAX_MEMORY_ITEMS = 6
const MAX_MEMORY_LINE_LENGTH = 220

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

function toBullet(input: string): string | null {
  const normalized = normalizeWhitespace(input)
  if (!normalized) return null

  return normalized.length <= MAX_MEMORY_LINE_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_MEMORY_LINE_LENGTH).trimEnd()}...`
}

function dedupe(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    if (!item) continue
    const normalized = item.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(item)
  }

  return result
}

function getNonSystemMessages(conversation: Conversation): Message[] {
  return conversation.messages.filter((message) => message.role !== 'system')
}

function getRecentMessages(conversation: Conversation): Message[] {
  const messages = getNonSystemMessages(conversation)
  return messages.slice(-RECENT_TURN_MESSAGE_LIMIT)
}

function getOlderMessages(conversation: Conversation): Message[] {
  const messages = getNonSystemMessages(conversation)
  return messages.slice(0, Math.max(0, messages.length - RECENT_TURN_MESSAGE_LIMIT))
}

function collectPreferences(messages: Message[]): string[] {
  const patterns = [
    /\b(?:prefer|preferred|please use|please keep|make sure|avoid|do not|don't|without|with)\b/i,
    /\b(?:i want|i need|we need|we want|let's|lets|use)\b/i,
  ]

  return dedupe(
    messages
      .filter((message) => message.role === 'user')
      .flatMap((message) =>
        message.content
          .split(/\n+/)
          .map(normalizeWhitespace)
          .filter((line) => patterns.some((pattern) => pattern.test(line)))
          .map(toBullet)
      )
  ).slice(0, MAX_MEMORY_ITEMS)
}

function collectFacts(messages: Message[]): string[] {
  return dedupe(
    messages.flatMap((message) => {
      const attachmentFacts = (message.attachments ?? []).map((attachment) =>
        toBullet(
          `Referenced file: ${attachment.name} (${attachment.kind})${
            attachment.textExcerpt ? ` — ${attachment.textExcerpt}` : ''
          }`
        )
      )

      const contentFacts = message.content
        .split(/\n+/)
        .map(normalizeWhitespace)
        .filter(
          (line) =>
            /\b(?:deadline|timeline|scope|project|constraint|must|required|target|goal|database|supabase|vercel|auth|api)\b/i.test(
              line
            ) || /\d/.test(line)
        )
        .map(toBullet)

      return [...attachmentFacts, ...contentFacts]
    })
  ).slice(0, MAX_MEMORY_ITEMS)
}

function collectDecisions(messages: Message[]): string[] {
  return dedupe(
    messages.flatMap((message) =>
      message.content
        .split(/\n+/)
        .map(normalizeWhitespace)
        .filter((line) =>
          /\b(?:decided|decision|go with|ship|use|chosen|selected|will use|will keep|we'll|we will)\b/i.test(
            line
          )
        )
        .map(toBullet)
    )
  ).slice(0, MAX_MEMORY_ITEMS)
}

function collectOpenThreads(
  recentMessages: Message[],
  olderMessages: Message[]
): string[] {
  const latestUser = [...recentMessages]
    .reverse()
    .find((message) => message.role === 'user')

  const olderUserRequests = olderMessages
    .filter((message) => message.role === 'user')
    .slice(-2)
    .map((message) => toBullet(message.content))

  return dedupe([
    latestUser ? toBullet(latestUser.content) : null,
    ...olderUserRequests,
  ]).slice(0, MAX_MEMORY_ITEMS)
}

export function buildConversationMemorySummary(conversation: Conversation): string {
  const olderMessages = getOlderMessages(conversation)
  const recentMessages = getRecentMessages(conversation)
  const firstUserMessage = getNonSystemMessages(conversation).find(
    (message) => message.role === 'user'
  )

  if (!firstUserMessage && olderMessages.length === 0 && recentMessages.length === 0) {
    return ''
  }

  const goal = toBullet(
    firstUserMessage?.content || conversation.title || 'Continue helping with this conversation.'
  )
  const preferences = collectPreferences(olderMessages)
  const facts = collectFacts(olderMessages)
  const decisions = collectDecisions(olderMessages)
  const openThreads = collectOpenThreads(recentMessages, olderMessages)

  const sections = [
    goal ? `Conversation goal:\n- ${goal}` : null,
    preferences.length > 0
      ? `Known preferences:\n${preferences.map((item) => `- ${item}`).join('\n')}`
      : null,
    facts.length > 0
      ? `Important facts and constraints:\n${facts
          .map((item) => `- ${item}`)
          .join('\n')}`
      : null,
    decisions.length > 0
      ? `Decisions made:\n${decisions.map((item) => `- ${item}`).join('\n')}`
      : null,
    openThreads.length > 0
      ? `Open threads:\n${openThreads.map((item) => `- ${item}`).join('\n')}`
      : null,
  ].filter(Boolean)

  return sections.join('\n\n')
}

export function buildMemoryBlock(summary?: string): string {
  const normalized = normalizeWhitespace(summary ?? '')
  if (!normalized) return ''

  return `[Conversation memory]\n${summary?.trim() ?? ''}`
}

export function getRecentContextMessages(conversation: Conversation): Message[] {
  return getRecentMessages(conversation)
}

export function updateConversationMemory(
  conversation: Conversation,
  enabled: boolean
): Pick<Conversation, 'memorySummary' | 'memoryUpdatedAt'> {
  if (!enabled) {
    return {
      memorySummary: conversation.memorySummary,
      memoryUpdatedAt: conversation.memoryUpdatedAt,
    }
  }

  const summary = buildConversationMemorySummary(conversation)

  return {
    memorySummary: summary || undefined,
    memoryUpdatedAt: summary ? nowIso() : conversation.memoryUpdatedAt,
  }
}
