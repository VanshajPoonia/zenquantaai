// Server-only by usage (called from the chat route before generation), matching
// the lib/ai convention of not pulling the 'server-only' guard. Lazy imports are
// the only DB / provider touches.
//
// Context Engine Phase 4 read path — find the user's OTHER conversations whose
// rolling summary is most similar to the current message ("what did I tell Nova
// about X" answered inside Forge). Requires embeddings: without similarity there
// is no principled way to pick relevant threads, so it returns undefined rather
// than dumping every summary. Never throws — a recall failure must not break
// generation. See AI_CONTEXT_ENGINE.md §4.1.
import { CrossChatRecallContext } from '@/types'
import { isContextDebugEnabled, isCrossChatRecallEnabled } from '@/lib/context/flags'
import { nowIso } from '@/lib/utils/chat'

const MAX_MATCHES = 3

function debug(stage: string, details?: Record<string, unknown>) {
  if (!isContextDebugEnabled()) return
  console.debug(`[zenquanta/cross-chat-recall] ${stage}`, details ?? {})
}

export async function retrieveCrossChatContext(input: {
  userId: string
  query: string
  currentConversationId?: string | null
  limit?: number
}): Promise<CrossChatRecallContext | undefined> {
  if (!isCrossChatRecallEnabled()) return undefined

  const query = input.query.trim()
  if (!query) return undefined

  try {
    const { createEmbeddings, hasEmbeddingConfig } = await import('@/lib/rag/embeddings')
    if (!hasEmbeddingConfig()) return undefined

    const [embedding] = await createEmbeddings([query])
    if (!embedding) return undefined

    const { neonConversationRepository } = await import('@/lib/db/repositories')
    const matches = await neonConversationRepository.searchConversationSummaries({
      userId: input.userId,
      embedding,
      excludeConversationId: input.currentConversationId,
      limit: input.limit ?? MAX_MATCHES,
    })

    if (matches.length === 0) return undefined

    debug('retrieved', { count: matches.length })
    return { retrievedAt: nowIso(), matches }
  } catch (error) {
    debug('retrieval-failed', {
      error: error instanceof Error ? error.message : 'unknown',
    })
    return undefined
  }
}
