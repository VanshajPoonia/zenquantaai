import { getAllowedModelsForTier, resolveModelConfig } from '@/lib/config'
import type { ModelOverrideOption, SubscriptionTier, UsageLimitOverride } from '@/types'

/** Zenquanta model names for zq and the Model API. Raw OpenRouter IDs stay private. */
export const ZQ_MODEL_PROFILES = {
  forge: 'auto',
  'forge-fast': 'gemini',
  'forge-best': 'claude',
  'forge-lite': 'deepseek',
} as const satisfies Record<string, ModelOverrideOption>

export type ZqModelName = keyof typeof ZQ_MODEL_PROFILES

export const ZQ_MODEL_DESCRIPTIONS: Record<ZqModelName, string> = {
  forge: 'Forge on your plan',
  'forge-fast': 'Fast and cheap',
  'forge-best': 'Highest quality',
  'forge-lite': 'Lowest usage',
}

export function isZqModelName(value: unknown): value is ZqModelName {
  return typeof value === 'string' && value in ZQ_MODEL_PROFILES
}

export function resolveZqModel(
  name: ZqModelName,
  tier: SubscriptionTier,
  override?: Pick<UsageLimitOverride, 'allowedModelOverrides'> | null
): { model: string; walletType: 'core_tokens' | 'tier_tokens' } | null {
  const config = resolveModelConfig('code', ZQ_MODEL_PROFILES[name], tier)
  const allowed =
    getAllowedModelsForTier(tier).includes(config.model) ||
    (override?.allowedModelOverrides?.includes(config.model) ?? false)
  if (!allowed) return null
  return {
    model: config.model,
    walletType: config.walletType === 'tier_tokens' ? 'tier_tokens' : 'core_tokens',
  }
}

export function listZqModels(
  tier: SubscriptionTier,
  override?: Pick<UsageLimitOverride, 'allowedModelOverrides'> | null
): ZqModelName[] {
  return (Object.keys(ZQ_MODEL_PROFILES) as ZqModelName[]).filter((name) =>
    Boolean(resolveZqModel(name, tier, override))
  )
}
