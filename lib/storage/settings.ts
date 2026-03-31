import {
  createSessionSettings,
  DEFAULT_APP_SETTINGS,
  OPENROUTER_DEFAULT_BASE_URL,
} from '@/lib/config'
import { SEEDED_APP_SETTINGS } from '@/data/seed/settings'
import { AppSettings, AppSettingsPatch } from '@/types'
import { fileExists, readJsonFile, resolveRuntimePath, writeJsonFile } from './files'

const SETTINGS_FILE = resolveRuntimePath('settings.json')

export interface SettingsStore {
  get(): Promise<AppSettings>
  save(settings: AppSettings): Promise<AppSettings>
  patch(settings: AppSettingsPatch): Promise<AppSettings>
}

async function ensureSeededSettings(): Promise<AppSettings> {
  const existing = await readJsonFile<AppSettings>(SETTINGS_FILE)
  if (existing) return existing

  await writeJsonFile(SETTINGS_FILE, SEEDED_APP_SETTINGS)
  return SEEDED_APP_SETTINGS
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
      openRouterApiKey: input.gatewayDrafts?.openRouterApiKey ?? '',
      openRouterBaseUrl:
        input.gatewayDrafts?.openRouterBaseUrl ??
        OPENROUTER_DEFAULT_BASE_URL,
    },
  }
}

function migrateSettings(raw: unknown): AppSettings {
  const input = (raw ?? {}) as Partial<AppSettings> & {
    // Legacy runtime JSON may still carry the pre-OpenRouter settings shape.
    providerDrafts?: Record<string, string | undefined>
  }

  return normalizeSettings({
    ...input,
    gatewayDrafts: {
      openRouterApiKey: input.gatewayDrafts?.openRouterApiKey ?? '',
      openRouterBaseUrl:
        input.gatewayDrafts?.openRouterBaseUrl ??
        OPENROUTER_DEFAULT_BASE_URL,
    },
  })
}

class JsonSettingsStore implements SettingsStore {
  async get(): Promise<AppSettings> {
    const exists = await fileExists(SETTINGS_FILE)

    if (!exists) {
      return ensureSeededSettings()
    }

    const rawSettings = await readJsonFile<unknown>(SETTINGS_FILE)
    const settings = rawSettings
      ? migrateSettings(rawSettings)
      : await ensureSeededSettings()

    await writeJsonFile(SETTINGS_FILE, settings)

    return settings
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    const normalized = normalizeSettings(settings)
    await writeJsonFile(SETTINGS_FILE, normalized)
    return normalized
  }

  async patch(settings: AppSettingsPatch): Promise<AppSettings> {
    const current = await this.get()
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

    await writeJsonFile(SETTINGS_FILE, next)

    return next
  }
}

export const settingsStore: SettingsStore = new JsonSettingsStore()
