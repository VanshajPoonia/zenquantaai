import { AssistantFamily, AssistantRecommendationResult, AIMode } from '@/types'
import { FAMILY_TO_MODE, MODE_TO_FAMILY } from '@/lib/config/assistants'
import {
  collectAssistantSignals,
  getExplicitAssistantPreference,
} from './assistantRules'

const BASE_SCORES: Record<AssistantFamily, number> = {
  nova: 1.2,
  velora: 0,
  axiom: 0,
  forge: 0,
  pulse: 0,
  prism: 0,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100
}

export function classifyPrompt(input: {
  prompt: string
  currentMode: AIMode
  kind?: 'chat' | 'image'
  attachments?: Array<{ name: string; kind: string }>
}): AssistantRecommendationResult {
  const prompt = input.prompt.trim()
  const currentAssistant = MODE_TO_FAMILY[input.currentMode]
  const attachmentNames = (input.attachments ?? []).map((attachment) => attachment.name)
  const signals = collectAssistantSignals({
    prompt,
    normalizedPrompt: prompt.toLowerCase(),
    attachmentNames,
    normalizedAttachmentNames: attachmentNames.join(' ').toLowerCase(),
    kind: input.kind ?? 'chat',
  })
  const explicitAssistantPreference = getExplicitAssistantPreference(prompt)

  const scores = new Map<AssistantFamily, number>(
    Object.entries(BASE_SCORES) as Array<[AssistantFamily, number]>
  )

  if (
    explicitAssistantPreference &&
    explicitAssistantPreference !== 'current'
  ) {
    signals.push({
      assistant: explicitAssistantPreference,
      label: 'explicit-assistant',
      weight: 9,
      reason: `it explicitly asks to use ${explicitAssistantPreference}`,
      strong: true,
    })
  }

  for (const signal of signals) {
    scores.set(signal.assistant, (scores.get(signal.assistant) ?? 0) + signal.weight)
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const [topAssistant, topScore] = ranked[0]
  const secondScore = ranked[1]?.[1] ?? 0
  const strongSignal = signals.find(
    (signal) => signal.assistant === topAssistant && signal.strong
  )
  const topSignals = signals
    .filter((signal) => signal.assistant === topAssistant)
    .sort((a, b) => b.weight - a.weight)

  let confidence = 0.42

  if (strongSignal) {
    confidence = 0.93
  } else if (topSignals.length > 0) {
    confidence = clamp(
      0.48 + (topScore - secondScore) * 0.08 + topSignals.length * 0.04,
      0.45,
      0.88
    )
  } else {
    confidence = 0.5
  }

  const lockedToCurrentAssistant =
    explicitAssistantPreference === 'current' ||
    explicitAssistantPreference === currentAssistant
  const matchedSignals = topSignals.map((signal) => signal.label)
  const reason =
    topSignals[0]?.reason ??
    'it reads like a broad, non-specialized request that fits general assistance'

  return {
    currentAssistant,
    predictedAssistant: topAssistant,
    recommendedMode: FAMILY_TO_MODE[topAssistant],
    confidence: roundConfidence(confidence),
    reason,
    matchedSignals,
    shouldRecommendSwitch: false,
    lockedToCurrentAssistant,
  }
}
