'use client'

import { useCallback } from 'react'
import { AIMode, Conversation, ModelComparison, SessionSettings } from '@/types'

export interface RunModelComparisonInput {
  content: string
  targetModes: AIMode[]
}

export function useModelComparisons(input: {
  requestJson: <T>(url: string, init?: RequestInit) => Promise<T>
  upsertConversation: (conversation: Conversation, makeCurrent?: boolean) => void
  currentMode: AIMode
  sessionSettings: SessionSettings
  currentChatRef: React.RefObject<Conversation | null>
}) {
  const runModelComparison = useCallback(
    async ({ content, targetModes }: RunModelComparisonInput) => {
      const trimmedContent = content.trim()
      if (!trimmedContent || targetModes.length < 2) return null

      try {
        const result = await input.requestJson<{
          comparison: ModelComparison
          conversation: Conversation
        }>('/api/model-comparisons', {
          method: 'POST',
          body: JSON.stringify({
            content: trimmedContent,
            mode: input.currentMode,
            targetModes,
            conversationId: input.currentChatRef.current?.id,
            conversation: input.currentChatRef.current ?? undefined,
            settings: input.sessionSettings,
          }),
        })

        input.upsertConversation(result.conversation)
        return result.comparison
      } catch (error) {
        console.error('Failed to compare models.', error)
        throw error
      }
    },
    [input]
  )

  const chooseModelComparisonResponse = useCallback(
    async (comparisonId: string, candidateId: string) => {
      try {
        const result = await input.requestJson<{
          comparison: ModelComparison | null
          conversation: Conversation
        }>(`/api/model-comparisons/${comparisonId}/choose`, {
          method: 'POST',
          body: JSON.stringify({ candidateId }),
        })

        input.upsertConversation(result.conversation)
        return result.conversation
      } catch (error) {
        console.error('Failed to save comparison response.', error)
        return null
      }
    },
    [input]
  )

  return { runModelComparison, chooseModelComparisonResponse }
}
