// Server-only by usage (imported from the chat route and lib/ai/chat), matching
// the lib/ai convention (memory.ts, openrouter.ts, chat.ts) of not pulling the
// 'server-only' guard. The lazy repository import below is the only DB touch.
import { Conversation, ConversationMemoryStructured, Message, SessionSettings } from '@/types'
import { nowIso } from '@/lib/utils/chat'
import {
  isContextDebugEnabled,
  isCrossChatRecallEnabled,
  isMemoryV2Enabled,
} from '@/lib/context/flags'
import { createOpenRouterTextResponse, hasOpenRouterConfig } from './openrouter'

// Cheap, fast model for the async summary job — already in the catalog
// (lib/config/models.ts). Runs off the critical path, so latency here does not
// affect the user-visible response. See AI_CONTEXT_ENGINE.md §4.1.
const SUMMARY_MODEL = 'google/gemini-2.5-flash'
const SUMMARY_MAX_TOKENS = 600
const SUMMARY_TEMPERATURE = 0.1

// How many trailing messages to feed the summarizer when we cannot resume from
// a prior checkpoint, and per-message / total input caps to bound cost.
const FALLBACK_WINDOW = 14
const MAX_MESSAGE_CHARS = 4_000
const MAX_INPUT_CHARS = 20_000
const MAX_BULLETS_PER_SECTION = 8
const MAX_BULLET_CHARS = 240

function debug(stage: string, details?: Record<string, unknown>) {
  if (!isContextDebugEnabled()) return
  console.debug(`[zenquanta/memory-summary] ${stage}`, details ?? {})
}

function nonSystemMessages(conversation: Conversation): Message[] {
  return conversation.messages.filter((message) => message.role !== 'system')
}

function messagesSinceCheckpoint(
  conversation: Conversation,
  throughMessageId?: string | null
): Message[] {
  const messages = nonSystemMessages(conversation)
  if (throughMessageId) {
    const index = messages.findIndex((message) => message.id === throughMessageId)
    if (index >= 0) return messages.slice(index + 1)
  }
  return messages.slice(-FALLBACK_WINDOW)
}

