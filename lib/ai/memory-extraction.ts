// Server-only by usage (imported from the chat route), matching the lib/ai
// convention of not pulling the 'server-only' guard. The lazy repository and
// embeddings imports below are the only DB / provider touches.
//
// Context Engine Phase 3 — the durable-memory write gate. After a turn streams,
// a cheap model decides whether anything is worth remembering long-term and, if
// so, emits atomic candidates keyed by a stable canonical key so later
// corrections supersede stale facts. Runs off the critical path; never throws.
// See AI_CONTEXT_ENGINE.md §4.1.
import { Conversation, MemoryCandidate, MemoryItemKind, Message, SessionSettings } from '@/types'
import { isContextDebugEnabled, isMemoryExtractionEnabled } from '@/lib/context/flags'
import { createOpenRouterTextResponse, hasOpenRouterConfig } from './openrouter'

const EXTRACTION_MODEL = 'google/gemini-2.5-flash'
const EXTRACTION_MAX_TOKENS = 700
const EXTRACTION_TEMPERATURE = 0.1

// The just-completed exchange is what we mine; a small window keeps the cheap
// call cheap while canonical-key dedupe collapses anything re-seen across turns.
const EXTRACTION_WINDOW = 6
const MAX_MESSAGE_CHARS = 4_000
const MAX_INPUT_CHARS = 16_000
const MAX_CANDIDATES = 6
const MAX_CONTENT_CHARS = 240
const MAX_KEY_CHARS = 80
// Below this the latest user turn is treated as trivially non-durable (a
// greeting / acknowledgement) and skipped for free, before any model call.
const MIN_DURABLE_USER_CHARS = 12

const VALID_KINDS: ReadonlySet<MemoryItemKind> = new Set<MemoryItemKind>([
  'identity',
  'preference',
  'constraint',
  'decision',
  'fact',
  'open_loop',
  'project_status',
])

function debug(stage: string, details?: Record<string, unknown>) {
  if (!isContextDebugEnabled()) return
  console.debug(`[zenquanta/memory-extraction] ${stage}`, details ?? {})
}

function nonSystemMessages(conversation: Conversation): Message[] {
  return conversation.messages.filter((message) => message.role !== 'system')
}

function extractionWindow(conversation: Conversation): Message[] {
  return nonSystemMessages(conversation).slice(-EXTRACTION_WINDOW)
}

