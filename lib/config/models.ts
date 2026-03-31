import { AIMode, AppSettings, ModelRouteConfig, SessionSettings } from '@/types'

export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'

export const MODEL_ROUTE_CONFIGS: Record<AIMode, ModelRouteConfig> = {
  creative: {
    mode: 'creative',
    gateway: 'openrouter',
    gatewayName: 'OpenRouter',
    model: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'imaginative, expressive, elegant, tone-aware writing assistant',
    temperature: 0.9,
    maxTokens: 1200,
    topP: 0.95,
    systemPromptKey: 'creative',
  },
  logic: {
    mode: 'logic',
    gateway: 'openrouter',
    gatewayName: 'OpenRouter',
    model: 'deepseek/deepseek-chat-v3.1',
    label: 'DeepSeek V3.1',
    description: 'precise, structured reasoning assistant',
    temperature: 0.2,
    maxTokens: 1400,
    topP: 0.9,
    systemPromptKey: 'logic',
  },
  code: {
    mode: 'code',
    gateway: 'openrouter',
    gatewayName: 'OpenRouter',
    model: 'qwen/qwen3-coder',
    label: 'Qwen3 Coder',
    description: 'technical coding assistant for debugging and implementation',
    temperature: 0.15,
    maxTokens: 1600,
    topP: 0.9,
    systemPromptKey: 'code',
  },
}

export const DEFAULT_FEATURE_FLAGS = {
  webSearch: false,
  memory: true,
  fileContext: false,
} satisfies Pick<SessionSettings, 'webSearch' | 'memory' | 'fileContext'>

export function createSessionSettings(
  mode: AIMode,
  overrides: Partial<SessionSettings> = {}
): SessionSettings {
  const config = MODEL_ROUTE_CONFIGS[mode]

  return {
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    webSearch: overrides.webSearch ?? DEFAULT_FEATURE_FLAGS.webSearch,
    memory: overrides.memory ?? DEFAULT_FEATURE_FLAGS.memory,
    fileContext: overrides.fileContext ?? DEFAULT_FEATURE_FLAGS.fileContext,
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  accentStyle: 'mode',
  defaultMode: 'creative',
  responseStyle: 'balanced',
  sessionDefaults: createSessionSettings('creative'),
  gatewayDrafts: {
    openRouterApiKey: '',
    openRouterBaseUrl: OPENROUTER_DEFAULT_BASE_URL,
  },
}
