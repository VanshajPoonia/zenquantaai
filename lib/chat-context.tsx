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
  Chat,
  ChatAction,
  ChatRequest,
  Conversation,
  ConversationSummary,
  SessionSettings,
  StreamEvent,
  StreamingState,
} from '@/types'
import { createSessionSettings, DEFAULT_APP_SETTINGS, MODE_CONFIGS } from '@/lib/config'
import {
  createMessage,
  getLastAssistantMessage,
  toConversationSummary,
  updateConversationSnapshot,
} from '@/lib/utils/chat'
import { readNdjsonStream } from '@/lib/utils/stream'

interface ChatContextType {
  currentMode: AIMode
  setCurrentMode: (mode: AIMode) => void
  chats: ConversationSummary[]
  currentChat: Chat | null
  setCurrentChat: (chat: ConversationSummary | Conversation | null) => void
  createNewChat: () => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  togglePinChat: (chatId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  regenerateLastResponse: () => Promise<void>
  retryLastMessage: () => Promise<void>
  editLastUserMessage: (content: string, targetMessageId?: string) => Promise<void>
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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

function normalizeModeSessionSettings(
  mode: AIMode,
  settings: SessionSettings
): SessionSettings {
  return createSessionSettings(mode, {
    webSearch: settings.webSearch,
    memory: settings.memory,
    fileContext: settings.fileContext,
  })
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    throw new Error(body?.error ?? `Request failed with ${response.status}`)
  }

  return (await response.json()) as T
}

function upsertSummary(
  current: ConversationSummary[],
  summary: ConversationSummary
): ConversationSummary[] {
  const next = [summary, ...current.filter((item) => item.id !== summary.id)]

  return next.sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [currentMode, setCurrentModeState] = useState<AIMode>(
    DEFAULT_APP_SETTINGS.defaultMode
  )
  const [chats, setChats] = useState<ConversationSummary[]>([])
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
  const streamAbortRef = useRef<AbortController | null>(null)

  const isStreaming = streamingState.status === 'streaming'

  const sessionSettings = normalizeModeSessionSettings(
    currentChat?.mode ?? currentMode,
    currentChat?.sessionSettings ?? draftSessionSettings
  )

  const statusLabel: 'Ready' | 'Streaming' | 'Idle' = isStreaming
    ? 'Streaming'
    : currentChat
      ? 'Ready'
      : 'Idle'

  const persistCurrentChat = useCallback((conversation: Conversation | null) => {
    setCurrentChatState(conversation)

    if (!conversation) return

    setChats((previous) => upsertSummary(previous, toConversationSummary(conversation)))
  }, [])

  const loadChat = useCallback(
    async (chatId: string) => {
      const conversation = await fetchJson<Conversation>(`/api/conversations/${chatId}`)
      setCurrentModeState(conversation.mode)
      persistCurrentChat(conversation)
    },
    [persistCurrentChat]
  )

  const loadBootData = useCallback(async () => {
    const [settings, summaries] = await Promise.all([
      fetchJson<AppSettings>('/api/settings'),
      fetchJson<ConversationSummary[]>('/api/conversations'),
    ])

    setAppSettings(settings)
    setCurrentModeState(settings.defaultMode)
    setDraftSessionSettings(
      createSessionSettings(settings.defaultMode, settings.sessionDefaults)
    )
    setChats(summaries)
  }, [])

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
        return
      }

