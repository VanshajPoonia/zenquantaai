// Server-only by usage (called from the chat route before generation), matching
// the lib/ai convention of not pulling the 'server-only' guard. Lazy imports are
// the only DB / provider touches.
//
// Context Engine Phase 3 read path — fetch durable memory for the current turn.
// Prefers vector similarity to the user's message, then tops up with the
// highest-importance items so core identity is present even on an unrelated
// query ("always include identity", AI_CONTEXT_ENGINE.md §4.1). Never throws:
// a memory failure must not break generation, so it returns undefined instead.
import { DurableMemoryContext, MemoryItem } from '@/types'
import { isContextDebugEnabled, isMemoryExtractionEnabled } from '@/lib/context/flags'
import { nowIso } from '@/lib/utils/chat'

const MAX_MEMORY_ITEMS = 8

function debug(stage: string, details?: Record<string, unknown>) {
  if (!isContextDebugEnabled()) return
  console.debug(`[zenquanta/memory-retrieval] ${stage}`, details ?? {})
}

export async function retrieveDurableMemoryContext(input: {
  userId: string
  query: string
  projectId?: string | null
  limit?: number
}): Promise<DurableMemoryContext | undefined> {
  if (!isMemoryExtractionEnabled()) return undefined

  const limit = input.limit ?? MAX_MEMORY_ITEMS
  const query = input.query.trim()

  try {
    const { neonMemoryItemsRepository } = await import('@/lib/db/repositories')
    const collected = new Map<string, MemoryItem>()

    if (query) {
      try {
        const { createEmbeddings, hasEmbeddingConfig } = await import('@/lib/rag/embeddings')
        if (hasEmbeddingConfig()) {
          const [embedding] = await createEmbeddings([query])
          if (embedding) {
            const similar = await neonMemoryItemsRepository.search({
              userId: input.userId,
              embedding,
              projectId: input.projectId,
              limit,
            })
            for (const item of similar) collected.set(item.id, item)
          }
        }
      } catch (error) {
        debug('similarity-failed', {
          error: error instanceof Error ? error.message : 'unknown',
        })
      }
    }

    // Top up with importance-ranked items (also the sole source when embeddings
    // are unconfigured or similarity found nothing).
    if (collected.size < limit) {
      const base = await neonMemoryItemsRepository.listActiveForScope({
        userId: input.userId,
        projectId: input.projectId,
        limit,
      })
      for (const item of base) {
        if (!collected.has(item.id)) collected.set(item.id, item)
        if (collected.size >= limit) break
      }
    }

    const items = [...collected.values()].slice(0, limit)
    if (items.length === 0) return undefined

    debug('retrieved', { count: items.length })
    return { retrievedAt: nowIso(), items }
  } catch (error) {
    debug('retrieval-failed', {
      error: error instanceof Error ? error.message : 'unknown',
    })
    return undefined
  }
}
