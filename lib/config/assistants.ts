import {
  AssistantFamily,
  AssistantModelConfig,
  AIMode,
  AssistantPublicPageConfig,
  SubscriptionTier,
} from '@/types'
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

export const ASSISTANT_PUBLIC_PAGES: Record<
  AssistantFamily,
  AssistantPublicPageConfig
> = {
  nova: {
    family: 'nova',
    slug: 'nova',
    mode: 'general',
    badge: 'General intelligence',
    headline: 'Nova keeps broad work clear, useful, and fast-moving.',
    subheadline:
      'Use Nova when the work is open-ended and the priority is turning ambiguity into organized progress.',
    positioning:
      'Nova is the default Zenquanta engine for planning, synthesis, summaries, and practical decision support.',
    bestFor: [
      'Daily planning and structured execution',
      'Summaries, notes, and simplification',
      'Recommendation-style help and brainstorming',
    ],
    demoHighlights: [
      'Turns rough notes into a clean action plan',
      'Organizes messy thinking into confident next steps',
      'Handles broad questions without feeling generic',
    ],
  },
  velora: {
    family: 'velora',
    slug: 'velora',
    mode: 'creative',
    badge: 'Creative engine',
    headline: 'Velora is built for taste, tone, and original direction.',
    subheadline:
      'Use Velora for copy, storytelling, concepts, naming, creative framing, and stronger brand language.',
    positioning:
      'Velora is Zenquanta’s expressive assistant for writing that needs voice, elegance, and imaginative range.',
    bestFor: [
      'Creative writing and concept work',
      'Brand copy and campaign language',
      'Naming, slogans, and art direction prompts',
    ],
    demoHighlights: [
      'Sharpens flat writing into premium-feeling copy',
      'Finds distinctive angles instead of generic phrasing',
      'Keeps tone consistent across longer drafts',
    ],
  },
  axiom: {
    family: 'axiom',
    slug: 'axiom',
    mode: 'logic',
    badge: 'Reasoning engine',
    headline: 'Axiom is for decisions that need structure, not guesswork.',
    subheadline:
      'Use Axiom when you need rigorous comparisons, tradeoff analysis, and stepwise reasoning.',
    positioning:
      'Axiom is Zenquanta’s analytical assistant for decisions, frameworks, comparisons, and careful evaluation.',
    bestFor: [
      'Decision frameworks and tradeoffs',
      'Complex comparisons and analysis',
      'Breaking hard questions into clear reasoning',
    ],
    demoHighlights: [
      'Separates signal from noise in complex choices',
      'Produces more disciplined comparisons and criteria',
      'Helps explain why a decision makes sense',
    ],
  },
  forge: {
    family: 'forge',
    slug: 'forge',
    mode: 'code',
    badge: 'Technical engine',
    headline: 'Forge focuses on implementation, debugging, and shipping.',
    subheadline:
      'Use Forge for code generation, system design, debugging, architecture, and technical planning.',
    positioning:
      'Forge is Zenquanta’s implementation-heavy assistant for developers and technical operators.',
    bestFor: [
      'Debugging and root-cause analysis',
      'Building features and route handlers',
      'Architecture notes and refactor planning',
    ],
    demoHighlights: [
      'Produces implementation-ready technical output',
      'Stays grounded in practical engineering tradeoffs',
      'Works well for both debugging and new feature delivery',
    ],
  },
  pulse: {
    family: 'pulse',
    slug: 'pulse',
    mode: 'live',
    badge: 'Current-context engine',
    headline: 'Pulse is tuned for fast-moving context and live-style synthesis.',
    subheadline:
      'Use Pulse for market scans, current-context questions, active research, and quick synthesis.',
    positioning:
      'Pulse is Zenquanta’s research-oriented assistant for current information and fast situational awareness.',
    bestFor: [
      'Current-context research and synthesis',
      'Comparing fast-moving markets or products',
      'Rapid investigation and follow-up questioning',
    ],
    demoHighlights: [
      'Feels faster and more current for live-style work',
      'Good for active research threads and synthesis',
      'Keeps answers concise while still directional',
    ],
  },
  prism: {
    family: 'prism',
    slug: 'prism',
    mode: 'image',
    badge: 'Visual engine',
    headline: 'Prism turns creative direction into polished visual output.',
    subheadline:
      'Use Prism for image generation, concept visuals, product renders, editorial ideas, and art direction.',
    positioning:
      'Prism is Zenquanta’s image-generation assistant for visual ideation and branded creative output.',
    bestFor: [
      'Campaign visuals and hero images',
      'Product renders and editorial concepts',
      'Moodboards, style exploration, and art direction',
    ],
    demoHighlights: [
      'Transforms plain prompts into stronger visual direction',
      'Fits branded creative work better than generic image tools',
      'Keeps image usage separate from text usage in Zenquanta',
    ],
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

export function getAssistantPublicPageBySlug(slug: string) {
  return Object.values(ASSISTANT_PUBLIC_PAGES).find((page) => page.slug === slug) ?? null
}
