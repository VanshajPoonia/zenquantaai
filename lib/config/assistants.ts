import { AssistantFamily, AssistantModelConfig, AIMode, SubscriptionTier } from '@/types'
import { MODEL_PRICING_CONFIG, TIER_ASSISTANT_NAMES } from './pricing'

export const MODE_TO_FAMILY: Record<AIMode, AssistantFamily> = {
  general: 'nova',
  creative: 'velora',
  logic: 'axiom',
  code: 'forge',
  live: 'pulse',
  image: 'prism',
}

export const FAMILY_TO_MODE: Record<AssistantFamily, AIMode> = {
  nova: 'general',
  velora: 'creative',
  axiom: 'logic',
  forge: 'code',
  pulse: 'live',
  prism: 'image',
}

export const ASSISTANT_FAMILY_COPY: Record<
  AssistantFamily,
  {
    shortName: string
    helperText: string
    emptyStateTitle: string
    emptyStateDescription: string
    placeholder: string
    suggestedPrompts: string[]
    description: string
    accentColor: AIMode
    icon: 'sparkles' | 'brain' | 'code' | 'pulse' | 'image'
    kind: 'text' | 'image'
  }
> = {
  nova: {
    shortName: 'Nova',
    helperText:
      'Balanced everyday assistance for open-ended questions, planning, summaries, and practical work.',
    emptyStateTitle: 'Start Broad, Then Get Precise',
    emptyStateDescription:
      'Nova handles general work, planning, summarizing, recommendations, and flexible day-to-day requests.',
    placeholder:
      'Ask anything: planning, summaries, recommendations, research notes, or practical help...',
    suggestedPrompts: [
      'Plan a 3-day Kyoto itinerary with food, temples, and a relaxed pace',
      'Help me turn a messy notes dump into a structured action plan',
      'Summarize the tradeoffs of freelancing vs joining a small agency',
      'Draft a concise weekly operating review from these notes',
    ],
    description: 'General assistant tuned for broad practical work and organized thinking.',
    accentColor: 'general',
    icon: 'sparkles',
    kind: 'text',
  },
  velora: {
    shortName: 'Velora',
    helperText:
      'Creative ideation, voice work, storytelling, brand language, and polished writing.',
    emptyStateTitle: 'Create With A Branded Creative Engine',
    emptyStateDescription:
      'Velora is built for copy, story structure, naming, art direction, and tone-sensitive writing.',
    placeholder: 'Draft a story, campaign, script, concept, or elevated creative direction...',
    suggestedPrompts: [
      'Write launch copy for a premium productivity app aimed at solo founders',
      'Turn this product blurb into sharper luxury landing-page copy',
      'Brainstorm distinctive names for an AI studio focused on creative strategy',
      'Outline a short film about memory, ambition, and second chances',
    ],
    description: 'Creative assistant for voice, storytelling, ideation, and expressive copy.',
    accentColor: 'creative',
    icon: 'sparkles',
    kind: 'text',
  },
  axiom: {
    shortName: 'Axiom',
    helperText:
      'Structured reasoning, comparisons, decision support, and stepwise analysis.',
    emptyStateTitle: 'Reason Through The Hard Parts',
    emptyStateDescription:
      'Axiom is tuned for correctness, tradeoffs, analytical breakdowns, and decision frameworks.',
    placeholder: 'Ask for reasoning, comparisons, analysis, decision support, or a rigorous breakdown...',
    suggestedPrompts: [
      'Compare usage-based pricing vs seat-based pricing for a B2B SaaS product',
      'Create a decision framework for choosing between three go-to-market channels',
      'Explain event sourcing in plain English with pros, cons, and tradeoffs',
      'Break down whether we should hire engineering first or sales first',
    ],
    description: 'Logic assistant for precise analysis, frameworks, and structured recommendations.',
    accentColor: 'logic',
    icon: 'brain',
    kind: 'text',
  },
  forge: {
    shortName: 'Forge',
    helperText:
      'Implementation-heavy coding, debugging, architecture, refactors, and technical delivery.',
    emptyStateTitle: 'Ship With A Technical Co-Pilot',
    emptyStateDescription:
      'Forge is focused on production code, debugging, backend logic, and implementation detail.',
    placeholder: 'Describe the bug, feature, system, API, or code change you need...',
    suggestedPrompts: [
      'Build a reusable settings drawer component in Next.js and Tailwind',
      'Debug why this React effect causes duplicate requests',
      'Write a typed route handler with Zod validation and good errors',
      'Explain the architecture of a streaming chat API in practical terms',
    ],
    description: 'Code assistant for debugging, implementation, and architecture work.',
    accentColor: 'code',
    icon: 'code',
    kind: 'text',
  },
  pulse: {
    shortName: 'Pulse',
    helperText:
      'Fast current-information and live-research style assistance routed through a live-oriented model.',
    emptyStateTitle: 'Work With Fast Current Context',
    emptyStateDescription:
      'Pulse is for current information, rapid synthesis, and research-style follow-up with a faster live model route.',
    placeholder: 'Ask for current context, research synthesis, updates, comparisons, or live-style analysis...',
    suggestedPrompts: [
      'Give me a concise market scan of AI note-taking products and positioning gaps',
      'Compare three recent GTM patterns for early-stage AI productivity startups',
      'Summarize the latest direction in multimodal foundation model launches',
      'Outline the open questions I should investigate before picking a vector database',
    ],
    description: 'Live/research assistant for current-context synthesis and fast information work.',
    accentColor: 'live',
    icon: 'pulse',
    kind: 'text',
  },
  prism: {
    shortName: 'Prism',
    helperText:
      'Image generation for styled concepts, product visuals, branded art direction, and visual ideation.',
    emptyStateTitle: 'Generate Images With A Premium Visual Engine',
    emptyStateDescription:
      'Prism is optimized for direct image generation, visual ideation, product renders, and art direction.',
    placeholder: 'Describe the image you want to create...',
    suggestedPrompts: [
      'Create a cinematic portrait of a founder in a rain-lit Tokyo alley',
      'Generate a clean app-landing hero visual for an AI research product',
      'Create a luxury skincare campaign image with soft diffused light',
      'Make an editorial-style product render of wireless earbuds on stone',
    ],
    description: 'Image assistant for polished visuals, art direction, and image generation.',
    accentColor: 'image',
    icon: 'image',
    kind: 'image',
  },
}

