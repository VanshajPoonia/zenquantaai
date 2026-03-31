export type AIMode = 'creative' | 'logic' | 'code'

export type GatewayId = 'openrouter'

export type MessageRole = 'system' | 'user' | 'assistant'

export type ChatAction = 'send' | 'regenerate' | 'retry' | 'edit-last-user'

export type StreamingStatus = 'idle' | 'streaming' | 'error'

export type AccentStyle = 'mode' | 'glass'

export type ResponseStyle = 'balanced' | 'concise' | 'detailed'

export interface SessionSettings {
  temperature: number
  maxTokens: number
  webSearch: boolean
  memory: boolean
  fileContext: boolean
}

export interface OpenRouterSettingsDraft {
  openRouterApiKey: string
  openRouterBaseUrl: string
}

export interface AppSettings {
  theme: 'dark'
  accentStyle: AccentStyle
  defaultMode: AIMode
  responseStyle: ResponseStyle
  sessionDefaults: SessionSettings
  gatewayDrafts: OpenRouterSettingsDraft
}

export interface AppSettingsPatch
  extends Partial<Omit<AppSettings, 'sessionDefaults' | 'gatewayDrafts'>> {
  sessionDefaults?: Partial<SessionSettings>
  gatewayDrafts?: Partial<OpenRouterSettingsDraft>
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  mode: AIMode
  createdAt: string
  status?: 'complete' | 'streaming' | 'error'
  model?: string
  provider?: GatewayId
  error?: string
}

export interface ConversationSummary {
  id: string
  title: string
  mode: AIMode
  createdAt: string
  updatedAt: string
  isPinned: boolean
  preview: string
  messageCount: number
  sessionSettings: SessionSettings
}

export interface Conversation extends ConversationSummary {
  messages: Message[]
}

export type Chat = Conversation

export interface ModelRouteConfig {
  mode: AIMode
  gateway: GatewayId
  gatewayName: 'OpenRouter'
  model: string
  label: string
  description: string
  temperature: number
  maxTokens: number
  topP: number
  systemPromptKey: AIMode
}

export interface ModeConfig extends ModelRouteConfig {
  id: AIMode
  name: string
  placeholder: string
  helperText: string
  emptyStateTitle: string
  emptyStateDescription: string
  suggestedPrompts: string[]
  accentColor: AIMode
  icon: 'sparkles' | 'brain' | 'code'
}

export interface ChatRequest {
  action: ChatAction
  conversationId?: string
  mode: AIMode
  content?: string
  settings: SessionSettings
  targetMessageId?: string
}

export interface ChatResponse {
  conversation: Conversation
  message: Message
}

export type StreamEvent =
  | {
      type: 'start'
      conversation: Conversation
      message: Message
    }
  | {
      type: 'delta'
      conversationId: string
      messageId: string
      delta: string
    }
  | {
      type: 'done'
      conversation: Conversation
      message: Message
    }
  | {
      type: 'error'
      conversationId?: string
      messageId?: string
      error: string
      recoverable?: boolean
    }

export interface StreamingState {
  status: StreamingStatus
  conversationId?: string
  messageId?: string
  error?: string
}

export interface AIModelInput {
  mode: AIMode
  config: ModelRouteConfig
  systemPrompt: string
  conversation: Conversation
  messages: Message[]
  settings: SessionSettings
}

export interface AIModelChunk {
  delta: string
}

export interface AIModelGateway {
  id: GatewayId
  displayName: string
  streamChat(input: AIModelInput): AsyncIterable<AIModelChunk>
}

export interface ConversationMutation {
  title?: string
  mode?: AIMode
  isPinned?: boolean
  sessionSettings?: SessionSettings
}

export type APISettings = OpenRouterSettingsDraft
