import { ImageModelConfig, SubscriptionTier } from '@/types'
import { MODEL_PRICING_CONFIG } from './pricing'

const geminiImagePricing =
  MODEL_PRICING_CONFIG.imageModels['google/gemini-2.5-flash-image']
const openAiImagePricing =
  MODEL_PRICING_CONFIG.imageModels['openai/gpt-5-image']

export const IMAGE_MODEL_CONFIGS: Record<SubscriptionTier, ImageModelConfig> = {
  free: {
    family: 'prism',
    tier: 'free',
    displayName: 'Prism',
    model: 'google/gemini-2.5-flash-image',
    rawCostPerImageUsd: geminiImagePricing.rawCostPerImageUsd,
    defaultImageCreditsPerImage: geminiImagePricing.defaultImageCreditsPerImage,
  },
  basic: {
    family: 'prism',
    tier: 'basic',
    displayName: 'Prism Plus',
    model: 'google/gemini-2.5-flash-image',
    rawCostPerImageUsd: geminiImagePricing.rawCostPerImageUsd,
    defaultImageCreditsPerImage: geminiImagePricing.defaultImageCreditsPerImage,
  },
  pro: {
    family: 'prism',
    tier: 'pro',
    displayName: 'Prism 3.1',
    model: 'google/gemini-2.5-flash-image',
    rawCostPerImageUsd: geminiImagePricing.rawCostPerImageUsd,
    defaultImageCreditsPerImage: geminiImagePricing.defaultImageCreditsPerImage,
  },
  ultra: {
    family: 'prism',
    tier: 'ultra',
    displayName: 'Prism Ultra',
    model: 'openai/gpt-5-image',
    rawCostPerImageUsd: openAiImagePricing.rawCostPerImageUsd,
    defaultImageCreditsPerImage: openAiImagePricing.defaultImageCreditsPerImage,
  },
  prime: {
    family: 'prism',
    tier: 'prime',
    displayName: 'Prism Prime',
    model: 'openai/gpt-5-image',
    rawCostPerImageUsd: openAiImagePricing.rawCostPerImageUsd,
    defaultImageCreditsPerImage: openAiImagePricing.defaultImageCreditsPerImage,
  },
}