type TierModelMap = Record<SubscriptionTier, Record<AssistantFamily, string>>

const MODELS_BY_TIER: TierModelMap = {
  free: {
    nova: 'openai/gpt-4.1-mini',
    velora: 'google/gemini-2.5-flash',
    axiom: 'deepseek/deepseek-chat-v3.1',
    forge: 'qwen/qwen3-coder',
    pulse: 'x-ai/grok-4.1-fast',
    prism: 'google/gemini-2.5-flash-image',
  },
  basic: {
    nova: 'openai/gpt-4.1-mini',
    velora: 'google/gemini-2.5-flash',
    axiom: 'deepseek/deepseek-chat-v3.1',
    forge: 'qwen/qwen3-coder',
    pulse: 'x-ai/grok-4.1-fast',
    prism: 'google/gemini-2.5-flash-image',
  },
  pro: {
    nova: 'openai/gpt-5',
    velora: 'google/gemini-2.5-pro',
    axiom: 'google/gemini-2.5-pro',
    forge: 'openai/gpt-5.3-codex',
    pulse: 'x-ai/grok-4.20',
    prism: 'google/gemini-2.5-flash-image',
  },
  ultra: {
    nova: 'openai/gpt-5.4',
    velora: 'anthropic/claude-sonnet-4.6',
    axiom: 'google/gemini-3.1-pro-preview',
    forge: 'anthropic/claude-sonnet-4.6',
    pulse: 'x-ai/grok-4.20',
    prism: 'openai/gpt-5-image',
  },
  prime: {
    nova: 'openai/gpt-5.4',
    velora: 'anthropic/claude-opus-4.6',
    axiom: 'google/gemini-3.1-pro-preview',
    forge: 'anthropic/claude-opus-4.6',
    pulse: 'x-ai/grok-4.20',
    prism: 'openai/gpt-5-image',
  },
}

const DEFAULT_TEMPERATURE: Record<AssistantFamily, number> = {
  nova: 0.45,
  velora: 0.9,
  axiom: 0.2,
  forge: 0.15,
  pulse: 0.3,
  prism: 0.85,
}

const DEFAULT_MAX_TOKENS: Record<AssistantFamily, number> = {
  nova: 1400,
  velora: 1200,
  axiom: 1400,
  forge: 1600,
  pulse: 1800,
  prism: 900,
}

const DEFAULT_TOP_P: Record<AssistantFamily, number> = {
  nova: 0.9,
  velora: 0.95,
  axiom: 0.9,
  forge: 0.9,
  pulse: 0.92,
  prism: 0.95,
}

export function getAssistantFamilyFromMode(mode: AIMode): AssistantFamily {
  return MODE_TO_FAMILY[mode]
}

export function getAssistantDisplayName(
  family: AssistantFamily,
  tier: SubscriptionTier
): string {
  return TIER_ASSISTANT_NAMES[tier][family]
}

export function getModelForTier(
  family: AssistantFamily,
  tier: SubscriptionTier
): string {
  return MODELS_BY_TIER[tier][family]
}

export function getAllowedModelsForTier(tier: SubscriptionTier): string[] {
  return Array.from(new Set(Object.values(MODELS_BY_TIER[tier])))
}

export function isPremiumTierModel(
  family: AssistantFamily,
  tier: SubscriptionTier
): boolean {
  return tier === 'pro' || tier === 'ultra' || tier === 'prime'
}

export function getTierAssistantModelConfig(
  mode: AIMode,
  tier: SubscriptionTier
): AssistantModelConfig {
  const family = getAssistantFamilyFromMode(mode)
  const model = getModelForTier(family, tier)
  const textPricing = MODEL_PRICING_CONFIG.textModels[model]
  const imagePricing = MODEL_PRICING_CONFIG.imageModels[model]
  const base = ASSISTANT_FAMILY_COPY[family]
  const walletType =
    family === 'prism'
      ? 'image_credits'
      : isPremiumTierModel(family, tier) && tier !== 'basic' && tier !== 'free'
        ? 'tier_tokens'
        : 'core_tokens'

  return {
    family,
    tier,
    mode,
    assistantKind: base.kind,
    displayName: getAssistantDisplayName(family, tier),
    model,
    inputCostPerMillion: textPricing?.inputCostPerMillion ?? 0,
    outputCostPerMillion: textPricing?.outputCostPerMillion ?? 0,
    imageCostPerUnit: imagePricing?.rawCostPerImageUsd,
    walletType,
    temperature: DEFAULT_TEMPERATURE[family],
    maxTokens: DEFAULT_MAX_TOKENS[family],
    topP: DEFAULT_TOP_P[family],
    description: base.description,
  }
}
