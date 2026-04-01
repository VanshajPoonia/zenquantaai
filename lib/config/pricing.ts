import {
  AssistantFamily,
  PricingConfig,
  SubscriptionTier,
  TierPlanConfig,
} from '@/types'

export const DISPLAY_CREDITS_PER_USD = 100

export const PLAN_PRICES: Record<SubscriptionTier, number> = {
  free: 0,
  basic: 4,
  pro: 15,
  ultra: 59,
  prime: 200,
}

export const DISPLAY_MULTIPLIERS: Record<SubscriptionTier, number> = {
  free: 2,
  basic: 2,
  pro: 1.5,
  ultra: 1.5,
  prime: 1.5,
}

export const TIER_ASSISTANT_NAMES: Record<
  SubscriptionTier,
  Record<AssistantFamily, string>
> = {
  free: {
    nova: 'Nova',
    velora: 'Velora',
    axiom: 'Axiom',
    forge: 'Forge',
    pulse: 'Pulse',
    prism: 'Prism',
  },
  basic: {
    nova: 'Nova Plus',
    velora: 'Velora Plus',
    axiom: 'Axiom Plus',
    forge: 'Forge Plus',
    pulse: 'Pulse Plus',
    prism: 'Prism Plus',
  },
  pro: {
    nova: 'Nova 3.1',
    velora: 'Velora 3.1',
    axiom: 'Axiom 3.1',
    forge: 'Forge 3.1',
    pulse: 'Pulse 3.1',
    prism: 'Prism 3.1',
  },
  ultra: {
    nova: 'Nova Ultra',
    velora: 'Velora Ultra',
    axiom: 'Axiom Ultra',
    forge: 'Forge Ultra',
    pulse: 'Pulse Ultra',
    prism: 'Prism Ultra',
  },
  prime: {
    nova: 'Nova Prime',
    velora: 'Velora Prime',
    axiom: 'Axiom Prime',
    forge: 'Forge Prime',
    pulse: 'Pulse Prime',
    prism: 'Prism Prime',
  },
}

export const PLAN_CONFIGS: Record<SubscriptionTier, TierPlanConfig> = {
  free: {
    tier: 'free',
    priceUsd: 0,
    displayMultiplier: 2,
    assistantNames: TIER_ASSISTANT_NAMES.free,
    coreTokens: 1_000_000,
    tierTokens: 0,
    imageCredits: 50,
    dailyMessageLimit: 50,
    maxInputTokensPerRequest: 8_000,
    maxOutputTokensPerRequest: 800,
    maxImagesPerDay: 2,
  },
  basic: {
    tier: 'basic',
    priceUsd: 4,
    displayMultiplier: 2,
    assistantNames: TIER_ASSISTANT_NAMES.basic,
    coreTokens: 2_000_000,
    tierTokens: 0,
    imageCredits: 150,
    dailyMessageLimit: 250,
    maxInputTokensPerRequest: 16_000,
    maxOutputTokensPerRequest: 1_500,
    maxImagesPerDay: 5,
  },
  pro: {
    tier: 'pro',
    priceUsd: 15,
    displayMultiplier: 1.5,
    assistantNames: TIER_ASSISTANT_NAMES.pro,
    coreTokens: 3_000_000,
    tierTokens: 650_000,
    imageCredits: 400,
    dailyMessageLimit: 700,
    maxInputTokensPerRequest: 32_000,
    maxOutputTokensPerRequest: 2_500,
    maxImagesPerDay: 15,
  },
  ultra: {
    tier: 'ultra',
    priceUsd: 59,
    displayMultiplier: 1.5,
    assistantNames: TIER_ASSISTANT_NAMES.ultra,
    coreTokens: 5_000_000,
    tierTokens: 2_700_000,
    imageCredits: 1_200,
    dailyMessageLimit: 1_500,
    maxInputTokensPerRequest: 64_000,
    maxOutputTokensPerRequest: 5_000,
    maxImagesPerDay: 40,
  },
  prime: {
    tier: 'prime',
    priceUsd: 200,
    displayMultiplier: 1.5,
    assistantNames: TIER_ASSISTANT_NAMES.prime,
    coreTokens: 8_000_000,
    tierTokens: 8_000_000,
    imageCredits: 4_000,
    dailyMessageLimit: 3_000,
    maxInputTokensPerRequest: 128_000,
    maxOutputTokensPerRequest: 8_000,
    maxImagesPerDay: 100,
  },
}

// These cost figures are centrally configurable estimates and should be reviewed
// against current OpenRouter pricing before production billing.
export const MODEL_PRICING_CONFIG: PricingConfig = {
  textModels: {
    'openai/gpt-4.1-mini': {
      inputCostPerMillion: 0.4,
      outputCostPerMillion: 1.6,
    },
    'google/gemini-2.5-flash': {
      inputCostPerMillion: 0.15,
      outputCostPerMillion: 0.6,
    },
    'deepseek/deepseek-chat-v3.1': {
      inputCostPerMillion: 0.3,
      outputCostPerMillion: 0.9,
    },
    'qwen/qwen3-coder': {
      inputCostPerMillion: 0.45,
      outputCostPerMillion: 1.2,
    },
    'x-ai/grok-4.1-fast': {
      inputCostPerMillion: 0.7,
      outputCostPerMillion: 2.4,
    },
    'openai/gpt-5': {
      inputCostPerMillion: 1.25,
      outputCostPerMillion: 10,
    },
    'google/gemini-2.5-pro': {
      inputCostPerMillion: 1.25,
      outputCostPerMillion: 5,
    },
    'openai/gpt-5.3-codex': {
      inputCostPerMillion: 1.5,
      outputCostPerMillion: 8,
    },
    'x-ai/grok-4.20': {
      inputCostPerMillion: 2,
      outputCostPerMillion: 8,
    },
    'openai/gpt-5.4': {
      inputCostPerMillion: 2.2,
      outputCostPerMillion: 11,
    },
    'anthropic/claude-sonnet-4.6': {
      inputCostPerMillion: 3,
      outputCostPerMillion: 15,
    },
    'google/gemini-3.1-pro-preview': {
      inputCostPerMillion: 2.5,
      outputCostPerMillion: 10,
    },
    'anthropic/claude-opus-4.6': {
      inputCostPerMillion: 15,
      outputCostPerMillion: 75,
    },
    'anthropic/claude-sonnet-4.5': {
      inputCostPerMillion: 3,
      outputCostPerMillion: 15,
    },
  },
  imageModels: {
    'google/gemini-2.5-flash-image': {
      rawCostPerImageUsd: 0.035,
      defaultImageCreditsPerImage: 10,
    },
    'google/gemini-2.5-flash-image-preview': {
      rawCostPerImageUsd: 0.035,
      defaultImageCreditsPerImage: 10,
    },
    'openai/gpt-5-image': {
      rawCostPerImageUsd: 0.11,
      defaultImageCreditsPerImage: 20,
    },
  },
}

export function usdToDisplayedCredits(usd: number): number {
  return Math.round(usd * DISPLAY_CREDITS_PER_USD)
}
