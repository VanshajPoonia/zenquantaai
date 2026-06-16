import {
  AIMode,
  AssistantFamily,
  AssistantRecommendationPersonalizationSignal,
  AssistantRecommendationPersonalizationSummary,
  AssistantRecommendationPersonalizationTask,
  AssistantRecommendationResult,
  FeedbackEvent,
  RecommendationOutcome,
  UsageEvent,
} from '@/types'
import { FAMILY_TO_MODE } from '@/lib/config/assistants'

interface RecommendationHistoryInput {
  recommendedAssistant: AssistantFamily
  matchedSignals: string[]
  outcome: RecommendationOutcome
}

interface FeedbackHistoryInput {
  entityType: FeedbackEvent['entityType']
  rating: FeedbackEvent['rating']
  metadata: Record<string, unknown>
}

interface ModelDuelWinnerInput {
  assistantFamily: AssistantFamily
  mode: AIMode
}

interface BuildPersonalizationSummaryInput {
  generatedAt?: string
  windowDays?: number
  recommendationEvents?: RecommendationHistoryInput[]
  feedbackEvents?: FeedbackHistoryInput[]
  modelDuelWinners?: ModelDuelWinnerInput[]
  usageEvents?: Array<Pick<UsageEvent, 'assistantFamily' | 'mode'>>
}

interface PersonalizationApplicationInput {
  result: AssistantRecommendationResult
  enabled: boolean
  summary?: AssistantRecommendationPersonalizationSummary | null
}

const TASK_BY_SIGNAL: Record<string, AssistantRecommendationPersonalizationTask> = {
  'image-mode': 'image',
  'image-request': 'image',
  'code-fence': 'code',
  'stack-trace': 'code',
  'file-extension': 'code',
  'code-intent': 'code',
  'current-info': 'current',
  'creative-writing': 'creative',
  'creative-strong': 'creative',
  analysis: 'analysis',
  'analysis-strong': 'analysis',
  'general-help': 'general',
  'explicit-assistant': 'general',
}

const DEFAULT_TASK_BY_ASSISTANT: Record<
  AssistantFamily,
  AssistantRecommendationPersonalizationTask
> = {
  nova: 'general',
  velora: 'creative',
  axiom: 'analysis',
  forge: 'code',
  pulse: 'current',
  prism: 'image',
}

const TASK_LABELS: Record<AssistantRecommendationPersonalizationTask, string> = {
  general: 'general help',
  creative: 'copy and creative work',
  analysis: 'analysis and decisions',
  code: 'coding tasks',
  current: 'current research',
  image: 'image generation',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100
}

function taskFromMode(mode: AIMode): AssistantRecommendationPersonalizationTask {
  if (mode === 'creative') return 'creative'
  if (mode === 'logic') return 'analysis'
  if (mode === 'code') return 'code'
  if (mode === 'live') return 'current'
  if (mode === 'image') return 'image'
  return 'general'
}

export function getPersonalizationTaskForSignal(
  signal: string
): AssistantRecommendationPersonalizationTask | null {
  return TASK_BY_SIGNAL[signal] ?? null
}

function addSignal(
  buckets: Map<string, AssistantRecommendationPersonalizationSignal>,
  input: {
    assistant: AssistantFamily
    task: AssistantRecommendationPersonalizationTask
    delta: number
  }
) {
  const key = `${input.assistant}:${input.task}`
  const current = buckets.get(key) ?? {
    assistant: input.assistant,
    task: input.task,
    score: 0,
    positiveCount: 0,
    negativeCount: 0,
    reason: '',
  }

  current.score += input.delta
  if (input.delta > 0) {
    current.positiveCount += 1
  } else if (input.delta < 0) {
    current.negativeCount += 1
  }
  current.reason = buildPersonalizedReason(current)
  buckets.set(key, current)
}

function buildPersonalizedReason(
  signal: Pick<
    AssistantRecommendationPersonalizationSignal,
    'assistant' | 'task' | 'score' | 'positiveCount' | 'negativeCount'
  >
): string {
  const taskLabel = TASK_LABELS[signal.task]
  if (signal.score < 0) {
    return `You usually skip ${signal.assistant} for ${taskLabel}.`
  }
  return `You usually choose ${signal.assistant} for ${taskLabel}.`
}

function signalFromMetadata(
  metadata: Record<string, unknown>
): { assistant: AssistantFamily; task: AssistantRecommendationPersonalizationTask } | null {
  const assistant =
    typeof metadata.assistantFamily === 'string'
      ? (metadata.assistantFamily as AssistantFamily)
      : null
  if (!assistant || !(assistant in DEFAULT_TASK_BY_ASSISTANT)) return null

  const mode = typeof metadata.mode === 'string' ? (metadata.mode as AIMode) : null
  return {
    assistant,
    task: mode ? taskFromMode(mode) : DEFAULT_TASK_BY_ASSISTANT[assistant],
  }
}