function truncate(input: string, max: number): string {
  const normalized = input.replace(/\s+/g, ' ').trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, max).trimEnd()}…`
}

function normalizeKey(value: unknown, content: string): string {
  const raw =
    typeof value === 'string' && value.trim()
      ? value
      : `fact.${content.slice(0, 40)}`
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '')
  return slug.slice(0, MAX_KEY_CHARS) || 'fact.general'
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * Deterministic pre-gate: only skip turns that are trivially non-durable (no new
 * user message, or a short acknowledgement with no attachment). Everything else
 * is handed to the model, which is the real judge.
 */
export function shouldAttemptExtraction(messages: Message[]): boolean {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')
  if (!lastUser) return false
  const hasAttachment = (lastUser.attachments ?? []).length > 0
  if (hasAttachment) return true
  return lastUser.content.trim().length >= MIN_DURABLE_USER_CHARS
}

function coerceCandidate(raw: unknown): MemoryCandidate | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>

  const content = truncate(
    typeof value.content === 'string' ? value.content : '',
    MAX_CONTENT_CHARS
  )
  if (!content) return null

  const kind: MemoryItemKind = VALID_KINDS.has(value.kind as MemoryItemKind)
    ? (value.kind as MemoryItemKind)
    : 'fact'

  return {
    kind,
    canonicalKey: normalizeKey(value.canonicalKey ?? value.key, content),
    content,
    importance: Math.round(clamp(Number(value.importance ?? 2), 1, 3)),
    confidence: clamp(Number(value.confidence ?? 0.7), 0, 1),
  }
}

function extractJsonArray(content: string): unknown[] | null {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  const arrStart = trimmed.indexOf('[')
  const arrEnd = trimmed.lastIndexOf(']')
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      const parsed = JSON.parse(trimmed.slice(arrStart, arrEnd + 1))
      if (Array.isArray(parsed)) return parsed
    } catch {
      // fall through to the object-wrapper attempt
    }
  }

  const objStart = trimmed.indexOf('{')
  const objEnd = trimmed.lastIndexOf('}')
  if (objStart !== -1 && objEnd > objStart) {
    try {
      const parsed = JSON.parse(trimmed.slice(objStart, objEnd + 1)) as Record<string, unknown>
      for (const key of ['memories', 'items', 'candidates', 'facts']) {
        if (Array.isArray(parsed[key])) return parsed[key] as unknown[]
      }
    } catch {
      return null
    }
  }

  return null
}

export function parseCandidates(content: string): MemoryCandidate[] {
  const array = extractJsonArray(content)
  if (!array) return []

  // Dedupe by canonical key within the batch, keeping the highest-importance
  // wording. Re-setting an existing key preserves its original position, so the
  // final slice keeps the first MAX_CANDIDATES distinct keys in model order.
  const byKey = new Map<string, MemoryCandidate>()
  for (const raw of array) {
    const candidate = coerceCandidate(raw)
    if (!candidate) continue
    const existing = byKey.get(candidate.canonicalKey)
    if (!existing || candidate.importance > existing.importance) {
      byKey.set(candidate.canonicalKey, candidate)
    }
  }

  return [...byKey.values()].slice(0, MAX_CANDIDATES)
}

function buildExtractionPrompt(messages: Message[]): string {
  let budget = MAX_INPUT_CHARS
  const transcript: string[] = []
  for (const message of messages) {
    const line = `${message.role.toUpperCase()}: ${truncate(message.content, MAX_MESSAGE_CHARS)}`
    if (line.length > budget) break
    budget -= line.length
    transcript.push(line)
  }

  return [
    'You extract durable, reusable memory from a chat between a user and an AI assistant.',
    'Return ONLY facts worth remembering for future, unrelated chats — who the user is, their',
    'projects, stable preferences, decisions they made, and hard constraints.',
    '',
    'Rules:',
    '- Ignore small talk, one-off task phrasing, and the assistant\'s suggestions the user did not accept.',
    '- Preserve identifiers, file paths, API routes, table/column names, numbers, dates, currency, and code EXACTLY.',
    '- Each item must be atomic (one fact) and self-contained (understandable with no other context).',
    '- canonicalKey is a stable lowercase dotted slug naming the SUBJECT so a later correction about',
    '  the same subject collides with it, e.g. "user.name", "project.database", "user.preference.tone".',
    '- kind is one of: identity, preference, constraint, decision, fact, open_loop, project_status.',
    '- importance is 1..3 (3 = core identity or firm decision). confidence is 0..1.',
    '- If nothing is durable, return exactly [].',
    '- Return ONLY a minified JSON array, no prose, no code fences.',
    '',
    'Shape: [{"kind":string,"canonicalKey":string,"content":string,"importance":number,"confidence":number}]',
    '',
    'CONVERSATION:',
    transcript.join('\n'),
  ].join('\n')
}

/**
 * Run the cheap-model write gate over the latest exchange. Returns [] when
 * OpenRouter is unconfigured, the turn is trivially non-durable, or the model
 * output is unusable — callers treat [] as "store nothing".
 */
export async function extractDurableMemories(input: {
  conversation: Conversation
  signal?: AbortSignal
}): Promise<MemoryCandidate[]> {
  if (!hasOpenRouterConfig()) return []

  const { conversation } = input
  const window = extractionWindow(conversation)
  if (window.length === 0) return []
  if (!shouldAttemptExtraction(window)) {
    debug('pre-gate-skip', { conversationId: conversation.id })
    return []
  }

  let content: string
  try {
    content = await createOpenRouterTextResponse({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: buildExtractionPrompt(window) }],
      temperature: EXTRACTION_TEMPERATURE,
      maxTokens: EXTRACTION_MAX_TOKENS,
    })
  } catch (error) {
    debug('model-call-failed', {
      conversationId: conversation.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return []
  }

  const candidates = parseCandidates(content)
  return candidates.map((candidate) => ({
    ...candidate,
    projectId: conversation.projectId,
    sourceConversationId: conversation.id,
    mode: conversation.mode,
  }))
}

/**
 * Background maintenance run after a turn completes and the response has
 * streamed. Never throws — memory work must not break chat. Gated by the
 * MEMORY_EXTRACTION flag and the conversation's own memory setting.
 */
export async function maybeExtractDurableMemories(input: {
  userId: string
  conversation: Conversation
  settings: SessionSettings
  signal?: AbortSignal
}): Promise<void> {
  if (!isMemoryExtractionEnabled()) return
  if (!input.settings.memory) return

  try {
    const candidates = await extractDurableMemories({
      conversation: input.conversation,
      signal: input.signal,
    })
    if (candidates.length === 0) return

    // Embeddings are optional: when unconfigured, items are still stored and the
    // read path falls back to importance/recency ordering. Imported lazily so
    // the pure helpers above don't drag in the provider layer.
    try {
      const { createEmbeddings, hasEmbeddingConfig } = await import('@/lib/rag/embeddings')
      if (hasEmbeddingConfig()) {
        const embeddings = await createEmbeddings(
          candidates.map((candidate) => `${candidate.canonicalKey}: ${candidate.content}`)
        )
        if (embeddings.length === candidates.length) {
          candidates.forEach((candidate, index) => {
            candidate.embedding = embeddings[index] ?? null
          })
        }
      }
    } catch (error) {
      debug('embedding-failed', {
        conversationId: input.conversation.id,
        error: error instanceof Error ? error.message : 'unknown',
      })
    }

    const { neonMemoryItemsRepository } = await import('@/lib/db/repositories')
    await neonMemoryItemsRepository.record(input.userId, candidates)
    debug('memories-recorded', {
      conversationId: input.conversation.id,
      count: candidates.length,
    })
  } catch (error) {
    debug('extraction-failed', {
      conversationId: input.conversation.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
