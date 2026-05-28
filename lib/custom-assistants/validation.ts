import {
  CustomAssistantDefaults,
  CustomAssistantInput,
  CustomAssistantMetadata,
  ModelOverrideOption,
  ResponseStyle,
  TextAIMode,
} from '@/types'
import { PROJECT_COLOR_OPTIONS } from '@/lib/config'

export const CUSTOM_ASSISTANT_TEXT_MODES: TextAIMode[] = [
  'general',
  'creative',
  'logic',
  'code',
  'live',
]

export const CUSTOM_ASSISTANT_MODEL_OVERRIDES: ModelOverrideOption[] = [
  'auto',
  'gemini',
  'claude',
  'gpt',
  'deepseek',
  'qwen',
]

export const CUSTOM_ASSISTANT_COLORS = PROJECT_COLOR_OPTIONS
const RESPONSE_STYLES: ResponseStyle[] = ['balanced', 'concise', 'detailed']

type ValidationResult =
  | { ok: true; input: CustomAssistantInput }
  | { ok: false; error: string }

function isTextMode(value: unknown): value is TextAIMode {
  return CUSTOM_ASSISTANT_TEXT_MODES.includes(value as TextAIMode)
}

function isModelOverride(value: unknown): value is ModelOverrideOption {
  return CUSTOM_ASSISTANT_MODEL_OVERRIDES.includes(value as ModelOverrideOption)
}

function isColor(value: unknown): value is (typeof PROJECT_COLOR_OPTIONS)[number] {
  return CUSTOM_ASSISTANT_COLORS.includes(
    value as (typeof PROJECT_COLOR_OPTIONS)[number]
  )
}

function isResponseStyle(value: unknown): value is ResponseStyle {
  return RESPONSE_STYLES.includes(value as ResponseStyle)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function boundedNumber(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(min, Math.min(max, value))
}

function normalizeStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number
): string[] | undefined {
  if (!Array.isArray(value)) return undefined

  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength))

  return items.length ? Array.from(new Set(items)) : []
}

function normalizeDefaults(value: unknown): CustomAssistantDefaults | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as CustomAssistantDefaults
  const tools = input.tools && typeof input.tools === 'object'
    ? {
        webSearch: optionalBoolean(input.tools.webSearch),
        memory: optionalBoolean(input.tools.memory),
        fileContext: optionalBoolean(input.tools.fileContext),
      }
    : undefined
  const normalized: CustomAssistantDefaults = {
    temperature: boundedNumber(input.temperature, 0, 2),
    maxTokens: boundedNumber(input.maxTokens, 256, 8_000),
    topP: boundedNumber(input.topP, 0.1, 1),
    modelOverride: isModelOverride(input.modelOverride)
      ? input.modelOverride
      : undefined,
    tools: tools
      ? Object.fromEntries(
          Object.entries(tools).filter(([, item]) => typeof item !== 'undefined')
        )
      : undefined,
  }

  return Object.fromEntries(
    Object.entries(normalized).filter(([, item]) => typeof item !== 'undefined')
  ) as CustomAssistantDefaults
}

export function normalizeCustomAssistantMetadata(
  value: unknown
): CustomAssistantMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { version: 2, isPinned: false, suggestedUseCases: [] }
  }

  const input = value as Record<string, unknown>
  const tone = stringValue(input.tone)
  const starterPromptIds = normalizeStringArray(input.starterPromptIds, 12, 120)
  const suggestedUseCases = normalizeStringArray(
    input.suggestedUseCases,
    8,
    120
  )
  const metadata: CustomAssistantMetadata = {
    version: 2,
    isPinned: optionalBoolean(input.isPinned) ?? false,
    suggestedUseCases: suggestedUseCases ?? [],
    ...(tone ? { tone: tone.slice(0, 80) } : {}),
    ...(isResponseStyle(input.responseStyle)
      ? { responseStyle: input.responseStyle }
      : {}),
    ...(starterPromptIds ? { starterPromptIds } : {}),
  }

  return metadata
}

export function buildCustomAssistantSnapshot(input: {
  id: string
  name: string
  description?: string | null
  iconEmoji: string
  color: string
  baseMode: TextAIMode
}) {
  return {
    id: input.id,
    name: input.name,
    description: input.description ?? undefined,
    iconEmoji: input.iconEmoji,
    color: input.color,
    baseMode: input.baseMode,
  }
}

export function normalizeCustomAssistantInput(
  payload: unknown,
  options: { partial?: boolean } = {}
): ValidationResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Invalid custom assistant payload.' }
  }

  const input = payload as Record<string, unknown>
  const name = stringValue(input.name)
  const description = stringValue(input.description)
  const iconEmoji = stringValue(input.iconEmoji)
  const color = stringValue(input.color)
  const systemInstructions = stringValue(input.systemInstructions)
  const baseMode = input.baseMode
  const defaultModelOverride = input.defaultModelOverride
  const defaultSettings = normalizeDefaults(input.defaultSettings)
  const metadata =
    typeof input.metadata !== 'undefined'
      ? normalizeCustomAssistantMetadata(input.metadata)
      : undefined
  const isEnabled = optionalBoolean(input.isEnabled)

  if (!options.partial || typeof input.name !== 'undefined') {
    if (!name) return { ok: false, error: 'Assistant name is required.' }
    if (name.length > 60) {
      return { ok: false, error: 'Assistant name must be 60 characters or less.' }
    }
  }

  if (description && description.length > 240) {
    return { ok: false, error: 'Description must be 240 characters or less.' }
  }

  if (iconEmoji && iconEmoji.length > 12) {
    return { ok: false, error: 'Icon must be a short emoji or symbol.' }
  }

  if (color && !isColor(color)) {
    return { ok: false, error: 'Unsupported assistant color.' }
  }

  if (typeof input.baseMode !== 'undefined' && !isTextMode(baseMode)) {
    return { ok: false, error: 'Custom assistants support text modes only.' }
  }

  if (!options.partial || typeof input.systemInstructions !== 'undefined') {
    if (!systemInstructions) {
      return { ok: false, error: 'System instructions are required.' }
    }
    if (systemInstructions.length > 6_000) {
      return {
        ok: false,
        error: 'System instructions must be 6000 characters or less.',
      }
    }
  }

  if (
    typeof input.defaultModelOverride !== 'undefined' &&
    !isModelOverride(defaultModelOverride)
  ) {
    return { ok: false, error: 'Unsupported default response profile.' }
  }

  return {
    ok: true,
    input: {
      ...(name ? { name } : {}),
      ...(typeof input.description !== 'undefined'
        ? { description: description ?? '' }
        : {}),
      ...(iconEmoji ? { iconEmoji } : {}),
      ...(color ? { color } : {}),
      ...(isTextMode(baseMode) ? { baseMode } : {}),
      ...(systemInstructions ? { systemInstructions } : {}),
      ...(isModelOverride(defaultModelOverride) ? { defaultModelOverride } : {}),
      ...(defaultSettings ? { defaultSettings } : {}),
      ...(metadata ? { metadata } : {}),
      ...(typeof isEnabled !== 'undefined' ? { isEnabled } : {}),
    } as CustomAssistantInput,
  }
}
