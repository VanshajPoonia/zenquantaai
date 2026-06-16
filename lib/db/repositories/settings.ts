import 'server-only'

import { eq } from 'drizzle-orm'
import {
  createSessionSettings,
  DEFAULT_APP_SETTINGS,
  ONBOARDING_ASSISTANT_MODES,
  ONBOARDING_USE_CASES,
  ONBOARDING_VERSION,
  OPENROUTER_DEFAULT_BASE_URL,
  STARTER_PACKS,
} from '@/lib/config'
import {
  AppSettings,
  AppSettingsPatch,
  DefaultProjectBehavior,
  OnboardingState,
  OnboardingUseCase,
  StarterPackId,
  UsageOptimization,
} from '@/types'
import { getDatabaseClient } from '../client'
import { zenUserSettings } from '../schema'
import { toJsonObject } from './helpers'
import { neonUsersRepository } from './users'

const ONBOARDING_USE_CASE_IDS = new Set(
  ONBOARDING_USE_CASES.map((useCase) => useCase.id)
)
const STARTER_PACK_IDS = new Set(Object.keys(STARTER_PACKS) as StarterPackId[])
const ONBOARDING_MODE_IDS = new Set(ONBOARDING_ASSISTANT_MODES)

function isOnboardingUseCase(value: unknown): value is OnboardingUseCase {
  return (
    typeof value === 'string' &&
    ONBOARDING_USE_CASE_IDS.has(value as OnboardingUseCase)
  )
}

function isStarterPackId(value: unknown): value is StarterPackId {
  return typeof value === 'string' && STARTER_PACK_IDS.has(value as StarterPackId)
}

function normalizeOnboarding(input?: Partial<OnboardingState>): OnboardingState {
  const status =
    input?.status === 'completed' || input?.status === 'skipped'
      ? input.status
      : 'not_started'

  return {
    status,
    version: ONBOARDING_VERSION,
    useCase: isOnboardingUseCase(input?.useCase) ? input.useCase : null,
    defaultMode:
      typeof input?.defaultMode === 'string' &&
      ONBOARDING_MODE_IDS.has(input.defaultMode)
        ? input.defaultMode
        : null,
    starterPackId: isStarterPackId(input?.starterPackId)
      ? input.starterPackId
      : null,
    starterProjectId:
      typeof input?.starterProjectId === 'string' ? input.starterProjectId : null,
    installedPromptIds: Array.isArray(input?.installedPromptIds)
      ? input.installedPromptIds.filter((id): id is string => typeof id === 'string')
      : [],
    completedAt: typeof input?.completedAt === 'string' ? input.completedAt : null,
    skippedAt: typeof input?.skippedAt === 'string' ? input.skippedAt : null,
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : null,
  }
}

const VALID_USAGE_OPTIMIZATIONS = new Set<UsageOptimization>([
  'balanced',
  'fast',
  'best_quality',
  'lowest_usage',
])

const VALID_DEFAULT_PROJECT_BEHAVIORS = new Set<DefaultProjectBehavior>([
  'last_used',
  'inbox',
])

