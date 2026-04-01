import { AIMode, AssistantRecommendationResult } from '@/types'
import { classifyPrompt } from './promptClassifier'

export const ASSISTANT_RECOMMENDATION_THRESHOLD = 0.68

export function getAssistantRecommendation(input: {
  prompt: string
  currentMode: AIMode
  kind?: 'chat' | 'image'
  attachments?: Array<{
    name: string
    kind: string
    previewUrl?: string
  }>
}): AssistantRecommendationResult {
  const result = classifyPrompt({
    prompt: input.prompt,
    currentMode: input.currentMode,
    kind: input.kind,
    attachments: input.attachments,
  })

  const shouldRecommendSwitch =
    !result.lockedToCurrentAssistant &&
    result.predictedAssistant !== result.currentAssistant &&
    result.confidence >= ASSISTANT_RECOMMENDATION_THRESHOLD

  return {
    ...result,
    shouldRecommendSwitch,
  }
}
