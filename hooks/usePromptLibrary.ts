'use client'

import { useCallback } from 'react'
import { sortPrompts } from '@/lib/utils/chat'
import { AIMode, PromptLibraryItem } from '@/types'

export interface SavePromptInput {
  title: string
  content: string
  mode: AIMode | 'any'
}

export function usePromptLibrary(input: {
  requestJson: <T>(url: string, init?: RequestInit) => Promise<T>
  promptLibrary: PromptLibraryItem[]
  setPromptLibrary: React.Dispatch<React.SetStateAction<PromptLibraryItem[]>>
}) {
  const savePrompt = useCallback(
    async ({ title, content, mode }: SavePromptInput) => {
      const trimmedTitle = title.trim()
      const trimmedContent = content.trim()

      if (!trimmedTitle || !trimmedContent) {
        return null
      }

      try {
        const prompt = await input.requestJson<PromptLibraryItem>('/api/prompts', {
          method: 'POST',
          body: JSON.stringify({
            title: trimmedTitle,
            content: trimmedContent,
            mode,
          }),
        })

        const nextPrompts = sortPrompts([
          prompt,
          ...input.promptLibrary.filter((item) => item.id !== prompt.id),
        ])
        input.setPromptLibrary(nextPrompts)
        return prompt
      } catch (error) {
        console.error('Failed to save prompt.', error)
        return null
      }
    },
    [input]
  )

  const deletePrompt = useCallback(
    async (promptId: string) => {
      try {
        await input.requestJson(`/api/prompts/${promptId}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Failed to delete prompt.', error)
      }

      const nextPrompts = input.promptLibrary.filter((prompt) => prompt.id !== promptId)
      input.setPromptLibrary(nextPrompts)
    },
    [input]
  )

  return { savePrompt, deletePrompt }
}
