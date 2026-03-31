import { SEEDED_CONVERSATIONS } from '@/data/seed/conversations'
import { SEEDED_APP_SETTINGS } from '@/data/seed/settings'
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
const WORKSPACE_ID_KEY = 'zenquanta:workspace-id:v1'
const PROJECTS_KEY = 'zenquanta:projects:v1'
const PROMPTS_KEY = 'zenquanta:prompts:v1'
const SELECTED_PROJECT_ID_KEY = 'zenquanta:selected-project-id:v1'

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

function createRandomId(prefix: string): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return `${prefix}-${id}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function createDefaultProject(workspaceId: string): Project {
  const now = nowIso()

  return {
    id: DEFAULT_PROJECT_ID,
    workspaceId,
    name: DEFAULT_PROJECT_NAME,
    description: 'Default home for new chats',
    color: 'general',
    createdAt: now,
    updatedAt: now,
    isDefault: true,
  }
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

export function ensureBrowserWorkspaceId(): string {
  if (!canUseBrowserStorage()) {
    return createRandomId('workspace')
  }

  const existing = window.localStorage.getItem(WORKSPACE_ID_KEY)
  if (existing) return existing

  const next = createRandomId('workspace')
  window.localStorage.setItem(WORKSPACE_ID_KEY, next)
  return next
}

function normalizeProjects(
  workspaceId: string,
  input: Project[] | null
): Project[] {
  const projectMap = new Map<string, Project>()
  const defaultProject = createDefaultProject(workspaceId)

  projectMap.set(defaultProject.id, defaultProject)

  for (const project of input ?? []) {
    projectMap.set(project.id, {
      ...project,
      workspaceId,
      color: project.color || 'general',
      isDefault: project.id === DEFAULT_PROJECT_ID,
      createdAt: project.createdAt || defaultProject.createdAt,
      updatedAt: project.updatedAt || defaultProject.updatedAt,
    })
  }

  return [...projectMap.values()].sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })
}

export function readBrowserProjects(workspaceId: string): Project[] | null {
  return normalizeProjects(workspaceId, readJson<Project[]>(PROJECTS_KEY))
}

export function writeBrowserProjects(projects: Project[]): void {
  writeJson(PROJECTS_KEY, projects)
}

export function getDefaultBrowserProjects(workspaceId: string): Project[] {
  return [createDefaultProject(workspaceId)]
}

export function readBrowserPromptLibrary(): PromptLibraryItem[] | null {
  return readJson<PromptLibraryItem[]>(PROMPTS_KEY)
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
