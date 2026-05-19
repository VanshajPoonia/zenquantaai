'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  APISettings,
  AIMode,
  AppSettings,
  AppSettingsPatch,
  Attachment,
  AuthState,
  Chat,
  ChatAction,
  ChatResponse,
  ChatRequest,
  Conversation,
  ConversationSummary,
  ImageGenerateRequest,
  ImageGenerateResponse,
  PendingAttachment,
  Project,
  PromptLibraryItem,
  SendLifecycleStatus,
  SessionSettings,
  StreamEvent,
  StreamingState,
} from '@/types'
import {
  createSessionSettings,
  DEFAULT_APP_SETTINGS,
  DEFAULT_PROJECT_ID,
  PROJECT_COLOR_OPTIONS,
  resolveModelConfig,
} from '@/lib/config'
import {
  hasLocalImportMarker,
  readBrowserAppSettings,
  readBrowserConversations,
  readBrowserCurrentChatId,
  readBrowserProjects,
  readBrowserPromptLibrary,
  readBrowserSelectedProjectId,
  readBrowserSidebarWidth,
  writeBrowserCurrentChatId,
  writeBrowserSelectedProjectId,
  writeBrowserSidebarWidth,
  writeLocalImportMarker,
} from '@/lib/storage/browser'
import {
  createConversation,
  createMessage,
  getLastAssistantMessage,
  getLastUserMessage,
  sortConversationSummaries,
  updateConversationSnapshot,
  toConversationSummary,
} from '@/lib/utils/chat'
import { readNdjsonStream } from '@/lib/utils/stream'
import {
  createAssistantPlaceholder,
  createPendingSend,
  debugSendPipeline,
  resolveSend,
} from '@/lib/chat/sendMessage'
import { useSendMessage } from '@/hooks/useSendMessage'
import {
  conversationToJson,
  conversationToMarkdown,
  downloadTextFile,
} from '@/lib/utils/export'
import { serializeAttachment, toAttachmentContext } from '@/lib/utils/files'

interface SendMessageInput {
  content: string
  attachments?: Array<Attachment | PendingAttachment>
  kind?: 'chat' | 'image'
  modeOverride?: AIMode
}

interface QueuedPrompt {
  id: string
  input: SendMessageInput
  mode: AIMode
  settings: SessionSettings
  projectId: string
  conversationId?: string
}

type ProjectFilterId = 'all' | string

interface SavePromptInput {
  title: string
  content: string
  mode: AIMode | 'any'
}

interface AuthSessionResponse {
  authenticated: boolean
  user: AuthState['user']
}

interface ChatContextType {
  authState: AuthState
  authError: string | null
  requestMagicLink: (email: string) => Promise<void>
  requestPasswordSignIn: (email: string, password: string) => Promise<void>
  requestPasswordSignUp: (email: string, password: string) => Promise<string>
  requestPasswordReset: (email: string) => Promise<string>
  signOut: () => Promise<void>
  currentMode: AIMode
  setCurrentMode: (mode: AIMode) => void
  conversations: Conversation[]
  chats: ConversationSummary[]
  currentChat: Chat | null
  setCurrentChat: (chat: ConversationSummary | Conversation | null) => void
  goHome: () => void
  createNewChat: () => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  togglePinChat: (chatId: string) => Promise<void>
  queuedPromptCount: number
  sendMessage: (input: SendMessageInput) => Promise<void>
  regenerateLastResponse: () => Promise<void>
  retryLastMessage: () => Promise<void>
  editLastUserMessage: (content: string, targetMessageId?: string) => Promise<void>
  askAnotherMode: (mode: AIMode) => Promise<void>
  exportCurrentChat: (format: 'markdown' | 'json') => void
  isStreaming: boolean
  stopStreaming: () => void
  streamingState: StreamingState
  sessionSettings: SessionSettings
  updateSessionSettings: (settings: Partial<SessionSettings>) => void
  appSettings: AppSettings
  saveAppSettings: (settings: AppSettingsPatch) => Promise<AppSettings>
  apiSettings: APISettings
  updateApiSettings: (settings: Partial<APISettings>) => Promise<void>
  isSidebarOpen: boolean
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  toggleSidebar: () => void
  isSettingsPanelOpen: boolean
  toggleSettingsPanel: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  statusLabel: 'Ready' | 'Streaming' | 'Idle'
  projects: Project[]
  selectedProjectId: ProjectFilterId
  setSelectedProjectId: (projectId: ProjectFilterId) => void
  createProject: (name: string) => Promise<Project | null>
  moveChatToProject: (chatId: string, projectId: string) => Promise<void>
  moveCurrentChatToProject: (projectId: string) => Promise<void>
  promptLibrary: PromptLibraryItem[]
  savePrompt: (input: SavePromptInput) => Promise<PromptLibraryItem | null>
  deletePrompt: (promptId: string) => Promise<void>
  beginPromptPrecheck: () => void
  awaitRecommendationDecision: () => void
  clearPromptPrecheck: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)
const MIN_SIDEBAR_WIDTH = 280
const MAX_SIDEBAR_WIDTH = 440

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

function normalizeModeSessionSettings(
  mode: AIMode,
  settings: SessionSettings
): SessionSettings {
  return createSessionSettings(mode, settings)
}

function normalizeAppSettingsState(input: AppSettings): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...input,
    assistantRecommendations: {
      ...DEFAULT_APP_SETTINGS.assistantRecommendations,
      ...input.assistantRecommendations,
    },
    sessionDefaults: createSessionSettings(input.defaultMode, input.sessionDefaults),
  }
}

function sortConversationList(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })
}

