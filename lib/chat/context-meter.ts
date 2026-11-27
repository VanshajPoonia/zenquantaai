import { estimateTokens } from '@/lib/billing/costs'
import { RECENT_TURN_MESSAGE_LIMIT, selectBoundedContextMessages } from '@/lib/ai/memory'
import type { Attachment, Message } from '@/types'

// The system prompt and the time note that lib/ai/chat.ts adds to every request.
const FIXED_PROMPT_CHARS = 2_000
// lib/ai/chat.ts inlines at most this much text per attached file.
const ATTACHMENT_TEXT_CHARS = 1_500
const ATTACHMENT_HEADER_CHARS = 80
const DRAFT_MESSAGE_ID = 'context-meter-draft'

export interface ContextMeterInput {
  /** Instructions the server adds: custom assistant and user instructions blocks. */
  instructionTexts: string[]
  summary?: string | null
  messages: Message[]
  draft: string
  draftAttachments: Attachment[]
  includeAttachmentText: boolean
  windowTokens: number | null
}

export interface ContextMeterEstimate {
  instructionsTokens: number
  summaryTokens: number
  recentTokens: number
  draftTokens: number
  totalTokens: number
  windowTokens: number | null
  /** Share of the window, 0 to 1 or more. Null when the window is unknown. */
  share: number | null
  /** Earlier messages that go word for word with the next request. */
  recentCount: number
  windowSize: number
}

function charsToTokens(chars: number): number {
  return Math.ceil(chars / 4)
}

function attachmentTokens(attachments: Attachment[] | undefined, include: boolean): number {
  if (!include || !attachments?.length) return 0
  return attachments.reduce((total, attachment) => {
    const textChars = Math.min(attachment.textContent?.length ?? 0, ATTACHMENT_TEXT_CHARS)
    return total + charsToTokens(ATTACHMENT_HEADER_CHARS + textChars)
  }, 0)
}

/** Estimates what the next text request sends, the way lib/ai/chat.ts builds it. */
export function estimateContextUsage(input: ContextMeterInput): ContextMeterEstimate {
  const instructionsTokens =
    charsToTokens(FIXED_PROMPT_CHARS) +
    input.instructionTexts.reduce((total, text) => total + estimateTokens(text), 0)
  const summaryTokens = input.summary?.trim()
    ? estimateTokens(`[Conversation memory]\n${input.summary.trim()}`)
    : 0

  const draftMessage: Message = {
    id: DRAFT_MESSAGE_ID,
    role: 'user',
    content: input.draft,
    mode: 'general',
    createdAt: new Date().toISOString(),
    attachments: input.draftAttachments,
  }
  const candidates = [...input.messages.filter((message) => message.role !== 'system'), draftMessage]
  const selected = selectBoundedContextMessages(candidates.slice(-RECENT_TURN_MESSAGE_LIMIT))

  let recentTokens = 0
  let draftTokens = 0
  let recentCount = 0
  for (const message of selected) {
    const attached =
      message.role === 'user' ? attachmentTokens(message.attachments, input.includeAttachmentText) : 0
    const tokens = estimateTokens(message.content) + attached
    if (message.id === DRAFT_MESSAGE_ID) {
      draftTokens = tokens
    } else {
      recentTokens += tokens
      recentCount += 1
    }
  }

  const totalTokens = instructionsTokens + summaryTokens + recentTokens + draftTokens
  const windowTokens = input.windowTokens && input.windowTokens > 0 ? input.windowTokens : null

  return {
    instructionsTokens,
    summaryTokens,
    recentTokens,
    draftTokens,
    totalTokens,
    windowTokens,
    share: windowTokens ? totalTokens / windowTokens : null,
    recentCount,
    windowSize: RECENT_TURN_MESSAGE_LIMIT,
  }
}
