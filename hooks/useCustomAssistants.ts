'use client'

import { useCallback } from 'react'
import { sortCustomAssistants } from '@/lib/utils/chat'
import {
  CustomAssistant,
  CustomAssistantInput,
  CustomAssistantTestRequest,
  CustomAssistantTestResponse,
} from '@/types'

export function useCustomAssistants(input: {
  requestJson: <T>(url: string, init?: RequestInit) => Promise<T>
  setCustomAssistants: React.Dispatch<React.SetStateAction<CustomAssistant[]>>
  currentCustomAssistantId: string | null
  setCurrentCustomAssistantId: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const saveCustomAssistant = useCallback(
    async (assistantInput: CustomAssistantInput & { id?: string }) => {
      try {
        const assistant = await input.requestJson<CustomAssistant>(
          assistantInput.id
            ? `/api/custom-assistants/${assistantInput.id}`
            : '/api/custom-assistants',
          {
            method: assistantInput.id ? 'PATCH' : 'POST',
            body: JSON.stringify(assistantInput),
          }
        )

        input.setCustomAssistants((previous) =>
          sortCustomAssistants([
            assistant,
            ...previous.filter((item) => item.id !== assistant.id),
          ])
        )
        return assistant
      } catch (error) {
        console.error('Failed to save custom assistant.', error)
        return null
      }
    },
    [input]
  )

  const deleteCustomAssistant = useCallback(
    async (assistantId: string) => {
      try {
        await input.requestJson(`/api/custom-assistants/${assistantId}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Failed to delete custom assistant.', error)
      }

      input.setCustomAssistants((previous) =>
        previous.filter((assistant) => assistant.id !== assistantId)
      )
      if (input.currentCustomAssistantId === assistantId) {
        input.setCurrentCustomAssistantId(null)
      }
    },
    [input]
  )

  const testCustomAssistant = useCallback(
    async (testInput: CustomAssistantTestRequest) => {
      return await input.requestJson<CustomAssistantTestResponse>(
        '/api/custom-assistants/test',
        {
          method: 'POST',
          body: JSON.stringify(testInput),
        }
      )
    },
    [input]
  )

  return { saveCustomAssistant, deleteCustomAssistant, testCustomAssistant }
}
