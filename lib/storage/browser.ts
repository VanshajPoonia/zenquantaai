import { SEEDED_CONVERSATIONS } from '@/data/seed/conversations'
import { SEEDED_APP_SETTINGS } from '@/data/seed/settings'
import { AppSettings, Conversation } from '@/types'
import { createSessionSettings, DEFAULT_APP_SETTINGS } from '@/lib/config'
import { updateConversationSnapshot } from '@/lib/utils/chat'

const CONVERSATIONS_KEY = 'zenquanta:conversations:v1'
const SETTINGS_KEY = 'zenquanta:settings:v1'
const CURRENT_CHAT_ID_KEY = 'zenquanta:current-chat-id:v1'

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function readJson<T>(key: string): T | null {
  if (!canUseBrowserStorage()) return null

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseBrowserStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function normalizeAppSettings(input: AppSettings | null): AppSettings | null {
  if (!input) return null

  const defaultMode = input.defaultMode ?? DEFAULT_APP_SETTINGS.defaultMode

  return {
    ...DEFAULT_APP_SETTINGS,
    ...input,
    defaultMode,
    sessionDefaults: createSessionSettings(defaultMode, {
      temperature: input.sessionDefaults?.temperature,
      maxTokens: input.sessionDefaults?.maxTokens,
      topP: input.sessionDefaults?.topP,
      webSearch: input.sessionDefaults?.webSearch,
      memory: input.sessionDefaults?.memory,
      fileContext: input.sessionDefaults?.fileContext,
    }),
  }
}

function normalizeConversation(conversation: Conversation): Conversation {
  return updateConversationSnapshot({
    ...conversation,
    sessionSettings: createSessionSettings(conversation.mode, {
      temperature: conversation.sessionSettings?.temperature,
      maxTokens: conversation.sessionSettings?.maxTokens,
      topP: conversation.sessionSettings?.topP,
      webSearch: conversation.sessionSettings?.webSearch,
      memory: conversation.sessionSettings?.memory,
      fileContext: conversation.sessionSettings?.fileContext,
    }),
    attachments: conversation.attachments ?? [],
    messages: conversation.messages.map((message) => ({
      ...message,
      attachments: message.attachments ?? [],
    })),
  })
}

export function readBrowserConversations(): Conversation[] | null {
  const conversations = readJson<Conversation[]>(CONVERSATIONS_KEY)
  return conversations?.map(normalizeConversation) ?? null
}

export function writeBrowserConversations(conversations: Conversation[]): void {
  writeJson(CONVERSATIONS_KEY, conversations)
}

export function getSeededBrowserConversations(): Conversation[] {
  return cloneValue(SEEDED_CONVERSATIONS)
}

export function readBrowserAppSettings(): AppSettings | null {
  return normalizeAppSettings(readJson<AppSettings>(SETTINGS_KEY))
}

export function writeBrowserAppSettings(settings: AppSettings): void {
  writeJson(SETTINGS_KEY, settings)
}

export function getSeededBrowserAppSettings(): AppSettings {
  return cloneValue(SEEDED_APP_SETTINGS)
}

export function readBrowserCurrentChatId(): string | null {
  if (!canUseBrowserStorage()) return null
  return window.localStorage.getItem(CURRENT_CHAT_ID_KEY)
}

export function writeBrowserCurrentChatId(chatId: string | null): void {
  if (!canUseBrowserStorage()) return

  if (!chatId) {
    window.localStorage.removeItem(CURRENT_CHAT_ID_KEY)
    return
  }

  window.localStorage.setItem(CURRENT_CHAT_ID_KEY, chatId)
}
