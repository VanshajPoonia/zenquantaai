import { AssistantFamily, AssistantRecommendationResult, AIMode } from '@/types'
import { FAMILY_TO_MODE, MODE_TO_FAMILY } from '@/lib/config/assistants'
import {
  collectAssistantSignals,
  getExplicitAssistantPreference,
} from './assistantRules'

const BASE_SCORES: Record<AssistantFamily, number> = {
  nova: 1,
  velora: 0,
  axiom: 0,
  forge: 0,
  pulse: 0,
  prism: 0,
}

const SPECIALIST_ASSISTANTS = new Set<AssistantFamily>([
  'velora',
  'axiom',
  'forge',
  'pulse',
  'prism',
])

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
  const [rawTopAssistant, rawTopScore] = ranked[0]
  const secondScore = ranked[1]?.[1] ?? 0
  const topSignals = signals
    .filter((signal) => signal.assistant === rawTopAssistant)
    .sort((a, b) => b.weight - a.weight)
  const strongSignal = topSignals.find((signal) => signal.strong)
  const scoreGap = rawTopScore - secondScore
  const hasMeaningfulSignals = signals.length > 0
  const specialistLeadIsClear =
    SPECIALIST_ASSISTANTS.has(rawTopAssistant) &&
    ((Boolean(strongSignal) && rawTopScore >= 8) || (rawTopScore >= 7 && scoreGap >= 3))

  const topAssistant =
    !hasMeaningfulSignals
      ? 'nova'
      : specialistLeadIsClear || rawTopAssistant === 'nova'
        ? rawTopAssistant
        : 'nova'

  const predictedSignals =
    topAssistant === rawTopAssistant
      ? topSignals
      : []

  const fallbackSignals =
    topAssistant === 'nova' && rawTopAssistant !== 'nova'
      ? signals.sort((a, b) => b.weight - a.weight)
      : []

  let confidence = 0.52

  if (topAssistant === 'nova' && !hasMeaningfulSignals) {
    confidence = 0.54
  } else if (topAssistant === 'nova' && rawTopAssistant !== 'nova') {
    confidence = clamp(0.55 + scoreGap * 0.03, 0.55, 0.66)
  } else if (strongSignal) {
    confidence = clamp(0.9 + Math.min(scoreGap, 4) * 0.015, 0.9, 0.97)
  } else {
    confidence = clamp(
      0.7 + scoreGap * 0.05 + Math.min(predictedSignals.length, 2) * 0.025,
      0.7,
      0.88
    )
  }

  const lockedToCurrentAssistant =
    explicitAssistantPreference === 'current' ||
    explicitAssistantPreference === currentAssistant

  const matchedSignals =
    topAssistant === 'nova'
      ? fallbackSignals.slice(0, 2).map((signal) => signal.label)
      : predictedSignals.map((signal) => signal.label)

  const reason =
    topAssistant === 'nova' && rawTopAssistant !== 'nova'
      ? 'the prompt blends multiple intents, so it is safer to keep it in general assistance'
      : predictedSignals[0]?.reason ??
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
