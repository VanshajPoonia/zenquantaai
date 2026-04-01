export type AIMode =
  | 'general'
  | 'creative'
  | 'logic'
  | 'code'
  | 'live'
  | 'image'

export type AssistantFamily =
  | 'nova'
  | 'velora'
  | 'axiom'
  | 'forge'
  | 'pulse'
  | 'prism'

export type AssistantKind = 'text' | 'image'

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'ultra' | 'prime'

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

export type Role = 'user' | 'admin'

export type PlanRequestStatus = 'pending' | 'approved' | 'rejected' | 'activated'

export type UsageWallet = 'core_tokens' | 'tier_tokens' | 'image_credits'

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

export interface WalletBalances {
  coreTokensIncluded: number
  coreTokensUsed: number
  tierTokensIncluded: number
  tierTokensUsed: number
  imageCreditsIncluded: number
  imageCreditsUsed: number
}

export interface WalletUsage {
  wallet: UsageWallet
  amountUsed: number
  amountRemaining: number
}

export interface UsageEstimate {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  rawCostUsd: number
  displayedCostUsd: number
  estimatedCostUsd: number
  displayMultiplier: number
  marginUsd: number
  walletType?: UsageWallet
  creditsConsumed?: number
  imageCount?: number
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
  assistantFamily?: AssistantFamily
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
  memorySummary?: string
  memoryUpdatedAt?: string
}

export interface Conversation extends ConversationSummary {
  messages: Message[]
  attachments?: Attachment[]
  usage?: UsageEstimate
}

export type Chat = Conversation

export interface ModelRouteConfig {
  mode: AIMode
  family: AssistantFamily
  assistantKind: AssistantKind
  tier: SubscriptionTier
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
  imageCostPerUnit?: number
  walletType: UsageWallet
  planName: string
}

export interface ModelOverrideConfig {
  id: Exclude<ModelOverrideOption, 'auto'>
  label: string
  description: string
  model: string
  inputCostPerMillion: number
  outputCostPerMillion: number
  imageCostPerUnit?: number
  assistantKind?: AssistantKind
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
  icon: 'sparkles' | 'brain' | 'code' | 'pulse' | 'image'
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
  subscriptionTier?: SubscriptionTier
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
      displayedUsageMessage?: string
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

export interface AuthUser {
  id: string
  loginId: string | null
  email: string | null
  role?: Role | null
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
  memorySummary?: string
  memoryUpdatedAt?: string
}

export type APISettings = OpenRouterSettingsDraft

export interface TierBudgetConfig {
  coreTokens: number
  tierTokens: number
  imageCredits: number
  dailyMessageLimit: number
  maxInputTokensPerRequest: number
  maxOutputTokensPerRequest: number
  maxImagesPerDay: number
}

export interface TierPlanConfig extends TierBudgetConfig {
  tier: SubscriptionTier
  priceUsd: number
  displayMultiplier: number
  assistantNames: Record<AssistantFamily, string>
}

export interface AssistantModelConfig {
  family: AssistantFamily
  tier: SubscriptionTier
  mode: AIMode
  assistantKind: AssistantKind
  displayName: string
  model: string
  inputCostPerMillion: number
  outputCostPerMillion: number
  imageCostPerUnit?: number
  walletType: UsageWallet
  temperature: number
  maxTokens: number
  topP: number
  description: string
}

export interface ImageModelConfig {
  family: 'prism'
  tier: SubscriptionTier
  displayName: string
  model: string
  rawCostPerImageUsd: number
  defaultImageCreditsPerImage: number
}

export interface PricingConfig {
  textModels: Record<string, { inputCostPerMillion: number; outputCostPerMillion: number }>
  imageModels: Record<
    string,
    { rawCostPerImageUsd: number; defaultImageCreditsPerImage: number }
  >
}

export interface Profile {
  userId: string
  loginId: string | null
  email: string | null
  role: Role
  createdAt: string
  updatedAt: string
}

export interface Subscription {
  id: string
  userId: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  displayMultiplier: number
  planPriceUsd: number
  coreTokensIncluded: number
  coreTokensUsed: number
  tierTokensIncluded: number
  tierTokensUsed: number
  imageCreditsIncluded: number
  imageCreditsUsed: number
  dailyMessageLimit: number
  dailyMessageCount: number
  maxInputTokensPerRequest: number
  maxOutputTokensPerRequest: number
  maxImagesPerDay: number
  dailyImageCount: number
  currentPeriodStartedAt: string
  currentPeriodEndsAt: string
  lastDailyResetAt: string
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface UsageLimitOverride {
  id: string
  userId: string
  coreTokensIncluded?: number | null
  tierTokensIncluded?: number | null
  imageCreditsIncluded?: number | null
  dailyMessageLimit?: number | null
  maxInputTokensPerRequest?: number | null
  maxOutputTokensPerRequest?: number | null
  maxImagesPerDay?: number | null
  allowedModelOverrides?: string[] | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface UsageEvent {
  id: string
  userId: string
  subscriptionId: string
  conversationId?: string | null
  messageId?: string | null
  assistantFamily: AssistantFamily
  mode: AIMode
  model: string
  walletType: UsageWallet
  promptTokens: number
  completionTokens: number
  totalTokens: number
  rawCostUsd: number
  displayedCostUsd: number
  displayMultiplier: number
  marginUsd: number
  creditsConsumed: number
  createdAt: string
}

export interface ImageGenerationEvent {
  id: string
  userId: string
  subscriptionId: string
  conversationId?: string | null
  messageId?: string | null
  assistantFamily: 'prism'
  model: string
  prompt: string
  negativePrompt?: string | null
  size?: string | null
  aspectRatio?: string | null
  imageCount: number
  imageCreditsConsumed: number
  rawCostUsd: number
  displayedCostUsd: number
  displayMultiplier: number
  marginUsd: number
  outputUrls: string[]
  createdAt: string
}

export interface PlanChangeRequest {
  id: string
  userId: string
  currentTier: SubscriptionTier
  requestedTier: Exclude<SubscriptionTier, 'free'>
  note?: string | null
  contact?: string | null
  adminNote?: string | null
  status: PlanRequestStatus
  approvedAt?: string | null
  rejectedAt?: string | null
  activatedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminAuditLog {
  id: string
  adminUserId: string
  targetUserId: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}

export interface DashboardUsageSummary {
  currentPlan: SubscriptionTier
  subscriptionStatus: SubscriptionStatus
  displayedCreditsTotal: number
  displayedCreditsUsed: number
  displayedCreditsRemaining: number
  textDisplayedCostUsd: number
  imageDisplayedCostUsd: number
  textRawCostUsd?: number
  imageRawCostUsd?: number
  totalDisplayedCostUsd: number
  totalRawCostUsd?: number
  assistantBreakdown: Array<{
    family: AssistantFamily
    events: number
    displayedCostUsd: number
    rawCostUsd?: number
  }>
}
