import { createHash } from 'node:crypto'
import type { Message, MessagePart } from '@/types'

const MAX_ENTRIES_PER_BATCH = 50
const MAX_CONTENT_CHARS = 100_000
const MAX_PARTS = 200
const MAX_PART_OUTPUT_CHARS = 4_000
const SESSION_ID_PATTERN = /^[\w.-]{1,80}$/

export function isValidCliSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value)
}

/** A user-scoped conversation id, so one user's session id can never reach another's chat. */
export function cliConversationId(userId: string, sessionId: string): string {
  return `cli-${createHash('sha256').update(`${userId}:${sessionId}`).digest('hex').slice(0, 32)}`
}

function boundedArgs(args: unknown): unknown {
  const text = JSON.stringify(args ?? {})
  return text.length <= 8_000 ? JSON.parse(text) : { truncated: true }
}

function cleanPart(part: unknown): MessagePart | null {
  if (!part || typeof part !== 'object') return null
  const value = part as Record<string, unknown>
  const callId = typeof value.callId === 'string' ? value.callId.slice(0, 120) : ''
  const name = typeof value.name === 'string' ? value.name.slice(0, 80) : ''

  if (value.type === 'text' && typeof value.text === 'string') {
    return { type: 'text', text: value.text.slice(0, MAX_CONTENT_CHARS) }
  }
  if (value.type === 'tool_call' && callId && name) {
    return {
      type: 'tool_call',
      callId,
      name,
      label: typeof value.label === 'string' ? value.label.slice(0, 80) : name,
      args: boundedArgs(value.args),
    }
  }
  if (value.type === 'tool_result' && callId && name) {
    return {
      type: 'tool_result',
      callId,
      name,
      ok: value.ok !== false,
      summary: typeof value.summary === 'string' ? value.summary.slice(0, 200) : 'Done',
      output:
        typeof value.output === 'string' ? value.output.slice(0, MAX_PART_OUTPUT_CHARS) : undefined,
    }
  }
  return null
}

/** Validates a batch of zq entries into messages for one conversation. */
export function parseCliEntries(conversationId: string, input: unknown): Message[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ENTRIES_PER_BATCH) {
    return null
  }

  const messages: Message[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null
    const entry = raw as Record<string, unknown>
    if (!isValidCliSessionId(entry.id)) return null
    if (entry.role !== 'user' && entry.role !== 'assistant') return null
    const createdAt = typeof entry.createdAt === 'string' ? new Date(entry.createdAt) : new Date()
    if (Number.isNaN(createdAt.getTime())) return null

    const parts = Array.isArray(entry.parts)
      ? entry.parts.slice(0, MAX_PARTS).map(cleanPart).filter((part): part is MessagePart => Boolean(part))
      : undefined

    messages.push({
      id: `${conversationId}:${entry.id}`,
      role: entry.role,
      content: typeof entry.content === 'string' ? entry.content.slice(0, MAX_CONTENT_CHARS) : '',
      mode: 'code',
      assistantFamily: 'forge',
      createdAt: createdAt.toISOString(),
      status: 'complete',
      model: typeof entry.model === 'string' ? entry.model.slice(0, 40) : undefined,
      parts: parts?.length ? parts : undefined,
    })
  }
  return messages
}
