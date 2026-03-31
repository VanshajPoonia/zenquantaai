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
  AIMode,
  APISettings,
  AppSettings,
  AppSettingsPatch,
  Attachment,
  Chat,
  ChatAction,
  ChatRequest,
  Conversation,
  ConversationSummary,
  Project,
  PromptLibraryItem,
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
  ensureBrowserWorkspaceId,
  getDefaultBrowserProjects,
  getSeededBrowserAppSettings,
  readBrowserAppSettings,
  readBrowserConversations,
  readBrowserCurrentChatId,
  readBrowserProjects,
  readBrowserPromptLibrary,
  readBrowserSelectedProjectId,
  writeBrowserAppSettings,
  writeBrowserConversations,
  writeBrowserCurrentChatId,
  writeBrowserProjects,
  writeBrowserPromptLibrary,
  writeBrowserSelectedProjectId,
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
  conversationToJson,
  conversationToMarkdown,
  downloadTextFile,
} from '@/lib/utils/export'
import { toAttachmentContext } from '@/lib/utils/files'

interface SendMessageInput {
  content: string
  attachments?: Attachment[]
}

type ProjectFilterId = 'all' | string

interface SavePromptInput {
  title: string
  content: string
  mode: AIMode | 'any'
}

interface ChatContextType {
  workspaceId: string
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
  moveCurrentChatToProject: (projectId: string) => Promise<void>
  promptLibrary: PromptLibraryItem[]
  savePrompt: (input: SavePromptInput) => Promise<PromptLibraryItem | null>
  deletePrompt: (promptId: string) => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

function normalizeModeSessionSettings(
  mode: AIMode,
  settings: SessionSettings
): SessionSettings {
  return createSessionSettings(mode, settings)
}

function normalizeAppSettingsState(input: AppSettings): AppSettings {
  return {
    ...input,
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

function readLocalConversations(): Conversation[] {
  return sortConversationList(
    (readBrowserConversations() ?? []).map((conversation) =>
      updateConversationSnapshot(conversation, {
        projectId: conversation.projectId ?? DEFAULT_PROJECT_ID,
      })
    )
  )
}

function readLocalSettings(): AppSettings {
  return normalizeAppSettingsState(
    readBrowserAppSettings() ?? getSeededBrowserAppSettings()
  )
}

function writeLocalConversations(conversations: Conversation[]): void {
  writeBrowserConversations(sortConversationList(conversations))
}

function writeLocalSettings(settings: AppSettings): void {
  writeBrowserAppSettings(normalizeAppSettingsState(settings))
}

async function fetchProjects(workspaceId: string): Promise<Project[]> {
  const response = await fetch(
    `/api/projects?workspaceId=${encodeURIComponent(workspaceId)}`,
    {
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    throw new Error('Unable to load projects.')
  }

  return (await response.json()) as Project[]
}

async function fetchPrompts(workspaceId: string): Promise<PromptLibraryItem[]> {
  const response = await fetch(
    `/api/prompts?workspaceId=${encodeURIComponent(workspaceId)}`,
    {
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    throw new Error('Unable to load prompt library.')
  }

  return (await response.json()) as PromptLibraryItem[]
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState('')
  const [currentMode, setCurrentModeState] = useState<AIMode>(
    DEFAULT_APP_SETTINGS.defaultMode
  )
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentChat, setCurrentChatState] = useState<Conversation | null>(null)
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [draftSessionSettings, setDraftSessionSettings] = useState<SessionSettings>(
    DEFAULT_APP_SETTINGS.sessionDefaults
  )
  const [streamingState, setStreamingState] = useState<StreamingState>({
    status: 'idle',
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectIdState, setSelectedProjectIdState] =
    useState<ProjectFilterId>('all')
  const [promptLibrary, setPromptLibrary] = useState<PromptLibraryItem[]>([])
  const streamAbortRef = useRef<AbortController | null>(null)
  const conversationsRef = useRef<Conversation[]>([])
  const currentChatRef = useRef<Conversation | null>(null)

  const chats = useMemo(
    () => sortConversationSummaries(conversations.map(toConversationSummary)),
    [conversations]
  )

  const isStreaming = streamingState.status === 'streaming'

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useEffect(() => {
    currentChatRef.current = currentChat
  }, [currentChat])

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

  const commitState = useCallback(
    (nextConversations: Conversation[], nextCurrentChat: Conversation | null) => {
      const sorted = sortConversationList(nextConversations)
      conversationsRef.current = sorted
      currentChatRef.current = nextCurrentChat
      setConversations(sorted)
      writeLocalConversations(sorted)
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

  const setSelectedProjectId = useCallback((projectId: ProjectFilterId) => {
    setSelectedProjectIdState(projectId)
    writeBrowserSelectedProjectId(projectId === 'all' ? null : projectId)
  }, [])

  const loadBootData = useCallback(async () => {
    const nextWorkspaceId = ensureBrowserWorkspaceId()
    const settings = readLocalSettings()
    const nextProjects = sortProjects(
      readBrowserProjects(nextWorkspaceId) ?? getDefaultBrowserProjects(nextWorkspaceId)
    )
    const storedPrompts = sortPrompts(readBrowserPromptLibrary() ?? [])
    const nextConversations = readLocalConversations()
    const currentChatId = readBrowserCurrentChatId()
    const activeConversation =
      nextConversations.find((conversation) => conversation.id === currentChatId) ?? null
    const storedProjectId = readBrowserSelectedProjectId()

    setWorkspaceId(nextWorkspaceId)
    setProjects(nextProjects)
    writeBrowserProjects(nextProjects)
    setPromptLibrary(storedPrompts)
    writeBrowserPromptLibrary(storedPrompts)
    setSelectedProjectIdState(
      storedProjectId && nextProjects.some((project) => project.id === storedProjectId)
        ? storedProjectId
        : 'all'
    )
    setAppSettings(settings)
    writeLocalSettings(settings)
    commitState(nextConversations, activeConversation)
    setCurrentModeState(activeConversation?.mode ?? settings.defaultMode)
    setDraftSessionSettings(
      createSessionSettings(settings.defaultMode, settings.sessionDefaults)
    )

    void Promise.all([
      fetchProjects(nextWorkspaceId).then((remoteProjects) => {
        const normalized = sortProjects(remoteProjects)
        setProjects(normalized)
        writeBrowserProjects(normalized)
      }),
      fetchPrompts(nextWorkspaceId).then((remotePrompts) => {
        const normalized = sortPrompts(remotePrompts)
        setPromptLibrary(normalized)
        writeBrowserPromptLibrary(normalized)
      }),
    ]).catch((error) => {
      console.error('Failed to refresh workspace data.', error)
    })
  }, [commitState])

  useEffect(() => {
    void loadBootData().catch((error) => {
      console.error('Failed to load Zenquanta boot data.', error)
    })

    return () => {
      streamAbortRef.current?.abort()
    }
  }, [loadBootData])

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
        setDraftSessionSettings((previous) =>
          createSessionSettings(mode, previous)
        )
        return
      }

      applyConversationPatch(currentChat.id, (conversation) =>
        updateConversationSnapshot(conversation, {
          mode,
          sessionSettings: createSessionSettings(mode, conversation.sessionSettings),
        })
      )
    },
    [applyConversationPatch, currentChat]
  )

  const goHome = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
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
    const conversation = createConversation({
      mode: currentMode,
      projectId: selectedProjectId === 'all' ? DEFAULT_PROJECT_ID : selectedProjectId,
      sessionSettings,
    })

    setDraftSessionSettings(conversation.sessionSettings)
    upsertConversation(conversation)
  }, [currentMode, selectedProjectId, sessionSettings, upsertConversation])

  const deleteChat = useCallback(
    async (chatId: string) => {
      const nextConversations = conversations.filter(
        (conversation) => conversation.id !== chatId
      )

      commitState(
        nextConversations,
        currentChat?.id === chatId ? null : currentChat
      )
    },
    [commitState, conversations, currentChat]
  )

  const togglePinChat = useCallback(
    async (chatId: string) => {
      applyConversationPatch(chatId, (conversation) =>
        updateConversationSnapshot(conversation, {
          isPinned: !conversation.isPinned,
        })
      )
    },
    [applyConversationPatch]
  )

  const saveAppSettings = useCallback(
    async (settings: AppSettingsPatch) => {
      const nextSettings = normalizeAppSettingsState({
        ...appSettings,
        ...settings,
        sessionDefaults: {
          ...appSettings.sessionDefaults,
          ...settings.sessionDefaults,
        },
        gatewayDrafts: {
          ...appSettings.gatewayDrafts,
          ...settings.gatewayDrafts,
        },
      })

      setAppSettings(nextSettings)
      writeLocalSettings(nextSettings)

      if (!currentChat) {
        setCurrentModeState(nextSettings.defaultMode)
        setDraftSessionSettings(
          createSessionSettings(nextSettings.defaultMode, nextSettings.sessionDefaults)
        )
      }

      return nextSettings
    },
    [appSettings, currentChat]
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
      if (!trimmedName || !workspaceId) return null

      const color =
        PROJECT_COLOR_OPTIONS[
          Math.min(projects.length, PROJECT_COLOR_OPTIONS.length - 1)
        ]

      try {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId,
            name: trimmedName,
            color,
          }),
        })

