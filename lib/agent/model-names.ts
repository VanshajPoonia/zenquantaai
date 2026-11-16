import { getAllowedModelsForTier, resolveModelConfig } from '@/lib/config'
import type { SubscriptionTier, UsageLimitOverride } from '@/types'

export type ZqModelName = 'forge' | 'forge-fast' | 'forge-lite' | 'forge-best'

type TokenWallet = 'core_tokens' | 'tier_tokens'

interface FixedZqModel {
  model: string
  wallet: TokenWallet
  tiers: readonly SubscriptionTier[]
}

const ALL_TIERS = ['free', 'basic', 'pro', 'ultra', 'prime'] as const

/**
 * zq's own models, chosen from the 2026-11 coding evals. `forge` follows each
 * plan's Forge model; the others are fixed. Env vars swap a model without a deploy.
 */
const FIXED_ZQ_MODELS: Record<Exclude<ZqModelName, 'forge'>, FixedZqModel> = {
  'forge-fast': {
    model: process.env.ZQ_FAST_MODEL?.trim() || 'qwen/qwen3-coder-flash',
    wallet: 'core_tokens',
    tiers: ALL_TIERS,
  },
  'forge-lite': {
    model: process.env.ZQ_LITE_MODEL?.trim() || 'deepseek/deepseek-v4-flash',
    wallet: 'core_tokens',
    tiers: ALL_TIERS,
  },
  'forge-best': {
    model: process.env.ZQ_BEST_MODEL?.trim() || 'anthropic/claude-sonnet-4.6',
    wallet: 'tier_tokens',
    tiers: ['pro', 'ultra', 'prime'],
  },
}

export const ZQ_MODEL_NAMES: readonly ZqModelName[] = ['forge', 'forge-fast', 'forge-lite', 'forge-best']

export const ZQ_MODEL_DESCRIPTIONS: Record<ZqModelName, string> = {
  forge: 'Forge on your plan',
  'forge-fast': 'Fast and cheap',
  'forge-best': 'Highest quality',
  'forge-lite': 'Lowest usage',
}

export function isZqModelName(value: unknown): value is ZqModelName {
  return typeof value === 'string' && (ZQ_MODEL_NAMES as readonly string[]).includes(value)
}

export function resolveZqModel(
  name: ZqModelName,
  tier: SubscriptionTier,
  override?: Pick<UsageLimitOverride, 'allowedModelOverrides'> | null
): { model: string; walletType: TokenWallet } | null {
  if (name === 'forge') {
    const config = resolveModelConfig('code', 'auto', tier)
    if (!getAllowedModelsForTier(tier).includes(config.model)) return null
    return {
      model: config.model,
      walletType: config.walletType === 'tier_tokens' ? 'tier_tokens' : 'core_tokens',
    }
  }

  const fixed = FIXED_ZQ_MODELS[name]
  const allowed =
    fixed.tiers.includes(tier) || (override?.allowedModelOverrides?.includes(fixed.model) ?? false)
  if (!allowed) return null
  // A plan without a tier wallet pays premium overrides from its core wallet.
  const walletType = fixed.wallet === 'tier_tokens' && (tier === 'free' || tier === 'basic') ? 'core_tokens' : fixed.wallet
  return { model: fixed.model, walletType }
}

export function listZqModels(
  tier: SubscriptionTier,
  override?: Pick<UsageLimitOverride, 'allowedModelOverrides'> | null
): ZqModelName[] {
  return ZQ_MODEL_NAMES.filter((name) => Boolean(resolveZqModel(name, tier, override)))
}
