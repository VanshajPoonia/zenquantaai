import {
  AIMode,
  AppSettings,
  ModelOverrideConfig,
  ModelOverrideOption,
  ModelRouteConfig,
  SessionSettings,
  SubscriptionTier,
} from '@/types'
import {
  getAssistantFamilyFromMode,
  getTierAssistantModelConfig,
} from './assistants'
import { PLAN_CONFIGS } from './pricing'

export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_PROJECT_ID = 'project-inbox'
export const DEFAULT_PROJECT_NAME = 'Inbox'
export const PROJECT_COLOR_OPTIONS = [
  'general',
  'creative',
  'logic',
  'code',
  'live',
  'image',
  'slate',
  'amber',
] as const

export const IMAGE_GENERATION_CONFIG = {
  model: getTierAssistantModelConfig('image', 'free').model,
  label: 'Prism',
  description:
    'Premium visual generation with polished composition, stronger prompt following, and separate image-credit accounting.',
  modalities: ['image', 'text'] as const,
} as const

export const RESPONSE_PROFILE_LABELS: Record<ModelOverrideOption, string> = {
  auto: 'Smart Match',
  gemini: 'Swift',
  claude: 'Polished',
  gpt: 'Clear',
  deepseek: 'Analyst',
  qwen: 'Builder',
}

export const RESPONSE_PROFILE_DESCRIPTIONS: Record<ModelOverrideOption, string> = {
  auto: 'Matches the response profile to the selected assistant automatically.',
  gemini: 'Fast and balanced for drafts, broad prompts, and fast follow-up.',
  claude: 'Smooth, polished output for nuanced responses and premium tone.',
  gpt: 'Clear and structured output for direct explanations and practical guidance.',
  deepseek: 'Analytical output for breakdowns, frameworks, and stepwise reasoning.',
  qwen: 'Builder-focused output for implementation work and technical execution.',
}

export const MODEL_OVERRIDE_CONFIGS: Record<
  Exclude<ModelOverrideOption, 'auto'>,
  ModelOverrideConfig
> = {
  gemini: {
    id: 'gemini',
    label: 'Swift',
    description: 'Fast balanced routing profile',
    model: 'google/gemini-2.5-flash',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
  },
  claude: {
    id: 'claude',
    label: 'Polished',
    description: 'Premium polished long-form routing profile',
    model: 'anthropic/claude-sonnet-4.6',
    inputCostPerMillion: 3,
    outputCostPerMillion: 15,
  },
  gpt: {
    id: 'gpt',
    label: 'Clear',
    description: 'Structured flagship routing profile',
    model: 'openai/gpt-5',
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 10,
  },
  deepseek: {
    id: 'deepseek',
    label: 'Analyst',
    description: 'Analytical reasoning routing profile',
    model: 'deepseek/deepseek-chat-v3.1',
    inputCostPerMillion: 0.3,
    outputCostPerMillion: 0.9,
  },
  qwen: {
    id: 'qwen',
    label: 'Builder',
    description: 'Implementation-oriented routing profile',
    model: 'qwen/qwen3-coder',
    inputCostPerMillion: 0.45,
    outputCostPerMillion: 1.2,
  },
}

