import { AppSettings, Conversation, Project, PromptLibraryItem } from '@/types'
import {
  createSessionSettings,
  DEFAULT_APP_SETTINGS,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
} from '@/lib/config'
import { updateConversationSnapshot } from '@/lib/utils/chat'

const CONVERSATIONS_KEY = 'zenquanta:conversations:v1'
const SETTINGS_KEY = 'zenquanta:settings:v1'
const CURRENT_CHAT_ID_KEY = 'zenquanta:current-chat-id:v1'
const PROJECTS_KEY = 'zenquanta:projects:v1'
const PROMPTS_KEY = 'zenquanta:prompts:v1'
const SELECTED_PROJECT_ID_KEY = 'zenquanta:selected-project-id:v1'
const SIDEBAR_WIDTH_KEY = 'zenquanta:sidebar-width:v1'
const IMPORT_MARKER_PREFIX = 'zenquanta:supabase-imported:v1:'

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
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

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeAppSettings(input: AppSettings | null): AppSettings | null {
  if (!input) return null

  const defaultMode = input.defaultMode ?? DEFAULT_APP_SETTINGS.defaultMode

  return {
    ...DEFAULT_APP_SETTINGS,
    ...input,
    defaultMode,
    assistantRecommendations: {
      ...DEFAULT_APP_SETTINGS.assistantRecommendations,
      ...input.assistantRecommendations,
    },
    sessionDefaults: createSessionSettings(defaultMode, {
      temperature: input.sessionDefaults?.temperature,
      maxTokens: input.sessionDefaults?.maxTokens,
      topP: input.sessionDefaults?.topP,
      modelOverride: input.sessionDefaults?.modelOverride,
      systemPreset: input.sessionDefaults?.systemPreset,
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
      modelOverride: conversation.sessionSettings?.modelOverride,
      systemPreset: conversation.sessionSettings?.systemPreset,
      webSearch: conversation.sessionSettings?.webSearch,
      memory: conversation.sessionSettings?.memory,
      fileContext: conversation.sessionSettings?.fileContext,
    }),
    projectId: conversation.projectId ?? DEFAULT_PROJECT_ID,
    attachments: conversation.attachments ?? [],
    messages: conversation.messages.map((message) => ({
      ...message,
      attachments: message.attachments ?? [],
    })),
  })
}

function normalizeProjects(input: unknown): Project[] {
  const defaultProject: Project = {
    id: DEFAULT_PROJECT_ID,
    name: DEFAULT_PROJECT_NAME,
    description: 'Default home for new chats',
    color: 'general',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    isDefault: true,
  }

  const items = Array.isArray(input) ? input : []
  const projectMap = new Map<string, Project>([[defaultProject.id, defaultProject]])

  for (const item of items) {
    if (!item || typeof item !== 'object') continue

    const project = item as Project & { workspaceId?: string }
    if (!project.id || !project.name) continue

    projectMap.set(project.id, {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color || 'general',
      createdAt: project.createdAt || defaultProject.createdAt,
      updatedAt: project.updatedAt || defaultProject.updatedAt,
      isDefault: project.id === DEFAULT_PROJECT_ID || Boolean(project.isDefault),
    })
  }

  return [...projectMap.values()].sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })
}

function normalizePrompts(input: unknown): PromptLibraryItem[] {
  const items = Array.isArray(input) ? input : []

  return items
    .filter((item): item is PromptLibraryItem & { workspaceId?: string } => {
      if (!item || typeof item !== 'object') return false
      const prompt = item as PromptLibraryItem & { workspaceId?: string }
      return Boolean(prompt.id && prompt.title && prompt.content)
    })
    .map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      content: prompt.content,
      mode: prompt.mode,
      createdAt: prompt.createdAt,
      updatedAt: prompt.updatedAt,
    }))
}

export function readBrowserConversations(): Conversation[] | null {
  const conversations = readJson<Conversation[]>(CONVERSATIONS_KEY)
  return conversations?.map(normalizeConversation) ?? null
}

export function writeBrowserConversations(conversations: Conversation[]): void {
  writeJson(CONVERSATIONS_KEY, conversations)
}

export function readBrowserAppSettings(): AppSettings | null {
  return normalizeAppSettings(readJson<AppSettings>(SETTINGS_KEY))
}

export function writeBrowserAppSettings(settings: AppSettings): void {
  writeJson(SETTINGS_KEY, settings)
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

export function readBrowserProjects(): Project[] | null {
  return normalizeProjects(readJson<Project[]>(PROJECTS_KEY))
}

export function writeBrowserProjects(projects: Project[]): void {
  writeJson(PROJECTS_KEY, projects)
}

export function readBrowserPromptLibrary(): PromptLibraryItem[] | null {
  return normalizePrompts(readJson<PromptLibraryItem[]>(PROMPTS_KEY))
}

export function writeBrowserPromptLibrary(items: PromptLibraryItem[]): void {
  writeJson(PROMPTS_KEY, items)
}

export function readBrowserSelectedProjectId(): string | null {
  if (!canUseBrowserStorage()) return null
  return window.localStorage.getItem(SELECTED_PROJECT_ID_KEY)
}

export function writeBrowserSelectedProjectId(projectId: string | null): void {
  if (!canUseBrowserStorage()) return

  if (!projectId) {
    window.localStorage.removeItem(SELECTED_PROJECT_ID_KEY)
    return
  }

  window.localStorage.setItem(SELECTED_PROJECT_ID_KEY, projectId)
}

export function readBrowserSidebarWidth(): number | null {
  if (!canUseBrowserStorage()) return null
  const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY)
  if (!raw) return null

  const width = Number(raw)
  return Number.isFinite(width) ? width : null
}

export function writeBrowserSidebarWidth(width: number): void {
  if (!canUseBrowserStorage()) return
  window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width))
}

function importMarkerKey(userId: string): string {
  return `${IMPORT_MARKER_PREFIX}${userId}`
}

export function hasLocalImportMarker(userId: string): boolean {
  if (!canUseBrowserStorage()) return false
  return window.localStorage.getItem(importMarkerKey(userId)) === '1'
}

export function writeLocalImportMarker(userId: string): void {
  if (!canUseBrowserStorage()) return
  window.localStorage.setItem(importMarkerKey(userId), '1')
}
