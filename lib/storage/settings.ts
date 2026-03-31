import {
  createSessionSettings,
  DEFAULT_APP_SETTINGS,
  OPENROUTER_DEFAULT_BASE_URL,
} from '@/lib/config'
import { AppSettings, AppSettingsPatch } from '@/types'
import { supabaseRequest } from './supabase'

const SETTINGS_TABLE = 'zen_user_settings'

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

class SupabaseSettingsStore implements SettingsStore {
  async get(userId: string): Promise<AppSettings> {
    const rows = await supabaseRequest<SettingsRow[]>(SETTINGS_TABLE, {
      query: {
        user_id: `eq.${userId}`,
      },
    }).catch(() => [])

    const payload = rows[0]?.payload ?? {}
    return normalizeSettings(payload)
  }

  async save(userId: string, settings: AppSettings): Promise<AppSettings> {
    const normalized = normalizeSettings(settings)

    await supabaseRequest<SettingsRow[]>(SETTINGS_TABLE, {
      method: 'POST',
      body: {
        user_id: userId,
        payload: normalized,
      },
      prefer: 'resolution=merge-duplicates,return=representation',
    })

    return normalized
  }

  async patch(userId: string, settings: AppSettingsPatch): Promise<AppSettings> {
    const current = await this.get(userId)
    const next = normalizeSettings({
      ...current,
      ...settings,
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

export const settingsStore: SettingsStore = new SupabaseSettingsStore()