export const MODEL_ROUTE_CONFIGS: Record<AIMode, ModelRouteConfig> = {
  general: {
    ...getTierAssistantModelConfig('general', 'free'),
    gateway: 'openrouter',
    gatewayName: 'OpenRouter',
    label: 'Nova',
    planName: PLAN_CONFIGS.free.assistantNames.nova,
    systemPromptKey: 'general',
  },
  creative: {
    ...getTierAssistantModelConfig('creative', 'free'),
    gateway: 'openrouter',
    gatewayName: 'OpenRouter',
    label: 'Velora',
    planName: PLAN_CONFIGS.free.assistantNames.velora,
    systemPromptKey: 'creative',
  },
  logic: {
    ...getTierAssistantModelConfig('logic', 'free'),
    gateway: 'openrouter',
    gatewayName: 'OpenRouter',
    label: 'Axiom',
    planName: PLAN_CONFIGS.free.assistantNames.axiom,
    systemPromptKey: 'logic',
  },
  code: {
    ...getTierAssistantModelConfig('code', 'free'),
    gateway: 'openrouter',
    gatewayName: 'OpenRouter',
    label: 'Forge',
    planName: PLAN_CONFIGS.free.assistantNames.forge,
    systemPromptKey: 'code',
  },
  live: {
    ...getTierAssistantModelConfig('live', 'free'),
    gateway: 'openrouter',
    gatewayName: 'OpenRouter',
    label: 'Pulse',
    planName: PLAN_CONFIGS.free.assistantNames.pulse,
    systemPromptKey: 'live',
  },
  image: {
    ...getTierAssistantModelConfig('image', 'free'),
    gateway: 'openrouter',
    gatewayName: 'OpenRouter',
    label: 'Prism',
    planName: PLAN_CONFIGS.free.assistantNames.prism,
    systemPromptKey: 'image',
  },
}

export const DEFAULT_FEATURE_FLAGS = {
  modelOverride: 'auto',
  systemPreset: 'default',
  webSearch: false,
  memory: true,
  fileContext: false,
} satisfies Pick<
  SessionSettings,
  'modelOverride' | 'systemPreset' | 'webSearch' | 'memory' | 'fileContext'
>

function applyModelOverride(
  config: ModelRouteConfig,
  modelOverride: ModelOverrideOption
): ModelRouteConfig {
  if (modelOverride === 'auto') {
    return config
  }

  const override = MODEL_OVERRIDE_CONFIGS[modelOverride]

  return {
    ...config,
    model: override.model,
    label: override.label,
    description: override.description,
    inputCostPerMillion: override.inputCostPerMillion,
    outputCostPerMillion: override.outputCostPerMillion,
    walletType: config.tier === 'free' || config.tier === 'basic' ? 'core_tokens' : 'tier_tokens',
  }
}

export function resolveModelConfig(
  mode: AIMode,
  modelOverride: ModelOverrideOption = 'auto',
  tier: SubscriptionTier = 'free'
): ModelRouteConfig {
  const config = getTierAssistantModelConfig(mode, tier)

  return applyModelOverride(
    {
      ...config,
      gateway: 'openrouter',
      gatewayName: 'OpenRouter',
      label: config.displayName,
      planName: PLAN_CONFIGS[tier].assistantNames[getAssistantFamilyFromMode(mode)],
      systemPromptKey: mode,
    },
    modelOverride
  )
}

export function createSessionSettings(
  mode: AIMode,
  overrides: Partial<SessionSettings> = {}
): SessionSettings {
  const config = MODEL_ROUTE_CONFIGS[mode]

  return {
    temperature: overrides.temperature ?? config.temperature,
    maxTokens: overrides.maxTokens ?? config.maxTokens,
    topP: overrides.topP ?? config.topP,
    modelOverride: overrides.modelOverride ?? DEFAULT_FEATURE_FLAGS.modelOverride,
    systemPreset: overrides.systemPreset ?? DEFAULT_FEATURE_FLAGS.systemPreset,
    webSearch: overrides.webSearch ?? DEFAULT_FEATURE_FLAGS.webSearch,
    memory: overrides.memory ?? DEFAULT_FEATURE_FLAGS.memory,
    fileContext: overrides.fileContext ?? DEFAULT_FEATURE_FLAGS.fileContext,
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  accentStyle: 'mode',
  defaultMode: 'general',
  responseStyle: 'balanced',
  assistantRecommendations: {
    enabled: true,
    autoSwitchOnHighConfidence: false,
  },
  sessionDefaults: createSessionSettings('general'),
  gatewayDrafts: {
    openRouterApiKey: '',
    openRouterBaseUrl: OPENROUTER_DEFAULT_BASE_URL,
  },
}
