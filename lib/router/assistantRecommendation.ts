import {
  AIMode,
  AssistantRecommendationPersonalizationSummary,
  AssistantRecommendationResult,
} from '@/types'
import { classifyPrompt } from './promptClassifier'
import { personalizeAssistantRecommendation } from './personalization'

export const ASSISTANT_RECOMMENDATION_STRICT_THRESHOLD = 0.8

export function getAssistantRecommendation(input: {
  prompt: string
  currentMode: AIMode
  kind?: 'chat' | 'image'
  attachments?: Array<{
    name: string
    kind: string
    previewUrl?: string
  }>
  personalization?: {
    enabled: boolean
    summary?: AssistantRecommendationPersonalizationSummary | null
  }
}): AssistantRecommendationResult {
  const baseResult = classifyPrompt({
    prompt: input.prompt,
    currentMode: input.currentMode,
    kind: input.kind,
    attachments: input.attachments,
  })
  const result = personalizeAssistantRecommendation({
    result: baseResult,
    enabled: input.personalization?.enabled ?? false,
    summary: input.personalization?.summary ?? null,
  })

  const shouldRecommendSwitch =
    !result.lockedToCurrentAssistant &&
    result.predictedAssistant !== result.currentAssistant &&
    result.matchedSignals.length > 0 &&
    result.confidence >= ASSISTANT_RECOMMENDATION_STRICT_THRESHOLD

  return {
    ...result,
    shouldRecommendSwitch,
  }
}