      void loadChat(chat.id).catch((error) => {
        console.error('Failed to load conversation.', error)
      })
    },
    [loadChat]
  )

  const setCurrentMode = useCallback(
    (mode: AIMode) => {
      setCurrentModeState(mode)

      if (!currentChat) {
        setDraftSessionSettings(
          createSessionSettings(mode, appSettings.sessionDefaults)
        )
      }
    },
    [appSettings.sessionDefaults, currentChat]
  )

  const createNewChat = useCallback(async () => {
    const conversation = await fetchJson<Conversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ mode: currentMode }),
    })

    setCurrentModeState(conversation.mode)
    setDraftSessionSettings(conversation.sessionSettings)
    persistCurrentChat(conversation)
  }, [currentMode, persistCurrentChat])

  const deleteChat = useCallback(
    async (chatId: string) => {
      await fetchJson<{ ok: true }>(`/api/conversations/${chatId}`, {
        method: 'DELETE',
      })

      setChats((previous) => previous.filter((chat) => chat.id !== chatId))

      if (currentChat?.id === chatId) {
        setCurrentChatState(null)
      }
    },
    [currentChat?.id]
  )

  const togglePinChat = useCallback(
    async (chatId: string) => {
      const source =
        currentChat?.id === chatId
          ? currentChat
          : chats.find((conversation) => conversation.id === chatId)

      if (!source) return

      const updated = await fetchJson<Conversation>(`/api/conversations/${chatId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isPinned: !source.isPinned,
        }),
      })

      if (currentChat?.id === chatId) {
        setCurrentChatState(updated)
      }

      setChats((previous) => upsertSummary(previous, toConversationSummary(updated)))
    },
    [chats, currentChat]
  )

  const saveAppSettings = useCallback(
    async (settings: AppSettingsPatch) => {
      const nextSettings = await fetchJson<AppSettings>('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      })

      setAppSettings(nextSettings)

      if (!currentChat) {
        setCurrentModeState(nextSettings.defaultMode)
        setDraftSessionSettings(
          createSessionSettings(
            nextSettings.defaultMode,
            nextSettings.sessionDefaults
          )
        )
      }

      return nextSettings
    },
    [currentChat]
  )

  const updateApiSettings = useCallback(
    async (settings: Partial<APISettings>) => {
      await saveAppSettings({
        gatewayDrafts: settings,
      })
    },
    [saveAppSettings]
  )

  const applyLocalError = useCallback((messageId: string | undefined, error: string) => {
    if (!messageId) return

    setCurrentChatState((previous) => {
      if (!previous) return previous

      return {
        ...previous,
        messages: previous.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                status: 'error',
                error,
                content: message.content || error,
              }
            : message
        ),
      }
    })
  }, [])

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    setStreamingState({ status: 'idle' })
  }, [])

  const ensureConversation = useCallback(async () => {
    if (currentChat) return currentChat

    const conversation = await fetchJson<Conversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ mode: currentMode }),
    })

    persistCurrentChat(conversation)
    return conversation
  }, [currentChat, currentMode, persistCurrentChat])

  const runChatAction = useCallback(
    async (payload: {
      action: ChatAction
      content?: string
      targetMessageId?: string
      optimisticConversation: Conversation
      conversationId: string
    }) => {
      persistCurrentChat(payload.optimisticConversation)

      const placeholder = payload.optimisticConversation.messages.at(-1)

      setStreamingState({
        status: 'streaming',
        conversationId: payload.conversationId,
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
            conversationId: payload.conversationId,
            mode: currentMode,
            content: payload.content,
            settings: sessionSettings,
            targetMessageId: payload.targetMessageId,
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
              const startedConversation = {
                ...event.conversation,
                messages: [...event.conversation.messages, event.message],
              }

              setCurrentModeState(startedConversation.mode)
              persistCurrentChat(startedConversation)
              setStreamingState({
                status: 'streaming',
                conversationId: startedConversation.id,
                messageId: event.message.id,
              })
              break
            }
            case 'delta': {
              setCurrentChatState((previous) => {
                if (!previous || previous.id !== event.conversationId) {
                  return previous
                }

                return {
                  ...previous,
                  messages: previous.messages.map((message) =>
                    message.id === event.messageId
                      ? {
                          ...message,
                          content: `${message.content}${event.delta}`,
                          status: 'streaming',
                        }
                      : message
                  ),
                }
              })
              break
            }
            case 'done': {
              persistCurrentChat(event.conversation)
              setStreamingState({ status: 'idle' })
              break
            }
            case 'error': {
              applyLocalError(event.messageId, event.error)
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
        if (error instanceof DOMException && error.name === 'AbortError') {
          applyLocalError(payload.optimisticConversation.messages.at(-1)?.id, 'Generation stopped.')
          setStreamingState({ status: 'idle' })
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong while generating a response.'

        applyLocalError(payload.optimisticConversation.messages.at(-1)?.id, message)
        setStreamingState({
          status: 'error',
          conversationId: payload.conversationId,
          messageId: payload.optimisticConversation.messages.at(-1)?.id,
          error: message,
        })
      } finally {
        streamAbortRef.current = null
      }
    },
    [applyLocalError, currentMode, persistCurrentChat, sessionSettings]
  )

  const sendMessage = useCallback(
    async (content: string) => {
      const conversation = await ensureConversation()
      const userMessage = createMessage({
        role: 'user',
        content,
        mode: currentMode,
      })
      const placeholder = createMessage({
        role: 'assistant',
        content: '',
        mode: currentMode,
        status: 'streaming',
        model: MODE_CONFIGS[currentMode].model,
        provider: 'openrouter',
      })

      const optimisticConversation = updateConversationSnapshot(conversation, {
        mode: currentMode,
        sessionSettings,
        messages: [...conversation.messages, userMessage, placeholder],
      })

      await runChatAction({
        action: 'send',
        content,
        conversationId: conversation.id,
        optimisticConversation,
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

    const placeholder = createMessage({
      role: 'assistant',
      content: '',
      mode: currentMode,
      status: 'streaming',
    })

    const optimisticConversation = updateConversationSnapshot(currentChat, {
      mode: currentMode,
      sessionSettings,
      messages: [...trimmedMessages, placeholder],
    })

    await runChatAction({
      action: 'regenerate',
      conversationId: currentChat.id,
      optimisticConversation,
    })
  }, [currentChat, currentMode, runChatAction, sessionSettings])

  const retryLastMessage = useCallback(async () => {
    if (!currentChat) return

    const lastAssistant = getLastAssistantMessage(currentChat)
    const baseMessages =
      lastAssistant && currentChat.messages.at(-1)?.id === lastAssistant.id
        ? currentChat.messages.slice(0, -1)
        : currentChat.messages

    const placeholder = createMessage({
      role: 'assistant',
      content: '',
      mode: currentMode,
      status: 'streaming',
    })

    const optimisticConversation = updateConversationSnapshot(currentChat, {
      mode: currentMode,
      sessionSettings,
      messages: [...baseMessages, placeholder],
    })

    await runChatAction({
      action: 'retry',
      conversationId: currentChat.id,
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
        conversationId: currentChat.id,
        optimisticConversation,
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

      const nextSessionSettings = normalizeModeSessionSettings(currentChat.mode, {
        ...currentChat.sessionSettings,
        ...settings,
      })

      const optimisticConversation = updateConversationSnapshot(currentChat, {
        sessionSettings: nextSessionSettings,
      })

      persistCurrentChat(optimisticConversation)

      void fetchJson<Conversation>(`/api/conversations/${currentChat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sessionSettings: optimisticConversation.sessionSettings,
        }),
      })
        .then((conversation) => {
          persistCurrentChat(conversation)
        })
        .catch((error) => {
          console.error('Failed to persist session settings.', error)
        })
    },
    [currentChat, persistCurrentChat]
  )

  const value = useMemo<ChatContextType>(
    () => ({
      currentMode,
      setCurrentMode,
      chats,
      currentChat,
      setCurrentChat,
      createNewChat,
      deleteChat,
      togglePinChat,
      sendMessage,
      regenerateLastResponse,
      retryLastMessage,
      editLastUserMessage,
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
    }),
    [
      appSettings,
      chats,
      createNewChat,
      currentChat,
      currentMode,
      deleteChat,
      editLastUserMessage,
      isSettingsPanelOpen,
      isSidebarOpen,
      isStreaming,
      regenerateLastResponse,
      retryLastMessage,
      saveAppSettings,
      searchQuery,
      sendMessage,
      sessionSettings,
      setCurrentChat,
      setCurrentMode,
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