        if (!response.ok) {
          throw new Error('Unable to create project.')
        }

        const project = (await response.json()) as Project
        const nextProjects = sortProjects([...projects, project])
        setProjects(nextProjects)
        writeBrowserProjects(nextProjects)
        setSelectedProjectId(project.id)
        return project
      } catch (error) {
        console.error('Failed to create project.', error)
        return null
      }
    },
    [projects, setSelectedProjectId, workspaceId]
  )

  const moveCurrentChatToProject = useCallback(
    async (projectId: string) => {
      if (!currentChat) return

      applyConversationPatch(currentChat.id, (conversation) =>
        updateConversationSnapshot(conversation, {
          projectId,
        })
      )
    },
    [applyConversationPatch, currentChat]
  )

  const savePrompt = useCallback(
    async ({ title, content, mode }: SavePromptInput) => {
      const trimmedTitle = title.trim()
      const trimmedContent = content.trim()

      if (!workspaceId || !trimmedTitle || !trimmedContent) {
        return null
      }

      try {
        const response = await fetch('/api/prompts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId,
            title: trimmedTitle,
            content: trimmedContent,
            mode,
          }),
        })

        if (!response.ok) {
          throw new Error('Unable to save prompt.')
        }

        const prompt = (await response.json()) as PromptLibraryItem
        const nextPrompts = sortPrompts([
          prompt,
          ...promptLibrary.filter((item) => item.id !== prompt.id),
        ])
        setPromptLibrary(nextPrompts)
        writeBrowserPromptLibrary(nextPrompts)
        return prompt
      } catch (error) {
        console.error('Failed to save prompt.', error)
        return null
      }
    },
    [promptLibrary, workspaceId]
  )

  const deletePrompt = useCallback(
    async (promptId: string) => {
      if (!workspaceId) return

      try {
        await fetch(`/api/prompts/${promptId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ workspaceId }),
        })
      } catch (error) {
        console.error('Failed to delete prompt.', error)
      }

      const nextPrompts = promptLibrary.filter((prompt) => prompt.id !== promptId)
      setPromptLibrary(nextPrompts)
      writeBrowserPromptLibrary(nextPrompts)
    },
    [promptLibrary, workspaceId]
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

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    setStreamingState({ status: 'idle' })
  }, [])

  const ensureConversation = useCallback(async () => {
    if (currentChat) return currentChat

    const conversation = createConversation({
      mode: currentMode,
      projectId: selectedProjectId === 'all' ? DEFAULT_PROJECT_ID : selectedProjectId,
      sessionSettings,
    })

    upsertConversation(conversation)
    return conversation
  }, [currentChat, currentMode, selectedProjectId, sessionSettings, upsertConversation])

  const runChatAction = useCallback(
    async (payload: {
      action: ChatAction
      content?: string
      targetMessageId?: string
      targetMode?: AIMode
      conversation: Conversation
      optimisticConversation: Conversation
      attachments?: Attachment[]
    }) => {
      upsertConversation(payload.optimisticConversation)

      const placeholder = payload.optimisticConversation.messages.at(-1)

      setStreamingState({
        status: 'streaming',
        conversationId: payload.optimisticConversation.id,
        messageId: placeholder?.id,
      })

      const controller = new AbortController()
      streamAbortRef.current = controller

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
            mode: currentMode,
            targetMode: payload.targetMode,
            content: payload.content,
            settings: sessionSettings,
            targetMessageId: payload.targetMessageId,
            attachments: payload.attachments,
            attachmentContext: (payload.attachments ?? []).map(toAttachmentContext),
          } satisfies ChatRequest),
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null
          throw new Error(body?.error ?? 'Unable to send chat request.')
        }

        await readNdjsonStream<StreamEvent>(response, (event) => {
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
            case 'done': {
              upsertConversation(event.conversation)
              setStreamingState({ status: 'idle' })
              break
            }
            case 'error': {
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

        setStreamingState({ status: 'idle' })
      } catch (error) {
        const lastMessageId = payload.optimisticConversation.messages.at(-1)?.id

        if (error instanceof DOMException && error.name === 'AbortError') {
          applyLocalError(payload.optimisticConversation.id, lastMessageId, 'Generation stopped.')
          setStreamingState({ status: 'idle' })
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong while generating a response.'

        applyLocalError(payload.optimisticConversation.id, lastMessageId, message)
        setStreamingState({
          status: 'error',
          conversationId: payload.optimisticConversation.id,
          messageId: lastMessageId,
          error: message,
        })
      } finally {
        streamAbortRef.current = null
      }
    },
    [
      applyConversationPatch,
      applyLocalError,
      currentMode,
      sessionSettings,
      upsertConversation,
    ]
  )

  const sendMessage = useCallback(
    async ({ content, attachments = [] }: SendMessageInput) => {
      const conversation = await ensureConversation()
      const userMessage = createMessage({
        role: 'user',
        content,
        mode: currentMode,
        attachments,
      })
      const placeholder = createMessage({
        role: 'assistant',
        content: '',
        mode: currentMode,
        status: 'streaming',
        model: resolveModelConfig(currentMode, sessionSettings.modelOverride).model,
        provider: 'openrouter',
        parentUserMessageId: userMessage.id,
      })

      const optimisticConversation = updateConversationSnapshot(conversation, {
        mode: currentMode,
        sessionSettings,
        messages: [...conversation.messages, userMessage, placeholder],
      })

      await runChatAction({
        action: 'send',
        content,
        conversation,
        optimisticConversation,
        attachments,
      })
    },
    [currentMode, ensureConversation, runChatAction, sessionSettings]
  )

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

    await runChatAction({
      action: 'regenerate',
      conversation: currentChat,
      optimisticConversation,
    })
  }, [currentChat, currentMode, runChatAction, sessionSettings])

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

    await runChatAction({
      action: 'retry',
      conversation: currentChat,
      optimisticConversation,
    })
  }, [currentChat, currentMode, runChatAction, sessionSettings])

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

      await runChatAction({
        action: 'edit-last-user',
        content,
        targetMessageId: lastUser.id,
        conversation: currentChat,
        optimisticConversation,
        attachments: editedUser.attachments,
      })
    },
    [currentChat, currentMode, runChatAction, sessionSettings]
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

      await runChatAction({
        action: 'ask-another-mode',
        conversation: currentChat,
        optimisticConversation,
        targetMode: mode,
      })
    },
    [currentChat, currentMode, runChatAction, sessionSettings]
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

      applyConversationPatch(currentChat.id, (conversation) =>
        updateConversationSnapshot(conversation, {
          sessionSettings: normalizeModeSessionSettings(currentMode, {
            ...conversation.sessionSettings,
            ...settings,
          }),
        })
      )
    },
    [applyConversationPatch, currentChat, currentMode]
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

  const value = useMemo<ChatContextType>(
    () => ({
      workspaceId,
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
      moveCurrentChatToProject,
      promptLibrary,
      savePrompt,
      deletePrompt,
    }),
    [
      appSettings,
      askAnotherMode,
      chats,
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
      moveCurrentChatToProject,
      projects,
      promptLibrary,
      regenerateLastResponse,
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
      statusLabel,
      stopStreaming,
      streamingState,
      togglePinChat,
      updateApiSettings,
      updateSessionSettings,
      workspaceId,
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