function normalizeSettings(input: Partial<AppSettings>): AppSettings {
  const defaultMode = input.defaultMode ?? DEFAULT_APP_SETTINGS.defaultMode

  return {
    theme: 'dark',
    accentStyle: input.accentStyle ?? DEFAULT_APP_SETTINGS.accentStyle,
    defaultMode,
    responseStyle: input.responseStyle ?? DEFAULT_APP_SETTINGS.responseStyle,
    usageOptimization:
      typeof input.usageOptimization === 'string' &&
      VALID_USAGE_OPTIMIZATIONS.has(input.usageOptimization as UsageOptimization)
        ? (input.usageOptimization as UsageOptimization)
        : DEFAULT_APP_SETTINGS.usageOptimization,
    defaultProjectBehavior:
      typeof input.defaultProjectBehavior === 'string' &&
      VALID_DEFAULT_PROJECT_BEHAVIORS.has(
        input.defaultProjectBehavior as DefaultProjectBehavior
      )
        ? (input.defaultProjectBehavior as DefaultProjectBehavior)
        : DEFAULT_APP_SETTINGS.defaultProjectBehavior,
    assistantRecommendations: {
      enabled:
        input.assistantRecommendations?.enabled ??
        DEFAULT_APP_SETTINGS.assistantRecommendations.enabled,
      autoSwitchOnHighConfidence:
        input.assistantRecommendations?.autoSwitchOnHighConfidence ??
        DEFAULT_APP_SETTINGS.assistantRecommendations.autoSwitchOnHighConfidence,
      personalized:
        input.assistantRecommendations?.personalized ??
        DEFAULT_APP_SETTINGS.assistantRecommendations.personalized,
    },
    sessionDefaults: createSessionSettings(defaultMode, {
      temperature:
        input.sessionDefaults?.temperature ??
        DEFAULT_APP_SETTINGS.sessionDefaults.temperature,
      maxTokens:
        input.sessionDefaults?.maxTokens ??
        DEFAULT_APP_SETTINGS.sessionDefaults.maxTokens,
      topP:
        input.sessionDefaults?.topP ??
        DEFAULT_APP_SETTINGS.sessionDefaults.topP,
      modelOverride:
        input.sessionDefaults?.modelOverride ??
        DEFAULT_APP_SETTINGS.sessionDefaults.modelOverride,
      systemPreset:
        input.sessionDefaults?.systemPreset ??
        DEFAULT_APP_SETTINGS.sessionDefaults.systemPreset,
      webSearch:
        input.sessionDefaults?.webSearch ??
        DEFAULT_APP_SETTINGS.sessionDefaults.webSearch,
      memory:
        input.sessionDefaults?.memory ??
        DEFAULT_APP_SETTINGS.sessionDefaults.memory,
      fileContext:
        input.sessionDefaults?.fileContext ??
        DEFAULT_APP_SETTINGS.sessionDefaults.fileContext,
    }),
    gatewayDrafts: {
      openRouterApiKey: '',
      openRouterBaseUrl:
        input.gatewayDrafts?.openRouterBaseUrl ?? OPENROUTER_DEFAULT_BASE_URL,
    },
    onboarding: normalizeOnboarding(input.onboarding),
  }
}

class NeonSettingsRepository {
  async get(userId: string): Promise<AppSettings> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenUserSettings)
      .where(eq(zenUserSettings.userId, userId))
      .limit(1)

    const payload = toJsonObject<Partial<AppSettings>>(rows[0]?.payload, {})
    return normalizeSettings(payload)
  }

  async save(userId: string, settings: AppSettings): Promise<AppSettings> {
    await neonUsersRepository.ensureUserReference(userId)

    const normalized = normalizeSettings(settings)

    await getDatabaseClient()
      .insert(zenUserSettings)
      .values({
        userId,
        payload: normalized,
      })
      .onConflictDoUpdate({
        target: zenUserSettings.userId,
        set: {
          payload: normalized,
          updatedAt: new Date(),
        },
      })

    return normalized
  }

  async patch(userId: string, settings: AppSettingsPatch): Promise<AppSettings> {
    const current = await this.get(userId)
    const next = normalizeSettings({
      ...current,
      ...settings,
      assistantRecommendations: {
        ...current.assistantRecommendations,
        ...settings.assistantRecommendations,
      },
      sessionDefaults: {
        ...current.sessionDefaults,
        ...settings.sessionDefaults,
      },
      gatewayDrafts: {
        ...current.gatewayDrafts,
        ...settings.gatewayDrafts,
      },
      onboarding: {
        ...current.onboarding,
        ...settings.onboarding,
      },
    })

    await this.save(userId, next)
    return next
  }
}

export const neonSettingsRepository = new NeonSettingsRepository()