function sortPrompts(prompts: PromptLibraryItem[]): PromptLibraryItem[] {
  return [...prompts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

function isPendingAttachment(
  attachment: Attachment | PendingAttachment
): attachment is PendingAttachment {
  return 'file' in attachment
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    status: 'loading',
    user: null,
  })
  const [authError, setAuthError] = useState<string | null>(null)
  const [currentMode, setCurrentModeState] = useState<AIMode>(
    DEFAULT_APP_SETTINGS.defaultMode
  )
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentChat, setCurrentChatState] = useState<Conversation | null>(null)
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [draftSessionSettings, setDraftSessionSettings] = useState<SessionSettings>(
    DEFAULT_APP_SETTINGS.sessionDefaults
  )
  const [sendLifecycleStatus, setSendLifecycleStatus] =
    useState<SendLifecycleStatus>('idle')
  const [streamingState, setStreamingState] = useState<StreamingState>({
    status: 'idle',
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidthState] = useState<number>(() =>
    clampSidebarWidth(readBrowserSidebarWidth() ?? 288)
  )
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectIdState, setSelectedProjectIdState] =
    useState<ProjectFilterId>('all')
  const [promptLibrary, setPromptLibrary] = useState<PromptLibraryItem[]>([])
  const [queuedPrompts, setQueuedPrompts] = useState<QueuedPrompt[]>([])
  const streamAbortRef = useRef<AbortController | null>(null)
  const activeSendIdRef = useRef<string | null>(null)
  const conversationsRef = useRef<Conversation[]>([])
  const currentChatRef = useRef<Conversation | null>(null)
  const queuedPromptsRef = useRef<QueuedPrompt[]>([])
  const isProcessingQueueRef = useRef(false)

  const chats = useMemo(
    () => sortConversationSummaries(conversations.map(toConversationSummary)),
    [conversations]
  )

  const isStreaming =
    streamingState.status === 'streaming' ||
    sendLifecycleStatus === 'dispatching_text' ||
    sendLifecycleStatus === 'dispatching_image' ||
    sendLifecycleStatus === 'streaming_text'

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useEffect(() => {
    currentChatRef.current = currentChat
  }, [currentChat])

  useEffect(() => {
    queuedPromptsRef.current = queuedPrompts
  }, [queuedPrompts])

  const sessionSettings = normalizeModeSessionSettings(
    currentMode,
    currentChat?.sessionSettings ?? draftSessionSettings
  )

  const statusLabel: 'Ready' | 'Streaming' | 'Idle' = isStreaming
    ? 'Streaming'
    : currentChat
      ? 'Ready'
      : 'Idle'

  const selectedProjectId =
    selectedProjectIdState !== 'all' &&
    !projects.some((project) => project.id === selectedProjectIdState)
      ? 'all'
      : selectedProjectIdState

  const clearAuthedState = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    activeSendIdRef.current = null
    setSendLifecycleStatus('idle')
    setStreamingState({ status: 'idle' })
    setConversations([])
    setCurrentChatState(null)
    setProjects([])
    setPromptLibrary([])
    setQueuedPrompts([])
    setCurrentModeState(DEFAULT_APP_SETTINGS.defaultMode)
    setAppSettings(DEFAULT_APP_SETTINGS)
    setDraftSessionSettings(DEFAULT_APP_SETTINGS.sessionDefaults)
    setSelectedProjectIdState('all')
    writeBrowserCurrentChatId(null)
  }, [])

  const handleUnauthorized = useCallback((message?: string) => {
    clearAuthedState()
    setAuthState({
      status: 'unauthenticated',
      user: null,
    })
    setAuthError(message ?? 'Please sign in again to continue.')
  }, [clearAuthedState])

  const requestJson = useCallback(
    async <T,>(input: string, init: RequestInit = {}): Promise<T> => {
      const response = await fetch(input, {
        ...init,
        headers: {
          ...(init.body instanceof FormData
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...(init.headers ?? {}),
        },
        cache: 'no-store',
      })

      if (response.status === 401) {
        handleUnauthorized()
        throw new Error('Authentication required.')
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(
          (payload as { error?: string } | null)?.error ??
            'Request failed. Please try again.'
        )
      }

      if (response.status === 204) {
        return undefined as T
      }

      return (await response.json()) as T
    },
    [handleUnauthorized]
  )

  const commitState = useCallback(
    (nextConversations: Conversation[], nextCurrentChat: Conversation | null) => {
      const sorted = sortConversationList(nextConversations)
      conversationsRef.current = sorted
      currentChatRef.current = nextCurrentChat
      setConversations(sorted)
      setCurrentChatState(nextCurrentChat)
      writeBrowserCurrentChatId(nextCurrentChat?.id ?? null)

      if (nextCurrentChat) {
        setCurrentModeState(nextCurrentChat.mode)
      }
    },
    []
  )

  const upsertConversation = useCallback(
    (conversation: Conversation, makeCurrent = true) => {
      const nextConversation = updateConversationSnapshot(conversation, {
        projectId: conversation.projectId ?? DEFAULT_PROJECT_ID,
      })
      const nextConversations = [
        nextConversation,
        ...conversationsRef.current.filter((item) => item.id !== conversation.id),
      ]

      commitState(
        nextConversations,
        makeCurrent ? nextConversation : currentChatRef.current
      )
    },
    [commitState]
  )

  const applyConversationPatch = useCallback(
    (
      conversationId: string,
      updater: (conversation: Conversation) => Conversation
    ): Conversation | null => {
      let updatedConversation: Conversation | null = null

      const nextConversations = conversationsRef.current.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation
        }

        updatedConversation = updater(conversation)
        return updatedConversation
      })

      if (!updatedConversation) return null

      commitState(
        nextConversations,
        currentChatRef.current?.id === conversationId
          ? updatedConversation
          : currentChatRef.current
      )

      return updatedConversation
    },
    [commitState]
  )

  const persistConversationMutation = useCallback(
    async (conversationId: string, mutation: {
      title?: string
      mode?: AIMode
      projectId?: string
      isPinned?: boolean
      sessionSettings?: SessionSettings
    }) => {
      const conversation = await requestJson<Conversation>(
        `/api/conversations/${conversationId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(mutation),
        }
      )
      upsertConversation(conversation)
      return conversation
    },
    [requestJson, upsertConversation]
  )

  const setSelectedProjectId = useCallback((projectId: ProjectFilterId) => {
    setSelectedProjectIdState(projectId)
    writeBrowserSelectedProjectId(projectId === 'all' ? null : projectId)
  }, [])

  const setSidebarWidth = useCallback((width: number) => {
    const nextWidth = clampSidebarWidth(width)
    setSidebarWidthState(nextWidth)
    writeBrowserSidebarWidth(nextWidth)
  }, [])

  const runLocalImport = useCallback(
    async (userId: string) => {
      if (hasLocalImportMarker(userId)) return

      const localConversations = (readBrowserConversations() ?? []).filter(
        (conversation) => {
          const hasMeaningfulMessage = conversation.messages.some((message) => {
            if (message.role === 'system') return false
            return message.content.trim().length > 0
          })

          const hasAttachment = (conversation.attachments ?? []).length > 0

          return hasMeaningfulMessage || hasAttachment
        }
      )
      const localProjects = readBrowserProjects() ?? []
      const localPrompts = readBrowserPromptLibrary() ?? []
      const localSettings = readBrowserAppSettings()

      const hasImportableData =
        localConversations.length > 0 ||
        localProjects.some((project) => project.id !== DEFAULT_PROJECT_ID) ||
        localPrompts.length > 0 ||
        Boolean(localSettings)

      if (hasImportableData) {
        await requestJson('/api/bootstrap/import-local', {
          method: 'POST',
          body: JSON.stringify({
            conversations: localConversations,
            projects: localProjects,
            prompts: localPrompts,
            settings: localSettings,
          }),
        })
      }

      writeLocalImportMarker(userId)
    },
    [requestJson]
  )

  const loadAuthedData = useCallback(
    async (user: NonNullable<AuthState['user']>) => {
      await runLocalImport(user.id)

      const [settings, nextProjects, nextPrompts, nextConversations] =
        await Promise.all([
          requestJson<AppSettings>('/api/settings'),
          requestJson<Project[]>('/api/projects'),
          requestJson<PromptLibraryItem[]>('/api/prompts'),
          requestJson<Conversation[]>('/api/conversations'),
        ])

      const normalizedSettings = normalizeAppSettingsState(settings)
      const normalizedProjects = sortProjects(nextProjects)
      const normalizedPrompts = sortPrompts(nextPrompts)
      const normalizedConversations = sortConversationList(nextConversations)
      const currentChatId = readBrowserCurrentChatId()
      const activeConversation =
        normalizedConversations.find(
          (conversation) => conversation.id === currentChatId
        ) ?? null
      const storedProjectId = readBrowserSelectedProjectId()

      setAppSettings(normalizedSettings)
      setProjects(normalizedProjects)
      setPromptLibrary(normalizedPrompts)
      setSelectedProjectIdState(
        storedProjectId &&
          normalizedProjects.some((project) => project.id === storedProjectId)
          ? storedProjectId
          : 'all'
      )
      commitState(normalizedConversations, activeConversation)
      setCurrentModeState(activeConversation?.mode ?? normalizedSettings.defaultMode)
      setDraftSessionSettings(
        createSessionSettings(
          normalizedSettings.defaultMode,
          normalizedSettings.sessionDefaults
        )
      )
    },
    [commitState, requestJson, runLocalImport]
  )

  const restoreSession = useCallback(async () => {
    try {
      const session = await requestJson<AuthSessionResponse>('/api/auth/session')

      if (!session.authenticated || !session.user) {
        handleUnauthorized()
        return
      }

      setAuthState({
        status: 'authenticated',
        user: session.user,
      })
      setAuthError(null)
      await loadAuthedData(session.user)
    } catch (error) {
      const searchParams =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null
      const authParam = searchParams?.get('auth')
      const nextError =
        authParam === 'failed'
          ? 'That magic link could not be verified. Please request a new one.'
          : authParam === 'missing-token'
            ? 'The sign-in link was incomplete. Please request a new one.'
            : error instanceof Error
              ? error.message
              : 'Please sign in to continue.'

      handleUnauthorized(nextError)
    }
  }, [handleUnauthorized, loadAuthedData, requestJson])

  const refreshAuthSessionRole = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        cache: 'no-store',
      })

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        return
      }

      const session = (await response.json()) as AuthSessionResponse

      if (!session.authenticated || !session.user) {
        return
      }

      const nextUser = session.user

      setAuthState((previous) => {
        if (
          previous.status === 'authenticated' &&
          previous.user?.id === nextUser.id &&
          previous.user?.role === nextUser.role &&
          previous.user?.loginId === nextUser.loginId &&
          previous.user?.email === nextUser.email
        ) {
          return previous
        }

        return {
          status: 'authenticated',
          user: nextUser,
        }
      })
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[zenquanta/auth] session refresh skipped', {
          error: error instanceof Error ? error.message : 'Unknown session refresh error',
        })
      }
    }
  }, [handleUnauthorized])

  useEffect(() => {
    void restoreSession()

    return () => {
      streamAbortRef.current?.abort()
    }
  }, [restoreSession])

  useEffect(() => {
    if (authState.status !== 'authenticated') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshAuthSessionRole()
      }
    }

    const handleWindowFocus = () => {
      void refreshAuthSessionRole()
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [authState.status, refreshAuthSessionRole])

  const requestMagicLink = useCallback(
    async (email: string) => {
      await requestJson('/api/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setAuthError(null)
    },
    [requestJson]
  )

  const requestPasswordSignIn = useCallback(
    async (identifier: string, password: string) => {
      await requestJson('/api/auth/password/sign-in', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      })
      setAuthError(null)
      await restoreSession()
    },
    [requestJson, restoreSession]
  )

  const requestPasswordSignUp = useCallback(
    async (identifier: string, password: string) => {
      const response = await requestJson<{ message?: string }>(
        '/api/auth/password/sign-up',
        {
          method: 'POST',
          body: JSON.stringify({ identifier, password }),
        }
      )

      setAuthError(null)
      await restoreSession()

      return response.message ?? 'Account created. You are now signed in.'
    },
    [requestJson, restoreSession]
  )

  const requestPasswordReset = useCallback(
    async (email: string) => {
      const response = await requestJson<{ message?: string }>(
        '/api/auth/password/reset-request',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      )

      setAuthError(null)

      return response.message ?? 'Check your inbox for the password reset link.'
    },
    [requestJson]
  )

  const signOut = useCallback(async () => {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      cache: 'no-store',
    }).catch(() => undefined)

    clearAuthedState()
    setAuthState({
      status: 'unauthenticated',
      user: null,
    })
    setAuthError(null)
  }, [clearAuthedState])

  const setCurrentChat = useCallback(
    (chat: ConversationSummary | Conversation | null) => {
      if (!chat) {
        setCurrentChatState(null)
        writeBrowserCurrentChatId(null)
        return
      }

      const nextConversation =
        conversations.find((conversation) => conversation.id === chat.id) ?? null

      if (!nextConversation) return

      setCurrentModeState(nextConversation.mode)
      setCurrentChatState(nextConversation)
      writeBrowserCurrentChatId(nextConversation.id)
    },
    [conversations]
  )

  const setCurrentMode = useCallback(
    (mode: AIMode) => {
      setCurrentModeState(mode)

      if (!currentChat) {
        setDraftSessionSettings((previous) => createSessionSettings(mode, previous))
        return
      }

      applyConversationPatch(currentChat.id, (conversation) =>
        updateConversationSnapshot(conversation, {
          mode,
          sessionSettings: createSessionSettings(mode, conversation.sessionSettings),
        })
      )

      void persistConversationMutation(currentChat.id, {
        mode,
        sessionSettings: createSessionSettings(mode, currentChat.sessionSettings),
      }).catch((error) => {
        console.error('Failed to update conversation mode.', error)
      })
    },
    [applyConversationPatch, currentChat, persistConversationMutation]
  )

  const goHome = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    activeSendIdRef.current = null
    setSendLifecycleStatus('idle')
    setStreamingState({ status: 'idle' })
    setSearchQuery('')
    setCurrentChatState(null)
    currentChatRef.current = null
    writeBrowserCurrentChatId(null)
    setCurrentModeState(appSettings.defaultMode)
    setDraftSessionSettings(
      createSessionSettings(appSettings.defaultMode, appSettings.sessionDefaults)
    )
  }, [appSettings])

  const createNewChat = useCallback(async () => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    activeSendIdRef.current = null
    setSendLifecycleStatus('idle')
    setStreamingState({ status: 'idle' })
    setSearchQuery('')
    setCurrentChatState(null)
    currentChatRef.current = null
    writeBrowserCurrentChatId(null)
    setDraftSessionSettings(createSessionSettings(currentMode, sessionSettings))
  }, [currentMode, sessionSettings])

  const deleteChat = useCallback(
    async (chatId: string) => {
      await requestJson(`/api/conversations/${chatId}`, {
        method: 'DELETE',
      })

      const nextConversations = conversations.filter(
        (conversation) => conversation.id !== chatId
      )

      commitState(
        nextConversations,
        currentChat?.id === chatId ? null : currentChat
      )
    },
    [commitState, conversations, currentChat, requestJson]
  )

  const togglePinChat = useCallback(
    async (chatId: string) => {
      const existing = conversationsRef.current.find(
        (conversation) => conversation.id === chatId
      )
      if (!existing) return

      const conversation = await persistConversationMutation(chatId, {
        isPinned: !existing.isPinned,
      })
      if (conversation) {
        upsertConversation(conversation, currentChatRef.current?.id === chatId)
      }
    },
    [persistConversationMutation, upsertConversation]
  )

  const saveAppSettings = useCallback(
    async (settings: AppSettingsPatch) => {
      const nextSettings = await requestJson<AppSettings>('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

      const normalized = normalizeAppSettingsState(nextSettings)
      setAppSettings(normalized)

      if (!currentChat) {
        setCurrentModeState(normalized.defaultMode)
        setDraftSessionSettings(
          createSessionSettings(normalized.defaultMode, normalized.sessionDefaults)
        )
      }

      return normalized
    },
    [currentChat, requestJson]
  )

  const updateApiSettings = useCallback(
    async (settings: Partial<APISettings>) => {
      await saveAppSettings({
        gatewayDrafts: settings,
      })
    },
    [saveAppSettings]
  )

  const createProject = useCallback(
    async (name: string) => {
      const trimmedName = name.trim()
      if (!trimmedName) return null

      const color =
        PROJECT_COLOR_OPTIONS[
          Math.min(projects.length, PROJECT_COLOR_OPTIONS.length - 1)
        ]

      try {
        const project = await requestJson<Project>('/api/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: trimmedName,
            color,
          }),
        })

        const nextProjects = sortProjects([...projects, project])
        setProjects(nextProjects)
        setSelectedProjectId(project.id)
        return project
      } catch (error) {
        console.error('Failed to create project.', error)
        return null
      }
    },
    [projects, requestJson, setSelectedProjectId]
  )

  const moveCurrentChatToProject = useCallback(
    async (projectId: string) => {
      if (!currentChat) return

      applyConversationPatch(currentChat.id, (conversation) =>
        updateConversationSnapshot(conversation, {
          projectId,
        })
      )

      void persistConversationMutation(currentChat.id, {
        projectId,
      }).catch((error) => {
        console.error('Failed to move chat to project.', error)
      })
    },
    [applyConversationPatch, currentChat, persistConversationMutation]
  )

  const moveChatToProject = useCallback(
    async (chatId: string, projectId: string) => {
      applyConversationPatch(chatId, (conversation) =>
        updateConversationSnapshot(conversation, {
          projectId,
        })
      )

      void persistConversationMutation(chatId, {
        projectId,
      }).catch((error) => {
        console.error('Failed to move chat to project.', error)
      })
    },
    [applyConversationPatch, persistConversationMutation]
  )

  const enqueuePrompt = useCallback((prompt: QueuedPrompt) => {
    setQueuedPrompts((previous) => [...previous, prompt])
  }, [])

  const savePrompt = useCallback(
    async ({ title, content, mode }: SavePromptInput) => {
      const trimmedTitle = title.trim()
      const trimmedContent = content.trim()

      if (!trimmedTitle || !trimmedContent) {
        return null
      }

      try {
        const prompt = await requestJson<PromptLibraryItem>('/api/prompts', {
          method: 'POST',
          body: JSON.stringify({
            title: trimmedTitle,
            content: trimmedContent,
            mode,
          }),
        })

        const nextPrompts = sortPrompts([
          prompt,
          ...promptLibrary.filter((item) => item.id !== prompt.id),
        ])
        setPromptLibrary(nextPrompts)
        return prompt
      } catch (error) {
        console.error('Failed to save prompt.', error)
        return null
      }
    },
    [promptLibrary, requestJson]
  )

  const deletePrompt = useCallback(
    async (promptId: string) => {
      try {
        await requestJson(`/api/prompts/${promptId}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Failed to delete prompt.', error)
      }

      const nextPrompts = promptLibrary.filter((prompt) => prompt.id !== promptId)
      setPromptLibrary(nextPrompts)
    },
    [promptLibrary, requestJson]
  )

  const applyLocalError = useCallback(
    (conversationId: string | undefined, messageId: string | undefined, error: string) => {
      if (!conversationId || !messageId) return

      applyConversationPatch(conversationId, (conversation) =>
        updateConversationSnapshot(conversation, {
          messages: conversation.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  status: 'error',
                  error,
                  content: message.content || error,
                }
              : message
          ),
        })
      )
    },
    [applyConversationPatch]
  )

  const markSendAsSuperseded = useCallback(
    (conversationId: string | undefined, messageId: string | undefined) => {
      if (!conversationId || !messageId) return

      debugSendPipeline('stale-response-ignored', {
        conversationId,
        messageId,
      })
      applyLocalError(
        conversationId,
        messageId,
        'This response was superseded by a newer request.'
      )
    },
    [applyLocalError]
  )

  const finalizeSendLifecycle = useCallback(
    (sendId?: string, nextStatus: SendLifecycleStatus = 'idle') => {
      if (sendId && activeSendIdRef.current !== sendId) {
        return
      }

      activeSendIdRef.current = null
      setSendLifecycleStatus(nextStatus)
    },
    []
  )

  const beginPromptPrecheck = useCallback(() => {
    setSendLifecycleStatus((current) =>
      current === 'idle' ? 'prechecking' : current
    )
  }, [])

  const awaitRecommendationDecision = useCallback(() => {
    setSendLifecycleStatus((current) =>
      current === 'prechecking' || current === 'idle'
        ? 'awaiting_recommendation'
        : current
    )
  }, [])

  const clearPromptPrecheck = useCallback(() => {
    setSendLifecycleStatus((current) =>
      current === 'prechecking' || current === 'awaiting_recommendation'
        ? 'idle'
        : current
    )
  }, [])

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    activeSendIdRef.current = null
    setSendLifecycleStatus('idle')
    setStreamingState({ status: 'idle' })
  }, [])

  const ensureConversationForMessage = useCallback(
    async (options: {
      conversationId?: string
      mode: AIMode
      settings: SessionSettings
      projectId: string
    }) => {
      if (options.conversationId) {
        const existing =
          conversationsRef.current.find(
            (conversation) => conversation.id === options.conversationId
          ) ?? null

        if (existing) {
          return existing
        }
      }

      if (
        currentChatRef.current &&
        (!options.conversationId || currentChatRef.current.id === options.conversationId)
      ) {
        return currentChatRef.current
      }

      const conversation = createConversation({
        id: options.conversationId,
        mode: options.mode,
        projectId: options.projectId,
        sessionSettings: options.settings,
      })

      upsertConversation(conversation)
      return conversation
    },
    [upsertConversation]
  )

  const uploadAttachments = useCallback(
    async (
      attachments: Array<Attachment | PendingAttachment>
    ): Promise<Attachment[]> => {
      const existing = attachments.filter(
        (attachment): attachment is Attachment => !isPendingAttachment(attachment)
      )
      const pending = attachments.filter(isPendingAttachment)

      if (pending.length === 0) {
        return existing
      }

      const formData = new FormData()
      formData.append(
        'metadata',
        JSON.stringify(pending.map((attachment) => serializeAttachment(attachment)))
      )
      pending.forEach((attachment) => {
        formData.append('files', attachment.file, attachment.name)
      })

      const response = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      })

      if (response.status === 401) {
        handleUnauthorized()
        throw new Error('Authentication required.')
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error ?? 'Unable to upload attachments.')
      }

      const uploaded = (await response.json()) as Attachment[]

      return [
        ...existing,
        ...uploaded.map((attachment, index) => ({
          ...attachment,
          previewUrl: pending[index]?.previewUrl ?? attachment.previewUrl,
          textContent: pending[index]?.textContent ?? attachment.textContent,
          textExcerpt: pending[index]?.textExcerpt ?? attachment.textExcerpt,
          isExtracted: pending[index]?.isExtracted ?? attachment.isExtracted,
        })),
      ]
    },
    [handleUnauthorized]
  )

  const runTextAction = useCallback(
    async (payload: {
      action: ChatAction
      content?: string
      targetMessageId?: string
      targetMode?: AIMode
      mode: AIMode
      settings: SessionSettings
      conversation: Conversation
      optimisticConversation: Conversation
      attachments?: Attachment[]
      sendId?: string
    }) => {
      if (
        payload.action === 'generate-image' ||
        payload.mode === 'image' ||
        payload.targetMode === 'image'
      ) {
        throw new Error('Image requests must use the dedicated image route.')
      }

      debugSendPipeline('request-start', {
        action: payload.action,
        assistant: payload.targetMode ?? payload.mode,
        route: '/api/chat',
        sendId: payload.sendId,
      })

      upsertConversation(payload.optimisticConversation)

      const placeholder = payload.optimisticConversation.messages.at(-1)

      setSendLifecycleStatus('dispatching_text')
      setStreamingState({
        status: 'streaming',
        conversationId: payload.optimisticConversation.id,
        messageId: placeholder?.id,
        workingTitle: 'Working notes',
        workingNotes: [],
      })

      const controller = new AbortController()
      streamAbortRef.current = controller
      let terminalEvent: 'done' | 'error' | null = null

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: payload.action,
            conversationId: payload.conversation.id,
            conversation: payload.conversation,
            mode: payload.mode,
            targetMode: payload.targetMode,
            content: payload.content,
            settings: payload.settings,
            targetMessageId: payload.targetMessageId,
            attachments: payload.attachments,
            attachmentContext: (payload.attachments ?? []).map(toAttachmentContext),
          } satisfies ChatRequest),
          signal: controller.signal,
        })

        if (response.status === 401) {
          handleUnauthorized()
          throw new Error('Authentication required.')
        }

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null
          debugSendPipeline('request-failure', {
            action: payload.action,
            route: '/api/chat',
            error: body?.error ?? 'Unable to send chat request.',
            sendId: payload.sendId,
          })
          throw new Error(body?.error ?? 'Unable to send chat request.')
        }

        setSendLifecycleStatus('streaming_text')

        await readNdjsonStream<StreamEvent>(response, (event) => {
          if (payload.sendId && activeSendIdRef.current !== payload.sendId) {
            return
          }

          switch (event.type) {
            case 'start': {
              const startedConversation = updateConversationSnapshot(
                event.conversation,
                {
                  messages: [...event.conversation.messages, event.message],
                }
              )

              upsertConversation(startedConversation)
              setStreamingState({
                status: 'streaming',
                conversationId: startedConversation.id,
                messageId: event.message.id,
                workingTitle: 'Working notes',
                workingNotes: [],
              })
              break
            }
            case 'delta': {
              applyConversationPatch(event.conversationId, (conversation) =>
                updateConversationSnapshot(conversation, {
                  messages: conversation.messages.map((message) =>
                    message.id === event.messageId
                      ? {
                          ...message,
                          content: `${message.content}${event.delta}`,
                          status: 'streaming',
                        }
                      : message
                  ),
                })
              )
              break
            }
            case 'working': {
              setStreamingState((previous) => ({
                ...previous,
                status: 'streaming',
                conversationId: event.conversationId,
                messageId: event.messageId,
                workingTitle: event.title ?? previous.workingTitle ?? 'Working notes',
                workingNotes: event.notes,
              }))
              break
            }
            case 'done': {
              terminalEvent = 'done'
              upsertConversation(event.conversation)
              setStreamingState({ status: 'idle' })
              break
            }
            case 'error': {
              terminalEvent = 'error'
              applyLocalError(event.conversationId, event.messageId, event.error)
              setStreamingState({
                status: 'error',
                conversationId: event.conversationId,
                messageId: event.messageId,
                error: event.error,
              })
              break
            }
          }
        })

        if (payload.sendId && activeSendIdRef.current !== payload.sendId) {
          markSendAsSuperseded(
            payload.optimisticConversation.id,
            payload.optimisticConversation.messages.at(-1)?.id
          )
          return
        }

        if (terminalEvent === 'error') {
          finalizeSendLifecycle(payload.sendId, 'failed')
          return
        }

        if (terminalEvent !== 'done') {
          throw new Error('The response ended before completion.')
        }

        debugSendPipeline('request-success', {
          action: payload.action,
          route: '/api/chat',
          sendId: payload.sendId,
        })
        setStreamingState({ status: 'idle' })
        finalizeSendLifecycle(payload.sendId)
      } catch (error) {
        const lastMessageId = payload.optimisticConversation.messages.at(-1)?.id

        if (error instanceof DOMException && error.name === 'AbortError') {
          debugSendPipeline('request-cancelled', {
            action: payload.action,
            route: '/api/chat',
            sendId: payload.sendId,
          })
          applyLocalError(payload.optimisticConversation.id, lastMessageId, 'Generation stopped.')
          setStreamingState({ status: 'idle' })
          finalizeSendLifecycle(payload.sendId)
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong while generating a response.'

        debugSendPipeline('request-failure', {
          action: payload.action,
          route: '/api/chat',
          error: message,
          sendId: payload.sendId,
        })
        applyLocalError(payload.optimisticConversation.id, lastMessageId, message)
        setStreamingState({
          status: 'error',
          conversationId: payload.optimisticConversation.id,
          messageId: lastMessageId,
          error: message,
        })
        finalizeSendLifecycle(payload.sendId, 'failed')
      } finally {
        streamAbortRef.current = null
      }
    },
    [
      applyConversationPatch,
      applyLocalError,
      finalizeSendLifecycle,
      handleUnauthorized,
      markSendAsSuperseded,
      upsertConversation,
    ]
  )

  const runImageAction = useCallback(
    async (payload: {
      action: Exclude<ChatAction, 'generate-image'>
      content?: string
      targetMessageId?: string
      targetMode?: AIMode
      mode: AIMode
      settings: SessionSettings
      conversation: Conversation
      optimisticConversation: Conversation
      attachments?: Attachment[]
      sendId?: string
    }) => {
      debugSendPipeline('request-start', {
        action: payload.action,
        assistant: payload.targetMode ?? payload.mode,
        route: '/api/images/generate',
        sendId: payload.sendId,
      })

      upsertConversation(payload.optimisticConversation)

      const placeholder = payload.optimisticConversation.messages.at(-1)
      setSendLifecycleStatus('dispatching_image')
      setStreamingState({
        status: 'streaming',
        conversationId: payload.optimisticConversation.id,
        messageId: placeholder?.id,
        workingTitle: 'Generating image',
        workingNotes: [],
      })

      const controller = new AbortController()
      streamAbortRef.current = controller

      try {
        const response = await fetch('/api/images/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: payload.action,
            conversationId: payload.conversation.id,
            conversation: payload.conversation,
            mode: payload.mode,
            targetMode: payload.targetMode,
            prompt: payload.content,
            content: payload.content,
            settings: payload.settings,
            targetMessageId: payload.targetMessageId,
            attachments: payload.attachments,
            imageCount: 1,
          } satisfies ImageGenerateRequest),
          signal: controller.signal,
        })

        if (response.status === 401) {
          handleUnauthorized()
          throw new Error('Authentication required.')
        }

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null
          debugSendPipeline('request-failure', {
            action: payload.action,
            route: '/api/images/generate',
            error: body?.error ?? 'Unable to generate image.',
            sendId: payload.sendId,
          })
          throw new Error(body?.error ?? 'Unable to generate image.')
        }

        const data = (await response.json()) as ImageGenerateResponse

        if (!data?.conversation || !data?.message) {
          throw new Error('Image response was incomplete.')
        }

        if (payload.sendId && activeSendIdRef.current !== payload.sendId) {
          markSendAsSuperseded(
            payload.optimisticConversation.id,
            payload.optimisticConversation.messages.at(-1)?.id
          )
          return
        }

        debugSendPipeline('response-parsed', {
          action: payload.action,
          route: '/api/images/generate',
          conversationId: data.conversation.id,
          messageId: data.message.id,
          sendId: payload.sendId,
        })

        upsertConversation(data.conversation)
        setStreamingState({ status: 'idle' })
        finalizeSendLifecycle(payload.sendId)
      } catch (error) {
        const lastMessageId = payload.optimisticConversation.messages.at(-1)?.id

        if (error instanceof DOMException && error.name === 'AbortError') {
          debugSendPipeline('request-cancelled', {
            action: payload.action,
            route: '/api/images/generate',
            sendId: payload.sendId,
          })
          applyLocalError(
            payload.optimisticConversation.id,
            lastMessageId,
            'Image generation stopped.'
          )
          setStreamingState({ status: 'idle' })
          finalizeSendLifecycle(payload.sendId)
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong while generating the image.'

        debugSendPipeline('request-failure', {
          action: payload.action,
          route: '/api/images/generate',
          error: message,
          sendId: payload.sendId,
        })
        applyLocalError(payload.optimisticConversation.id, lastMessageId, message)
        setStreamingState({
          status: 'error',
          conversationId: payload.optimisticConversation.id,
          messageId: lastMessageId,
          error: message,
        })
        finalizeSendLifecycle(payload.sendId, 'failed')
      } finally {
        streamAbortRef.current = null
      }
    },
    [
      applyLocalError,
      finalizeSendLifecycle,
      handleUnauthorized,
      markSendAsSuperseded,
      upsertConversation,
    ]
  )

  const executeSendMessage = useCallback(
    async (
      { content, attachments = [], kind = 'chat' }: SendMessageInput,
      options: {
        conversationId?: string
        mode: AIMode
        settings: SessionSettings
        projectId: string
      }
    ) => {
      const pendingSend = createPendingSend({
        content,
        attachments,
        kind,
        originalMode: options.mode,
        resolvedMode: options.mode,
        conversationId: options.conversationId,
        projectId: options.projectId,
        settings: options.settings,
      })
      const resolvedSend = resolveSend(pendingSend)

      activeSendIdRef.current = resolvedSend.sendId
      setSendLifecycleStatus(
        resolvedSend.transport === 'image' ? 'dispatching_image' : 'dispatching_text'
      )

      debugSendPipeline('resolved-send', {
        sendId: resolvedSend.sendId,
        mode: resolvedSend.resolvedMode,
        transport: resolvedSend.transport,
      })
      let optimisticConversationId: string | undefined
      let placeholderId: string | undefined

      try {
        const conversation = await ensureConversationForMessage({
          ...options,
          mode: resolvedSend.resolvedMode,
        })
        const userMessage = createMessage({
          role: 'user',
          content,
          mode: resolvedSend.resolvedMode,
          attachments,
        })
        const placeholder = createAssistantPlaceholder({
          mode: resolvedSend.resolvedMode,
          settings: options.settings,
          parentUserMessageId: userMessage.id,
        })
        placeholderId = placeholder.id

        const optimisticConversation = updateConversationSnapshot(conversation, {
          mode: resolvedSend.resolvedMode,
          sessionSettings: options.settings,
          messages: [...conversation.messages, userMessage, placeholder],
        })
        optimisticConversationId = optimisticConversation.id

        upsertConversation(optimisticConversation)
        setStreamingState({
          status: 'streaming',
          conversationId: optimisticConversation.id,
          messageId: placeholder.id,
        })

        const uploadedAttachments = await uploadAttachments(attachments)

        const preparedOptimisticConversation = updateConversationSnapshot(conversation, {
          mode: resolvedSend.resolvedMode,
          sessionSettings: options.settings,
          messages: [
            ...conversation.messages,
            {
              ...userMessage,
              attachments: uploadedAttachments,
            },
            placeholder,
          ],
        })

        if (resolvedSend.transport === 'image') {
          await runImageAction({
            action: 'send',
            content,
            mode: resolvedSend.resolvedMode,
            settings: options.settings,
            conversation,
            optimisticConversation: preparedOptimisticConversation,
            attachments: uploadedAttachments,
            sendId: resolvedSend.sendId,
          })
          return
        }

        await runTextAction({
          action: 'send',
          content,
          mode: resolvedSend.resolvedMode,
          settings: options.settings,
          conversation,
          optimisticConversation: preparedOptimisticConversation,
          attachments: uploadedAttachments,
          sendId: resolvedSend.sendId,
        })
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong while sending your message.'

        debugSendPipeline('execute-send-failure', {
          sendId: resolvedSend.sendId,
          mode: resolvedSend.resolvedMode,
          transport: resolvedSend.transport,
          error: message,
        })

        if (optimisticConversationId && placeholderId) {
          applyLocalError(optimisticConversationId, placeholderId, message)
          setStreamingState({
            status: 'error',
            conversationId: optimisticConversationId,
            messageId: placeholderId,
            error: message,
          })
        } else {
          setStreamingState({
            status: 'error',
            error: message,
          })
        }

        finalizeSendLifecycle(resolvedSend.sendId, 'failed')
        throw (error instanceof Error ? error : new Error(message))
      }
    },
    [
      applyLocalError,
      ensureConversationForMessage,
      finalizeSendLifecycle,
      runImageAction,
      runTextAction,
      uploadAttachments,
      upsertConversation,
    ]
  )

  const hasActiveSend = useCallback(
    () =>
      Boolean(
        activeSendIdRef.current ||
          streamAbortRef.current ||
          isProcessingQueueRef.current ||
          sendLifecycleStatus === 'dispatching_text' ||
          sendLifecycleStatus === 'dispatching_image' ||
          sendLifecycleStatus === 'streaming_text'
      ),
    [sendLifecycleStatus]
  )

  const { sendMessage } = useSendMessage({
    currentMode,
    currentChatId: currentChat?.id,
    currentChatSessionSettings: currentChat?.sessionSettings ?? null,
    draftSessionSettings,
    selectedProjectId,
    normalizeModeSessionSettings,
    hasActiveSend,
    enqueuePrompt,
    executeSendMessage,
  })

  const regenerateLastResponse = useCallback(async () => {
    if (!currentChat) return

    const trimmedMessages =
      currentChat.messages.at(-1)?.role === 'assistant'
        ? currentChat.messages.slice(0, -1)
        : currentChat.messages

    const lastUser = getLastUserMessage(currentChat)
    const placeholder = createMessage({
      role: 'assistant',
      content: '',
      mode: currentMode,
      status: 'streaming',
      model: resolveModelConfig(currentMode, sessionSettings.modelOverride).model,
      provider: 'openrouter',
      parentUserMessageId: lastUser?.id,
    })

    const optimisticConversation = updateConversationSnapshot(currentChat, {
      mode: currentMode,
      sessionSettings,
      messages: [...trimmedMessages, placeholder],
    })

    const sendId = createPendingSend({
      content: lastUser?.content ?? '',
      kind: currentMode === 'image' ? 'image' : 'chat',
      originalMode: currentMode,
      resolvedMode: currentMode,
      conversationId: currentChat.id,
      projectId: currentChat.projectId,
      settings: sessionSettings,
    }).sendId

    activeSendIdRef.current = sendId

    if (currentMode === 'image') {
      await runImageAction({
        action: 'regenerate',
        mode: currentMode,
        settings: sessionSettings,
        conversation: currentChat,
        optimisticConversation,
        sendId,
      })
      return
    }

    await runTextAction({
      action: 'regenerate',
      mode: currentMode,
      settings: sessionSettings,
      conversation: currentChat,
      optimisticConversation,
      sendId,
    })
  }, [currentChat, currentMode, runImageAction, runTextAction, sessionSettings])

  const retryLastMessage = useCallback(async () => {
    if (!currentChat) return

    const lastAssistant = getLastAssistantMessage(currentChat)
    const lastUser = getLastUserMessage(currentChat)
    const baseMessages =
      lastAssistant && currentChat.messages.at(-1)?.id === lastAssistant.id
        ? currentChat.messages.slice(0, -1)
        : currentChat.messages

    const placeholder = createMessage({
      role: 'assistant',
      content: '',
      mode: currentMode,
      status: 'streaming',
      model: resolveModelConfig(currentMode, sessionSettings.modelOverride).model,
      provider: 'openrouter',
      parentUserMessageId: lastUser?.id,
    })

    const optimisticConversation = updateConversationSnapshot(currentChat, {
      mode: currentMode,
      sessionSettings,
      messages: [...baseMessages, placeholder],
    })

    const sendId = createPendingSend({
      content: lastUser?.content ?? '',
      kind: currentMode === 'image' ? 'image' : 'chat',
      originalMode: currentMode,
      resolvedMode: currentMode,
      conversationId: currentChat.id,
      projectId: currentChat.projectId,
      settings: sessionSettings,
    }).sendId

    activeSendIdRef.current = sendId

    if (currentMode === 'image') {
      await runImageAction({
        action: 'retry',
        mode: currentMode,
        settings: sessionSettings,
        conversation: currentChat,
        optimisticConversation,
        sendId,
      })
      return
    }

    await runTextAction({
      action: 'retry',
      mode: currentMode,
      settings: sessionSettings,
      conversation: currentChat,
      optimisticConversation,
      sendId,
    })
  }, [currentChat, currentMode, runImageAction, runTextAction, sessionSettings])

  const editLastUserMessage = useCallback(
    async (content: string, targetMessageId?: string) => {
      if (!currentChat) return

      const lastUserIndex = currentChat.messages.findLastIndex(
        (message) => message.role === 'user'
      )

      if (lastUserIndex === -1) return

      const lastUser = currentChat.messages[lastUserIndex]
      if (targetMessageId && targetMessageId !== lastUser.id) {
        return
      }

      const editedUser = {
        ...lastUser,
        content,
        mode: currentMode,
      }

      const placeholder = createMessage({
        role: 'assistant',
        content: '',
        mode: currentMode,
        status: 'streaming',
        model: resolveModelConfig(currentMode, sessionSettings.modelOverride).model,
        provider: 'openrouter',
        parentUserMessageId: editedUser.id,
      })

      const optimisticConversation = updateConversationSnapshot(currentChat, {
        mode: currentMode,
        sessionSettings,
        messages: [
          ...currentChat.messages.slice(0, lastUserIndex),
          editedUser,
          placeholder,
        ],
      })

      const sendId = createPendingSend({
        content,
        attachments: editedUser.attachments,
        kind: currentMode === 'image' ? 'image' : 'chat',
        originalMode: currentMode,
        resolvedMode: currentMode,
        conversationId: currentChat.id,
        projectId: currentChat.projectId,
        settings: sessionSettings,
      }).sendId

      activeSendIdRef.current = sendId

      if (currentMode === 'image') {
        await runImageAction({
          action: 'edit-last-user',
          content,
          targetMessageId: lastUser.id,
          mode: currentMode,
          settings: sessionSettings,
          conversation: currentChat,
          optimisticConversation,
          attachments: editedUser.attachments,
          sendId,
        })
        return
      }

      await runTextAction({
        action: 'edit-last-user',
        content,
        targetMessageId: lastUser.id,
        mode: currentMode,
        settings: sessionSettings,
        conversation: currentChat,
        optimisticConversation,
        attachments: editedUser.attachments,
        sendId,
      })
    },
    [currentChat, currentMode, runImageAction, runTextAction, sessionSettings]
  )

  const askAnotherMode = useCallback(
    async (mode: AIMode) => {
      if (!currentChat) return

      const lastUser = getLastUserMessage(currentChat)
      if (!lastUser) return

      const placeholder = createMessage({
        role: 'assistant',
        content: '',
        mode,
        status: 'streaming',
        model: resolveModelConfig(mode, sessionSettings.modelOverride).model,
        provider: 'openrouter',
        parentUserMessageId: lastUser.id,
        branchLabel: `Asked in ${mode}`,
      })

      const optimisticConversation = updateConversationSnapshot(currentChat, {
        mode: currentMode,
        sessionSettings,
        messages: [...currentChat.messages, placeholder],
      })

      const sendId = createPendingSend({
        content: lastUser.content,
        kind: mode === 'image' ? 'image' : 'chat',
        originalMode: currentMode,
        resolvedMode: mode,
        conversationId: currentChat.id,
        projectId: currentChat.projectId,
        settings: sessionSettings,
      }).sendId

      activeSendIdRef.current = sendId

      if (mode === 'image') {
        await runImageAction({
          action: 'ask-another-mode',
          mode: currentMode,
          settings: sessionSettings,
          conversation: currentChat,
          optimisticConversation,
          targetMode: mode,
          sendId,
        })
        return
      }

      await runTextAction({
        action: 'ask-another-mode',
        mode: currentMode,
        settings: sessionSettings,
        conversation: currentChat,
        optimisticConversation,
        targetMode: mode,
        sendId,
      })
    },
    [currentChat, currentMode, runImageAction, runTextAction, sessionSettings]
  )

  const updateSessionSettings = useCallback(
    (settings: Partial<SessionSettings>) => {
      if (!currentChat) {
        setDraftSessionSettings((previous) =>
          normalizeModeSessionSettings(currentMode, {
            ...previous,
            ...settings,
          })
        )
        return
      }

      const nextSettings = normalizeModeSessionSettings(currentMode, {
        ...currentChat.sessionSettings,
        ...settings,
      })

      applyConversationPatch(currentChat.id, (conversation) =>
        updateConversationSnapshot(conversation, {
          sessionSettings: nextSettings,
        })
      )

      void persistConversationMutation(currentChat.id, {
        sessionSettings: nextSettings,
      }).catch((error) => {
        console.error('Failed to update session settings.', error)
      })
    },
    [applyConversationPatch, currentChat, currentMode, persistConversationMutation]
  )

  const exportCurrentChat = useCallback(
    (format: 'markdown' | 'json') => {
      if (!currentChat) return

      if (format === 'markdown') {
        downloadTextFile(
          `${currentChat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'chat'}.md`,
          conversationToMarkdown(currentChat),
          'text/markdown;charset=utf-8'
        )
        return
      }

      downloadTextFile(
        `${currentChat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'chat'}.json`,
        conversationToJson(currentChat),
        'application/json;charset=utf-8'
      )
    },
    [currentChat]
  )

  useEffect(() => {
    if (streamingState.status === 'streaming') return
    if (isProcessingQueueRef.current) return
    if (queuedPromptsRef.current.length === 0) return

    const nextPrompt = queuedPromptsRef.current[0]
    if (!nextPrompt) return

    isProcessingQueueRef.current = true
    setQueuedPrompts((previous) => previous.slice(1))

    debugSendPipeline('queue-restored', {
      queueId: nextPrompt.id,
      mode: nextPrompt.mode,
      kind: nextPrompt.input.kind,
      modeOverride: nextPrompt.input.modeOverride,
      conversationId: nextPrompt.conversationId,
    })

    void executeSendMessage(nextPrompt.input, {
      conversationId: nextPrompt.conversationId,
      mode: nextPrompt.mode,
      settings: nextPrompt.settings,
      projectId: nextPrompt.projectId,
    }).finally(() => {
      isProcessingQueueRef.current = false
    })
  }, [executeSendMessage, queuedPrompts, streamingState.status])

  const value = useMemo<ChatContextType>(
    () => ({
      authState,
      authError,
      requestMagicLink,
      requestPasswordSignIn,
      requestPasswordSignUp,
      requestPasswordReset,
      signOut,
      currentMode,
      setCurrentMode,
      conversations,
      chats,
      currentChat,
      setCurrentChat,
      goHome,
      createNewChat,
      deleteChat,
      togglePinChat,
      queuedPromptCount: queuedPrompts.length,
      sendMessage,
      regenerateLastResponse,
      retryLastMessage,
      editLastUserMessage,
      askAnotherMode,
      exportCurrentChat,
      isStreaming,
      stopStreaming,
      streamingState,
      sessionSettings,
      updateSessionSettings,
      appSettings,
      saveAppSettings,
      apiSettings: appSettings.gatewayDrafts,
      updateApiSettings,
      isSidebarOpen,
      sidebarWidth,
      setSidebarWidth,
      toggleSidebar: () => setIsSidebarOpen((previous) => !previous),
      isSettingsPanelOpen,
      toggleSettingsPanel: () => setIsSettingsPanelOpen((previous) => !previous),
      searchQuery,
      setSearchQuery,
      statusLabel,
      projects,
      selectedProjectId,
      setSelectedProjectId,
      createProject,
      moveChatToProject,
      moveCurrentChatToProject,
      promptLibrary,
      savePrompt,
      deletePrompt,
      beginPromptPrecheck,
      awaitRecommendationDecision,
      clearPromptPrecheck,
    }),
    [
      appSettings,
      askAnotherMode,
      authError,
      authState,
      awaitRecommendationDecision,
      beginPromptPrecheck,
      chats,
      clearPromptPrecheck,
      conversations,
      createNewChat,
      createProject,
      currentChat,
      currentMode,
      deleteChat,
      deletePrompt,
      editLastUserMessage,
      exportCurrentChat,
      goHome,
      isSettingsPanelOpen,
      isSidebarOpen,
      isStreaming,
      queuedPrompts.length,
      setSidebarWidth,
      sidebarWidth,
      moveChatToProject,
      moveCurrentChatToProject,
      projects,
      promptLibrary,
      regenerateLastResponse,
      requestMagicLink,
      requestPasswordSignIn,
      requestPasswordSignUp,
      requestPasswordReset,
      retryLastMessage,
      saveAppSettings,
      savePrompt,
      searchQuery,
      selectedProjectId,
      sendMessage,
      sessionSettings,
      setCurrentChat,
      setCurrentMode,
      setSelectedProjectId,
      signOut,
      statusLabel,
      stopStreaming,
      streamingState,
      togglePinChat,
      updateApiSettings,
      updateSessionSettings,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  const context = useContext(ChatContext)

  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }

  return context
}
