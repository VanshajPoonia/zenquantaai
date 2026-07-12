'use client'

import { useCallback } from 'react'
import { Conversation, MemoryVaultConversationSummary, MemoryVaultResponse } from '@/types'

export function useMemoryVault(input: {
  requestJson: <T>(url: string, init?: RequestInit) => Promise<T>
  applyConversationPatch: (
    conversationId: string,
    updater: (conversation: Conversation) => Conversation
  ) => Conversation | null
}) {
  const applyMemoryConversationSummary = useCallback(
    (summary: MemoryVaultConversationSummary) => {
      input.applyConversationPatch(summary.id, (conversation) => ({
        ...conversation,
        sessionSettings: {
          ...conversation.sessionSettings,
          memory: summary.memoryEnabled,
        },
        memorySummary: summary.memorySummary ?? undefined,
        memoryUpdatedAt: summary.memoryUpdatedAt ?? undefined,
        updatedAt: summary.updatedAt,
      }))
    },
    [input]
  )

  const listMemoryVault = useCallback(async () => {
    return await input.requestJson<MemoryVaultResponse>('/api/memory-vault')
  }, [input])

  const setConversationMemoryEnabled = useCallback(
    async (conversationId: string, memoryEnabled: boolean) => {
      const summary = await input.requestJson<MemoryVaultConversationSummary>(
        `/api/conversations/${conversationId}/memory`,
        {
          method: 'PATCH',
          body: JSON.stringify({ memoryEnabled }),
        }
      )

      applyMemoryConversationSummary(summary)
      return summary
    },
    [applyMemoryConversationSummary, input]
  )

  const clearConversationMemory = useCallback(
    async (conversationId: string) => {
      const summary = await input.requestJson<MemoryVaultConversationSummary>(
        `/api/conversations/${conversationId}/memory`,
        {
          method: 'DELETE',
        }
      )

      applyMemoryConversationSummary(summary)
      return summary
    },
    [applyMemoryConversationSummary, input]
  )

  // Durable cross-chat memory (Phase 3c) is not part of conversation state, so
  // there is nothing to patch locally — the Vault refetches after a forget.
  const forgetDurableMemory = useCallback(
    async (itemId: string) => {
      await input.requestJson<{ id: string; forgotten: boolean }>(
        `/api/memory-vault/durable/${itemId}`,
        { method: 'DELETE' }
      )
    },
    [input]
  )

  return {
    listMemoryVault,
    setConversationMemoryEnabled,
    clearConversationMemory,
    forgetDurableMemory,
  }
}
