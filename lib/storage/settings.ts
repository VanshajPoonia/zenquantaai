import {
  createSessionSettings,
  DEFAULT_APP_SETTINGS,
  OPENROUTER_DEFAULT_BASE_URL,
} from '@/lib/config'
import { AppSettings, AppSettingsPatch } from '@/types'
import { neonQuery } from './neon'

type SettingsRow = {
  user_id: string
  payload: Partial<AppSettings> | null
  created_at: string
  updated_at: string
}

export interface SettingsStore {
  get(userId: string): Promise<AppSettings>
  save(userId: string, settings: AppSettings): Promise<AppSettings>
  patch(userId: string, settings: AppSettingsPatch): Promise<AppSettings>
}

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

class NeonSettingsStore implements SettingsStore {
  async get(userId: string): Promise<AppSettings> {
    const rows = await neonQuery<SettingsRow>(
      'select * from public.zen_user_settings where user_id = $1',
      [userId]
    ).catch(() => [])

    const payload = rows[0]?.payload ?? {}
    return normalizeSettings(payload)
  }

  async save(userId: string, settings: AppSettings): Promise<AppSettings> {
    const normalized = normalizeSettings(settings)

    await neonQuery<SettingsRow>(
      `
        insert into public.zen_user_settings (user_id, payload)
        values ($1, $2::jsonb)
        on conflict (user_id) do update
        set payload = excluded.payload,
            updated_at = timezone('utc', now())
      `,
      [userId, JSON.stringify(normalized)]
    )

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

export const settingsStore: SettingsStore = new NeonSettingsStore()
