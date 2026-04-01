import {
  Subscription,
  UsageLimitOverride,
  UsageWallet,
} from '@/types'
import { getRemainingWallets } from './costs'

function applyOverride(
  subscription: Subscription,
  override: UsageLimitOverride | null
): Subscription {
  if (!override) return subscription

  return {
    ...subscription,
    coreTokensIncluded:
      override.coreTokensIncluded ?? subscription.coreTokensIncluded,
    tierTokensIncluded:
      override.tierTokensIncluded ?? subscription.tierTokensIncluded,
    imageCreditsIncluded:
      override.imageCreditsIncluded ?? subscription.imageCreditsIncluded,
    dailyMessageLimit:
      override.dailyMessageLimit ?? subscription.dailyMessageLimit,
    maxInputTokensPerRequest:
      override.maxInputTokensPerRequest ?? subscription.maxInputTokensPerRequest,
    maxOutputTokensPerRequest:
      override.maxOutputTokensPerRequest ?? subscription.maxOutputTokensPerRequest,
    maxImagesPerDay: override.maxImagesPerDay ?? subscription.maxImagesPerDay,
  }
}

export function getEffectiveSubscription(
  subscription: Subscription,
  override: UsageLimitOverride | null
): Subscription {
  return applyOverride(subscription, override)
}

export function assertModelOverrideAllowed(
  override: UsageLimitOverride | null,
  model: string
) {
  if (!override?.allowedModelOverrides?.length) return

  if (!override.allowedModelOverrides.includes(model)) {
    throw new Error('That model is not available for this account.')
  }
}

export function enforceTextUsage(input: {
  subscription: Subscription
  override: UsageLimitOverride | null
  estimatedPromptTokens: number
  requestedMaxOutputTokens: number
  walletType: UsageWallet
}) {
  const subscription = getEffectiveSubscription(input.subscription, input.override)

  if (subscription.status !== 'active') {
    throw new Error('Your plan is not active right now.')
  }

  if (subscription.dailyMessageCount >= subscription.dailyMessageLimit) {
    throw new Error('You have reached your daily message limit for this plan.')
  }

  if (input.estimatedPromptTokens > subscription.maxInputTokensPerRequest) {
    throw new Error('This request is too large for your current plan.')
  }

  if (input.requestedMaxOutputTokens > subscription.maxOutputTokensPerRequest) {
    throw new Error('The requested response length exceeds your current plan.')
  }

  const wallets = getRemainingWallets(subscription)

  if (input.walletType === 'tier_tokens' && wallets.tierTokens <= 0) {
    throw new Error('Your premium assistant wallet is exhausted for this cycle.')
  }

  if (input.walletType === 'core_tokens' && wallets.coreTokens <= 0) {
    throw new Error('Your core assistant wallet is exhausted for this cycle.')
  }
}

export function enforceImageUsage(input: {
  subscription: Subscription
  override: UsageLimitOverride | null
  imageCount: number
  imageCreditsRequired: number
}) {
  const subscription = getEffectiveSubscription(input.subscription, input.override)

  if (subscription.status !== 'active') {
    throw new Error('Your plan is not active right now.')
  }

  if (
    subscription.dailyImageCount + input.imageCount >
    subscription.maxImagesPerDay
  ) {
    throw new Error('You have reached your daily image limit for this plan.')
  }

  const wallets = getRemainingWallets(subscription)

  if (wallets.imageCredits < input.imageCreditsRequired) {
    throw new Error('You do not have enough image credits remaining.')
  }
}
