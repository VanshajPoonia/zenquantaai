'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AIMode, Chat, Message, SessionSettings, APISettings, MODE_CONFIGS } from './types'
import { MOCK_CHATS } from './mock-data'

interface ChatContextType {
  // Mode
  currentMode: AIMode
  setCurrentMode: (mode: AIMode) => void
  
  // Chats
  chats: Chat[]
  currentChat: Chat | null
  setCurrentChat: (chat: Chat | null) => void
  createNewChat: () => void
  deleteChat: (chatId: string) => void
  togglePinChat: (chatId: string) => void
  
  // Messages
  addMessage: (content: string, role: 'user' | 'assistant') => void
  isStreaming: boolean
  setIsStreaming: (streaming: boolean) => void
  
  // Session Settings
  sessionSettings: SessionSettings
  updateSessionSettings: (settings: Partial<SessionSettings>) => void
  
  // API Settings
  apiSettings: APISettings
  updateApiSettings: (settings: Partial<APISettings>) => void
  
  // UI State
  isSidebarOpen: boolean
  toggleSidebar: () => void
  isSettingsPanelOpen: boolean
  toggleSettingsPanel: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  // Mode State
  const [currentMode, setCurrentMode] = useState<AIMode>('creative')
  
  // Chat State
  const [chats, setChats] = useState<Chat[]>(MOCK_CHATS)
  const [currentChat, setCurrentChat] = useState<Chat | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  
  // Session Settings
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
    temperature: 0.7,
    maxTokens: 4096,
    webSearch: false,
    memory: true,
    fileContext: false,
  })
  
  // API Settings
  const [apiSettings, setApiSettings] = useState<APISettings>({
    qwenApiKey: '',
    deepseekApiKey: '',
    qwenCoderApiKey: '',
  })
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const createNewChat = useCallback(() => {
    const newChat: Chat = {
      id: Math.random().toString(36).substring(7),
      title: `New ${MODE_CONFIGS[currentMode].name} Chat`,
      mode: currentMode,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: false,
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChat(newChat)
  }, [currentMode])

  const deleteChat = useCallback((chatId: string) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId))
    if (currentChat?.id === chatId) {
      setCurrentChat(null)
    }
  }, [currentChat])

  const togglePinChat = useCallback((chatId: string) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, isPinned: !chat.isPinned } : chat
    ))
  }, [])

  const addMessage = useCallback((content: string, role: 'user' | 'assistant') => {
    const newMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role,
      content,
      timestamp: new Date(),
      mode: currentMode,
    }

    if (!currentChat) {
      // Create new chat with this message
      const newChat: Chat = {
        id: Math.random().toString(36).substring(7),
        title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
        mode: currentMode,
        messages: [newMessage],
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
      }
      setChats(prev => [newChat, ...prev])
      setCurrentChat(newChat)
    } else {
      // Add to existing chat
      const updatedChat = {
        ...currentChat,
        messages: [...currentChat.messages, newMessage],
        updatedAt: new Date(),
      }
      setCurrentChat(updatedChat)
      setChats(prev => prev.map(chat => 
        chat.id === currentChat.id ? updatedChat : chat
      ))
    }
  }, [currentChat, currentMode])

  const updateSessionSettings = useCallback((settings: Partial<SessionSettings>) => {
    setSessionSettings(prev => ({ ...prev, ...settings }))
  }, [])

  const updateApiSettings = useCallback((settings: Partial<APISettings>) => {
    setApiSettings(prev => ({ ...prev, ...settings }))
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev)
  }, [])

  const toggleSettingsPanel = useCallback(() => {
    setIsSettingsPanelOpen(prev => !prev)
  }, [])

  return (
    <ChatContext.Provider
      value={{
        currentMode,
        setCurrentMode,
        chats,
        currentChat,
        setCurrentChat,
        createNewChat,
        deleteChat,
        togglePinChat,
        addMessage,
        isStreaming,
        setIsStreaming,
        sessionSettings,
        updateSessionSettings,
        apiSettings,
        updateApiSettings,
        isSidebarOpen,
        toggleSidebar,
        isSettingsPanelOpen,
        toggleSettingsPanel,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}