export function buildAssistantRecommendationPersonalizationSummary(
  input: BuildPersonalizationSummaryInput
): AssistantRecommendationPersonalizationSummary {
  const buckets = new Map<string, AssistantRecommendationPersonalizationSignal>()
  const affinityBuckets = new Map<string, AssistantRecommendationPersonalizationSignal>()

  for (const event of input.recommendationEvents ?? []) {
    const delta =
      event.outcome === 'accepted' || event.outcome === 'autoswitched'
        ? 2
        : event.outcome === 'continued' || event.outcome === 'cancelled'
          ? -2
          : 0

    if (delta === 0) continue

    const tasks = new Set(
      event.matchedSignals
        .map(getPersonalizationTaskForSignal)
        .filter((task): task is AssistantRecommendationPersonalizationTask =>
          Boolean(task)
        )
    )
    if (tasks.size === 0) {
      tasks.add(DEFAULT_TASK_BY_ASSISTANT[event.recommendedAssistant])
    }

    for (const task of tasks) {
      addSignal(buckets, {
        assistant: event.recommendedAssistant,
        task,
        delta,
      })
    }
  }

  for (const event of input.feedbackEvents ?? []) {
    const signal = signalFromMetadata(event.metadata)
    if (!signal) continue

    const delta = event.rating === 'up' ? 2 : event.rating === 'down' ? -2 : 0
    if (delta === 0) continue

    addSignal(buckets, { ...signal, delta })
    addSignal(affinityBuckets, { ...signal, delta })
  }

  for (const winner of input.modelDuelWinners ?? []) {
    const signal = {
      assistant: winner.assistantFamily,
      task: taskFromMode(winner.mode),
    }
    addSignal(buckets, { ...signal, delta: 2 })
    addSignal(affinityBuckets, { ...signal, delta: 2 })
  }

  for (const event of input.usageEvents ?? []) {
    const signal = {
      assistant: event.assistantFamily,
      task: taskFromMode(event.mode),
    }
    addSignal(affinityBuckets, { ...signal, delta: 0.5 })
  }

  const signals = [...buckets.values()]
    .filter((signal) => signal.score !== 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 24)

  const assistantAffinities = [...affinityBuckets.values()]
    .filter((signal) => signal.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    windowDays: input.windowDays ?? 90,
    recommendationEventCount: input.recommendationEvents?.length ?? 0,
    feedbackEventCount: input.feedbackEvents?.length ?? 0,
    modelDuelSelectionCount: input.modelDuelWinners?.length ?? 0,
    usageEventCount: input.usageEvents?.length ?? 0,
    signals,
    assistantAffinities,
  }
}

function getMatchedTasks(
  result: AssistantRecommendationResult
): AssistantRecommendationPersonalizationTask[] {
  const tasks = result.matchedSignals
    .map(getPersonalizationTaskForSignal)
    .filter((task): task is AssistantRecommendationPersonalizationTask =>
      Boolean(task)
    )

  if (tasks.length > 0) return [...new Set(tasks)]
  return [DEFAULT_TASK_BY_ASSISTANT[result.predictedAssistant]]
}

export function personalizeAssistantRecommendation({
  result,
  enabled,
  summary,
}: PersonalizationApplicationInput): AssistantRecommendationResult {
  if (!enabled || !summary) return result

  const matchedTasks = getMatchedTasks(result)
  const candidateSignals = summary.signals.filter(
    (signal) =>
      signal.assistant === result.predictedAssistant &&
      matchedTasks.includes(signal.task)
  )
  const affinitySignals = summary.assistantAffinities.filter(
    (signal) =>
      signal.assistant === result.predictedAssistant &&
      matchedTasks.includes(signal.task)
  )
  const strongestSignal =
    [...candidateSignals, ...affinitySignals].sort(
      (a, b) => Math.abs(b.score) - Math.abs(a.score)
    )[0] ?? null

  if (!strongestSignal || result.lockedToCurrentAssistant) {
    return {
      ...result,
      baseReason: result.reason,
      personalized: false,
      matchedPersonalizationSignals: [],
    }
  }

  const positiveScore = Math.max(0, strongestSignal.score)
  const negativeScore = Math.min(0, strongestSignal.score)
  const delta =
    positiveScore > 0
      ? Math.min(0.07, positiveScore * 0.015)
      : Math.max(-0.08, negativeScore * 0.02)
  const confidence = roundConfidence(clamp(result.confidence + delta, 0.45, 0.98))

  return {
    ...result,
    confidence,
    baseReason: result.reason,
    personalized: positiveScore > 0 || negativeScore < 0,
    personalizedReason: strongestSignal.reason,
    matchedPersonalizationSignals: [
      `${strongestSignal.assistant}:${strongestSignal.task}`,
    ],
    recommendedMode: FAMILY_TO_MODE[result.predictedAssistant],
  }
}
