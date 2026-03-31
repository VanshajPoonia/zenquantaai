export type AIMode = 'general' | 'creative' | 'logic' | 'code'

export type ModelOverrideOption =
  | 'auto'
  | 'gemini'
  | 'claude'
  | 'gpt'
  | 'deepseek'
  | 'qwen'

export type GatewayId = 'openrouter'

export type MessageRole = 'system' | 'user' | 'assistant'

export type ChatAction =
  | 'send'
  | 'generate-image'
  | 'regenerate'
  | 'retry'
  | 'edit-last-user'
  | 'ask-another-mode'

export type StreamingStatus = 'idle' | 'streaming' | 'error'

export type AccentStyle = 'mode' | 'glass'

export type ResponseStyle = 'balanced' | 'concise' | 'detailed'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type SystemPresetId =
  | 'default'
  | 'concise'
  | 'detailed'
  | 'startup'
  | 'academic'

export interface SessionSettings {
  temperature: number
  maxTokens: number
  topP: number
  modelOverride: ModelOverrideOption
  systemPreset: SystemPresetId
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
  attachments?: Attachment[]
  usage?: UsageEstimate
  parentUserMessageId?: string
  branchLabel?: string
}

export interface ConversationSummary {
  id: string
  title: string
  mode: AIMode
  projectId: string
  createdAt: string
  updatedAt: string
  isPinned: boolean
  preview: string
  messageCount: number
  sessionSettings: SessionSettings
}

export interface Conversation extends ConversationSummary {
  messages: Message[]
  attachments?: Attachment[]
  usage?: UsageEstimate
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
  inputCostPerMillion: number
  outputCostPerMillion: number
}

export interface ModelOverrideConfig {
  id: Exclude<ModelOverrideOption, 'auto'>
  label: string
  description: string
  model: string
  inputCostPerMillion: number
  outputCostPerMillion: number
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

export interface SystemPresetConfig {
  id: SystemPresetId
  label: string
  description: string
  promptSuffix: string
}

export interface Project {
  id: string
  name: string
  description?: string
  color: string
  createdAt: string
  updatedAt: string
  isDefault?: boolean
}

export interface PromptLibraryItem {
  id: string
  title: string
  content: string
  mode: AIMode | 'any'
  createdAt: string
  updatedAt: string
}

export interface ChatRequest {
  action: ChatAction
  conversationId?: string
  conversation?: Conversation
  mode: AIMode
  targetMode?: AIMode
  content?: string
  settings: SessionSettings
  targetMessageId?: string
  attachments?: Attachment[]
  attachmentContext?: AttachmentContext[]
}

export interface ChatResponse {
  conversation: Conversation
  message: Message
  usage?: UsageEstimate
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
      usage?: UsageEstimate
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

export type AttachmentKind =
  | 'image'
  | 'pdf'
  | 'text'
  | 'code'
  | 'document'
  | 'spreadsheet'
  | 'other'

export interface Attachment {
  id: string
  kind: AttachmentKind
  name: string
  mimeType: string
  size: number
  createdAt: string
  bucket?: string
  storagePath?: string
  previewUrl?: string
  textContent?: string
  textExcerpt?: string
  isExtracted?: boolean
}

export interface PendingAttachment extends Attachment {
  file: File
}

export interface AttachmentContext {
  id: string
  name: string
  kind: AttachmentKind
  mimeType: string
  textContent?: string
}

export interface UsageEstimate {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

export interface AuthUser {
  id: string
  loginId: string | null
  email: string | null
}

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
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
  projectId?: string
  isPinned?: boolean
  sessionSettings?: SessionSettings
}

export type APISettings = OpenRouterSettingsDraft