function truncate(input: string, max: number): string {
  const normalized = input.replace(/\s+/g, ' ').trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, max).trimEnd()}…`
}

function toBulletList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const bullet = truncate(item, MAX_BULLET_CHARS)
    if (!bullet) continue
    const key = bullet.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(bullet)
    if (result.length >= MAX_BULLETS_PER_SECTION) break
  }
  return result
}

function coerceStructured(raw: unknown): ConversationMemoryStructured | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const structured: ConversationMemoryStructured = {
    objective:
      typeof value.objective === 'string'
        ? truncate(value.objective, MAX_BULLET_CHARS)
        : undefined,
    decisions: toBulletList(value.decisions),
    constraints: toBulletList(value.constraints),
    facts: toBulletList(value.facts),
    openLoops: toBulletList(value.openLoops),
    preferences: toBulletList(value.preferences),
  }

  const hasContent =
    Boolean(structured.objective) ||
    (structured.decisions?.length ?? 0) > 0 ||
    (structured.constraints?.length ?? 0) > 0 ||
    (structured.facts?.length ?? 0) > 0 ||
    (structured.openLoops?.length ?? 0) > 0 ||
    (structured.preferences?.length ?? 0) > 0

  return hasContent ? structured : null
}

export function parseModelJson(content: string): ConversationMemoryStructured | null {
  const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null

  try {
    return coerceStructured(JSON.parse(trimmed.slice(start, end + 1)))
  } catch {
    return null
  }
}

/**
 * Render a structured summary into the plain-text block consumed by the read
 * path (`buildMemoryBlock` in lib/ai/memory.ts wraps this with a header). The
 * section labels intentionally match the legacy regex summarizer's output so
 * the prompt shape is stable across the MEMORY_V2 flag flip.
 */
export function renderStructuredSummary(structured: ConversationMemoryStructured): string {
  const facts = [...(structured.facts ?? []), ...(structured.constraints ?? [])]
  const sections: Array<string | null> = [
    structured.objective ? `Conversation goal:\n- ${structured.objective}` : null,
    (structured.preferences?.length ?? 0) > 0
      ? `Known preferences:\n${structured.preferences!.map((item) => `- ${item}`).join('\n')}`
      : null,
    facts.length > 0
      ? `Important facts and constraints:\n${facts.map((item) => `- ${item}`).join('\n')}`
      : null,
    (structured.decisions?.length ?? 0) > 0
      ? `Decisions made:\n${structured.decisions!.map((item) => `- ${item}`).join('\n')}`
      : null,
    (structured.openLoops?.length ?? 0) > 0
      ? `Open threads:\n${structured.openLoops!.map((item) => `- ${item}`).join('\n')}`
      : null,
  ]

  return sections.filter(Boolean).join('\n\n')
}

function buildSummaryPrompt(
  previous: ConversationMemoryStructured | null,
  newMessages: Message[]
): string {
  let budget = MAX_INPUT_CHARS
  const transcript: string[] = []
  for (const message of newMessages) {
    const line = `${message.role.toUpperCase()}: ${truncate(message.content, MAX_MESSAGE_CHARS)}`
    if (line.length > budget) break
    budget -= line.length
    transcript.push(line)
  }

  return [
    'You maintain a rolling memory summary of an ongoing chat between a user and an AI assistant.',
    'Update the PREVIOUS SUMMARY using only the NEW MESSAGES. Merge, do not restate everything.',
    '',
    'Rules:',
    '- Preserve identifiers, file paths, API routes, table/column names, numbers, dates, currency, and code EXACTLY. Never paraphrase them.',
    '- Keep each bullet short and atomic. Drop chit-chat and pleasantries.',
    '- If a new message corrects or supersedes an earlier point, keep only the corrected version.',
    '- Return ONLY minified JSON, no prose, no code fences.',
    '',
    'JSON shape:',
    '{"objective":string,"decisions":string[],"constraints":string[],"facts":string[],"openLoops":string[],"preferences":string[]}',
    '',
    'PREVIOUS SUMMARY:',
    previous ? JSON.stringify(previous) : '(none)',
    '',
    'NEW MESSAGES:',
    transcript.join('\n'),
  ].join('\n')
}

export interface RollingSummaryResult {
  text: string
  structured: ConversationMemoryStructured
  throughMessageId: string | null
}

/**
 * Produce an updated structured summary via the cheap model. Returns null when
 * OpenRouter is unconfigured, there is nothing new to summarize, or the model
 * output is unusable — callers must treat null as "leave the existing summary
 * untouched" and never surface an error.
 */
export async function generateRollingSummary(input: {
  conversation: Conversation
  signal?: AbortSignal
}): Promise<RollingSummaryResult | null> {
  if (!hasOpenRouterConfig()) return null

  const { conversation } = input
  const newMessages = messagesSinceCheckpoint(
    conversation,
    conversation.summarizedThroughMessageId
  )
  if (newMessages.length === 0) return null

  const previous = conversation.memorySummaryStructured ?? null
  const prompt = buildSummaryPrompt(previous, newMessages)

  let content: string
  try {
    content = await createOpenRouterTextResponse({
      model: SUMMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: SUMMARY_TEMPERATURE,
      maxTokens: SUMMARY_MAX_TOKENS,
    })
  } catch (error) {
    debug('model-call-failed', {
      conversationId: conversation.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return null
  }

  const structured = parseModelJson(content)
  if (!structured) {
    debug('parse-failed', { conversationId: conversation.id })
    return null
  }

  const lastMessage = nonSystemMessages(conversation).at(-1)
  return {
    text: renderStructuredSummary(structured),
    structured,
    throughMessageId: lastMessage?.id ?? null,
  }
}

/**
 * Background maintenance run after a turn completes and the response has
 * streamed. Never throws — memory work must not break chat. Gated by the
 * MEMORY_V2 flag and the conversation's own memory setting.
 */
export async function maybeUpdateRollingSummary(input: {
  userId: string
  conversation: Conversation
  settings: SessionSettings
  signal?: AbortSignal
}): Promise<void> {
  if (!isMemoryV2Enabled()) return
  if (!input.settings.memory) return

  try {
    const result = await generateRollingSummary({
      conversation: input.conversation,
      signal: input.signal,
    })
    if (!result?.text) return

    // Phase 4 (CROSS_CHAT_RECALL): embed the fresh summary so other
    // conversations can recall this one. Optional — degrades to no embedding
    // when the flag is off or embeddings are unconfigured, leaving any existing
    // embedding untouched.
    let summaryEmbedding: number[] | undefined
    if (isCrossChatRecallEnabled()) {
      try {
        const { createEmbeddings, hasEmbeddingConfig } = await import('@/lib/rag/embeddings')
        if (hasEmbeddingConfig()) {
          const [embedding] = await createEmbeddings([result.text])
          if (embedding) summaryEmbedding = embedding
        }
      } catch (error) {
        debug('summary-embedding-failed', {
          conversationId: input.conversation.id,
          error: error instanceof Error ? error.message : 'unknown',
        })
      }
    }

    // Imported lazily to avoid pulling the repository layer into modules that
    // only need the pure summary helpers above.
    const { neonConversationRepository } = await import('@/lib/db/repositories')
    await neonConversationRepository.updateMemorySummary(input.userId, input.conversation.id, {
      memorySummary: result.text,
      memorySummaryStructured: result.structured,
      summarizedThroughMessageId: result.throughMessageId,
      memoryUpdatedAt: nowIso(),
      ...(summaryEmbedding ? { summaryEmbedding } : {}),
    })
    debug('summary-updated', { conversationId: input.conversation.id })
  } catch (error) {
    debug('maintenance-failed', {
      conversationId: input.conversation.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
