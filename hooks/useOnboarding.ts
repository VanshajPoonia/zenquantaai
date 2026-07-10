'use client'

import { useCallback } from 'react'
import { normalizeAppSettingsState, sortProjects, sortPrompts } from '@/lib/utils/chat'
import {
  AIMode,
  AppSettings,
  OnboardingRequest,
  OnboardingResponse,
  Project,
  PromptLibraryItem,
} from '@/types'

export function useOnboarding(input: {
  requestJson: <T>(url: string, init?: RequestInit) => Promise<T>
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>
  setCurrentMode: (mode: AIMode) => void
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
  setSelectedProjectId: (projectId: string) => void
  setPromptLibrary: React.Dispatch<React.SetStateAction<PromptLibraryItem[]>>
  setIsOnboardingOpen: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const openOnboarding = useCallback(() => {
    input.setIsOnboardingOpen(true)
  }, [input])

  const skipOnboarding = useCallback(async () => {
    const result = await input.requestJson<OnboardingResponse>('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ action: 'skip' } satisfies OnboardingRequest),
    })
    const normalized = normalizeAppSettingsState(result.settings)

    input.setAppSettings(normalized)
    input.setIsOnboardingOpen(false)
  }, [input])

  const completeOnboarding = useCallback(
    async (
      onboardingInput: Omit<Extract<OnboardingRequest, { action: 'complete' }>, 'action'>
    ) => {
      const result = await input.requestJson<OnboardingResponse>('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete',
          ...onboardingInput,
        } satisfies OnboardingRequest),
      })
      const normalized = normalizeAppSettingsState(result.settings)

      input.setAppSettings(normalized)
      input.setCurrentMode(normalized.defaultMode)

      if (result.project) {
        input.setProjects((previous) =>
          sortProjects([
            result.project as Project,
            ...previous.filter((project) => project.id !== result.project?.id),
          ])
        )
        input.setSelectedProjectId(result.project.id)
      }

      const createdPrompts = result.prompts ?? []
      if (createdPrompts.length) {
        const promptIds = new Set(createdPrompts.map((prompt) => prompt.id))
        input.setPromptLibrary((previous) =>
          sortPrompts([
            ...createdPrompts,
            ...previous.filter((prompt) => !promptIds.has(prompt.id)),
          ])
        )
      }

      input.setIsOnboardingOpen(false)

      return {
        ...result,
        settings: normalized,
      }
    },
    [input]
  )

  return { openOnboarding, skipOnboarding, completeOnboarding }
}
