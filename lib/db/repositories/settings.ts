import 'server-only'

import { eq } from 'drizzle-orm'
import {
  createSessionSettings,
  DEFAULT_APP_SETTINGS,
  OPENROUTER_DEFAULT_BASE_URL,
} from '@/lib/config'
import { AppSettings, AppSettingsPatch } from '@/types'
import { getDatabaseClient } from '../client'
import { zenUserSettings } from '../schema'
import { toJsonObject } from './helpers'

function normalizeSettings(input: Partial<AppSettings>): AppSettings {
  const defaultMode = input.defaultMode ?? DEFAULT_APP_SETTINGS.defaultMode

  return {
    theme: 'dark',
    accentStyle: input.accentStyle ?? DEFAULT_APP_SETTINGS.accentStyle,
    defaultMode,
    responseStyle: input.responseStyle ?? DEFAULT_APP_SETTINGS.responseStyle,
    assistantRecommendations: {
      enabled:
        input.assistantRecommendations?.enabled ??
        DEFAULT_APP_SETTINGS.assistantRecommendations.enabled,
      autoSwitchOnHighConfidence:
        input.assistantRecommendations?.autoSwitchOnHighConfidence ??
        DEFAULT_APP_SETTINGS.assistantRecommendations.autoSwitchOnHighConfidence,
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
    })

    await this.save(userId, next)
    return next
  }
}

export const neonSettingsRepository = new NeonSettingsRepository()
