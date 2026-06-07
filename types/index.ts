export type AIMode =
  | 'general'
  | 'creative'
  | 'logic'
  | 'code'
  | 'live'
  | 'image'

export type TextAIMode = Exclude<AIMode, 'image'>

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

export type SendTransport = 'text' | 'image'

export type SendLifecycleStatus =
  | 'idle'
  | 'prechecking'
  | 'awaiting_recommendation'
  | 'dispatching_text'
  | 'dispatching_image'
  | 'streaming_text'
  | 'failed'

export type AccentStyle = 'mode' | 'glass'

export type ResponseStyle = 'balanced' | 'concise' | 'detailed'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type RecommendationOutcome =
  | 'shown'
  | 'accepted'
  | 'continued'
  | 'cancelled'
  | 'autoswitched'
  | 'not_shown'

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

export interface CustomAssistantToolSettings {
  webSearch: boolean
  memory: boolean
  fileContext: boolean
}

export interface CustomAssistantDefaults {
  temperature?: number
  maxTokens?: number
  topP?: number
  modelOverride?: ModelOverrideOption
  tools?: Partial<CustomAssistantToolSettings>
}

export interface CustomAssistantMetadata {
  version?: 2
  tone?: string
  responseStyle?: ResponseStyle
  suggestedUseCases?: string[]
  isPinned?: boolean
  starterPromptIds?: string[]
}

export interface CustomAssistant {
  id: string
  userId: string
  name: string
  description: string
  iconEmoji: string
  color: string
  baseMode: TextAIMode
  systemInstructions: string
  defaultModelOverride: ModelOverrideOption
  defaultSettings: CustomAssistantDefaults
  metadata: CustomAssistantMetadata
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomAssistantInput {
  name: string
  description?: string
  iconEmoji?: string
  color?: string
  baseMode?: TextAIMode
  systemInstructions: string
  defaultModelOverride?: ModelOverrideOption
  defaultSettings?: CustomAssistantDefaults
  metadata?: CustomAssistantMetadata
  isEnabled?: boolean
}

export interface CustomAssistantTestRequest {
  assistant: CustomAssistantInput
  prompt: string
}

export interface CustomAssistantTestResponse {
  content: string
  mode: TextAIMode
  assistantFamily: Exclude<AssistantFamily, 'prism'>
  model: string
  usage: UsageEstimate
}

export interface CustomAssistantReference {
  id: string
  name: string
  description?: string
  iconEmoji: string
  color: string
  baseMode: TextAIMode
}

export interface OpenRouterSettingsDraft {
  openRouterApiKey: string
  openRouterBaseUrl: string
}

export interface AssistantRecommendationSettings {
  enabled: boolean
  autoSwitchOnHighConfidence: boolean
}

export type OnboardingStatus = 'not_started' | 'completed' | 'skipped'

export type OnboardingUseCase =
  | 'school_research'
  | 'coding'
  | 'business'
  | 'marketing_content'
  | 'personal_productivity'
  | 'image_generation'
  | 'all_in_one'

export type StarterPackId =
  | 'student'
  | 'founder'
  | 'developer'
  | 'content_creator'
  | 'small_business'
  | 'research'
  | 'agency'

export interface OnboardingState {
  status: OnboardingStatus
  version: 1
  useCase?: OnboardingUseCase | null
  defaultMode?: AIMode | null
  starterPackId?: StarterPackId | null
  starterProjectId?: string | null
  installedPromptIds: string[]
  completedAt?: string | null
  skippedAt?: string | null
  updatedAt?: string | null
}

export type OnboardingRequest =
  | { action: 'skip' }
  | {
      action: 'complete'
      useCase: OnboardingUseCase
      defaultMode?: AIMode
      starterPackId?: StarterPackId
      createStarterProject?: boolean
      installStarterPrompts?: boolean
    }

export interface OnboardingResponse {
  settings: AppSettings
  project?: Project | null
  prompts?: PromptLibraryItem[]
}

export interface AppSettings {
  theme: 'dark'
  accentStyle: AccentStyle
  defaultMode: AIMode
  responseStyle: ResponseStyle
  assistantRecommendations: AssistantRecommendationSettings
  sessionDefaults: SessionSettings
  gatewayDrafts: OpenRouterSettingsDraft
  onboarding: OnboardingState
}

export interface AppSettingsPatch
  extends Partial<
    Omit<
      AppSettings,
      'assistantRecommendations' | 'sessionDefaults' | 'gatewayDrafts' | 'onboarding'
    >
  > {
  assistantRecommendations?: Partial<AssistantRecommendationSettings>
  sessionDefaults?: Partial<SessionSettings>
  gatewayDrafts?: Partial<OpenRouterSettingsDraft>
  onboarding?: Partial<OnboardingState>
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

export type MessageSourceKind = 'web' | 'file'

export interface MessageSource {
  id: string
  title: string
  url: string
  domain: string
  snippet: string
  kind?: MessageSourceKind
  score?: number
  publishedAt?: string
  fileId?: string
  chunkId?: string
}

export interface WebSearchSource extends MessageSource {
  kind?: 'web'
}

export interface FileKnowledgeSource extends MessageSource {
  kind: 'file'
  fileId: string
  chunkId: string
  chunkIndex: number
}

export interface FileKnowledgeContext {
  query: string
  retrievedAt: string
  sources: FileKnowledgeSource[]
}

export interface WebSearchContext {
  query: string
  searchedAt: string
  sources: WebSearchSource[]
  unavailableReason?: 'not_configured' | 'request_failed' | 'no_results'
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
  sources?: MessageSource[]
  parentUserMessageId?: string
  branchLabel?: string
  assistantFamily?: AssistantFamily
  customAssistantId?: string | null
  customAssistant?: CustomAssistantReference | null
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
  customAssistantId?: string | null
  customAssistant?: CustomAssistantReference | null
}

export interface Conversation extends ConversationSummary {
  messages: Message[]
  attachments?: Attachment[]
  usage?: UsageEstimate
  messagePageInfo?: {
    loadedCount: number
    totalCount: number
    hasMoreBefore: boolean
    nextBefore?: string | null
  }
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

export type ArtifactSourceType =
  | 'chat_message'
  | 'model_comparison'
  | 'workflow_run'
  | 'manual'
  | 'prism_prompt'
  | 'pulse_report'

export type ArtifactType =
  | 'document'
  | 'code'
  | 'table'
  | 'image_prompt'
  | 'research_report'
  | 'brand_asset'
  | 'checklist'
  | 'workflow_output'

export interface Artifact {
  id: string
  userId: string
  projectId?: string | null
  conversationId?: string | null
  sourceMessageId?: string | null
  sourceType: ArtifactSourceType
  title: string
  artifactType: ArtifactType
  content: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ArtifactInput {
  projectId?: string | null
  conversationId?: string | null
  sourceMessageId?: string | null
  sourceType: ArtifactSourceType
  title: string
  artifactType: ArtifactType
  content: string
  metadata?: Record<string, unknown>
}

export interface ArtifactPatch {
  projectId?: string | null
  title?: string
  artifactType?: ArtifactType
  content?: string
  metadata?: Record<string, unknown>
}

export interface ArtifactListFilters {
  projectId?: string | null
  q?: string
  artifactType?: ArtifactType | null
  sourceType?: ArtifactSourceType | null
  limit?: number | null
  beforeUpdatedAt?: string | null
}

export interface ArtifactVersion {
  id: string
  artifactId: string
  userId: string
  title: string
  artifactType: ArtifactType
  content: string
  metadata: Record<string, unknown>
  createdAt: string
  createdByAction?: string | null
}

export interface ArtifactVersionListResponse {
  artifactId: string
  versions: ArtifactVersion[]
}

export interface ArtifactVersionRestoreResponse {
  artifact: Artifact
  version: ArtifactVersion
}

export interface ArtifactVersionDuplicateResponse {
  artifact: Artifact
}

export type ArtifactActionType =
  | 'improve_writing'
  | 'make_shorter'
  | 'make_more_professional'
  | 'expand_detail'
  | 'turn_into_checklist'
  | 'turn_into_email'
  | 'create_summary'
  | 'find_weaknesses'

export interface ArtifactActionRequest {
  actionType: ArtifactActionType
}

export interface ArtifactActionResponse {
  artifactId: string
  actionType: ArtifactActionType
  content: string
  mode: TextAIMode
  assistantFamily: AssistantFamily
  model: string
  usage?: UsageEstimate
  truncated: boolean
}

export interface PromptLibraryItem {
  id: string
  title: string
  content: string
  mode: AIMode | 'any'
  createdAt: string
  updatedAt: string
}

export interface PromptWorkflowVariable {
  name: string
  label?: string
  defaultValue?: string
  required?: boolean
}

export type PromptWorkflowVisibility = 'private'

export type PromptWorkflowCategory =
  | 'custom'
  | 'research'
  | 'marketing'
  | 'business'
  | 'content'
  | 'developer'
  | 'operations'
  | 'image'
  | 'education'
  | 'agency'

export type PromptWorkflowExpectedOutputType =
  | 'document'
  | 'checklist'
  | 'email'
  | 'code'
  | 'table'
  | 'image_prompt'
  | 'research_brief'
  | 'proposal'
  | 'campaign'
  | 'summary'

export interface PromptWorkflowMetadata {
  category: PromptWorkflowCategory
  expectedOutputType: PromptWorkflowExpectedOutputType
  suggestedAssistant?: AssistantFamily | null
  visibility: PromptWorkflowVisibility
}

export type PromptWorkflowStepType =
  | 'text'
  | 'analysis'
  | 'research'
  | 'code'
  | 'image'

export interface PromptWorkflowStepMetadata {
  stepType: PromptWorkflowStepType
  outputLabel?: string | null
  includePreviousOutput?: boolean
}

export interface PromptWorkflowStep {
  id: string
  title?: string | null
  order: number
  assistantFamily: AssistantFamily
  mode: AIMode
  template: string
  variableNames: string[]
  metadata: PromptWorkflowStepMetadata
  createdAt: string
  updatedAt: string
}

export interface PromptWorkflow {
  id: string
  title: string
  description?: string | null
  projectId?: string | null
  metadata: PromptWorkflowMetadata
  variables: PromptWorkflowVariable[]
  steps: PromptWorkflowStep[]
  createdAt: string
  updatedAt: string
}

export interface PromptWorkflowStepInput {
  id?: string
  title?: string | null
  order?: number
  assistantFamily: AssistantFamily
  mode?: AIMode
  template: string
  variableNames?: string[]
  metadata?: Partial<PromptWorkflowStepMetadata>
}

export interface PromptWorkflowInput {
  title: string
  description?: string | null
  projectId?: string | null
  metadata?: Partial<PromptWorkflowMetadata>
  variables?: PromptWorkflowVariable[]
  steps: PromptWorkflowStepInput[]
}

export type PromptWorkflowRunStatus =
  | 'queued'
  | 'running'
  | 'complete'
  | 'failed'
  | 'cancelled'

export interface PromptWorkflowStepRun {
  id: string
  runId: string
  workflowStepId?: string | null
  stepOrder: number
  assistantFamily: AssistantFamily
  mode: AIMode
  messageId?: string | null
  status: PromptWorkflowRunStatus
  error?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface PromptWorkflowRun {
  id: string
  workflowId?: string | null
  userId: string
  conversationId?: string | null
  projectId?: string | null
  status: PromptWorkflowRunStatus
  variableValues: Record<string, string>
  error?: string | null
  startedAt: string
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  stepRuns: PromptWorkflowStepRun[]
}

export interface PromptWorkflowRunOutputMessage {
  stepRunId: string
  stepOrder: number
  workflowStepId?: string | null
  messageId: string
  conversationId: string
  assistantFamily: AssistantFamily
  mode: AIMode
  content: string
  createdAt: string
}

export interface PromptWorkflowRunHistoryItem extends PromptWorkflowRun {
  outputMessages: PromptWorkflowRunOutputMessage[]
  finalOutput?: PromptWorkflowRunOutputMessage | null
}

export interface PlaybookTemplate {
  id: string
  title: string
  description: string
  tags: string[]
  input: PromptWorkflowInput
}

export type ModelComparisonStatus = 'running' | 'complete' | 'failed'

export interface ModelComparisonCandidate {
  id: string
  comparisonId: string
  mode: AIMode
  assistantFamily: AssistantFamily
  model: string
  label: string
  content: string
  status: 'complete' | 'error'
  error?: string | null
  latencyMs?: number | null
  usage?: UsageEstimate
  sources?: MessageSource[]
  createdAt: string
  updatedAt: string
}

export interface ModelComparison {
  id: string
  userId: string
  conversationId: string
  promptMessageId: string
  projectId?: string | null
  prompt: string
  status: ModelComparisonStatus
  selectedCandidateId?: string | null
  settings: SessionSettings
  candidates: ModelComparisonCandidate[]
  createdAt: string
  updatedAt: string
}

export interface ModelComparisonRequest {
  content: string
  mode: AIMode
  targetModes: AIMode[]
  conversationId?: string
  settings: SessionSettings
}

export type SearchEntityType =
  | 'project'
  | 'conversation'
  | 'message'
  | 'artifact'
  | 'prompt'
  | 'prompt_workflow'
  | 'custom_assistant'
  | 'file'
  | 'generated_image'
  | 'model_comparison'

export type SearchResultTarget =
  | { type: 'open_project'; projectId: string }
  | { type: 'open_conversation'; conversationId: string; messageId?: string }
  | { type: 'open_artifact'; artifactId: string; projectId?: string | null }
  | { type: 'open_prompt_library'; promptId?: string; workflowId?: string }
  | { type: 'run_prompt_workflow'; workflowId: string }
  | { type: 'switch_custom_assistant'; assistantId: string }
  | { type: 'open_custom_assistants'; assistantId?: string }
  | { type: 'open_model_comparison'; comparisonId?: string; conversationId?: string }
  | {
      type: 'open_prism_history'
      imageId?: string
      conversationId?: string
      projectId?: string | null
    }
  | { type: 'open_url'; url: string }

export interface SearchResult {
  id: string
  entityType: SearchEntityType
  title: string
  snippet: string
  url: string
  target: SearchResultTarget
  projectId?: string | null
  conversationId?: string | null
  createdAt: string
  updatedAt?: string | null
  metadata?: Record<string, string | number | boolean | null>
}

export type SearchScope = 'global' | 'project'

export interface SearchResponse {
  query: string
  scope?: SearchScope
  project?: Pick<Project, 'id' | 'name'> | null
  results: SearchResult[]
}

export type ProjectHomeSuggestedActionType =
  | 'start_chat'
  | 'upload_file'
  | 'run_workflow'
  | 'review_images'
  | 'research_project'

export interface ProjectHomeOverview {
  conversationCount: number
  messageCount: number
  fileCount: number
  workflowCount: number
  generatedImageCount: number
  artifactCount: number
  memoryConversationCount: number
}

export interface ProjectHomeConversationSummary {
  id: string
  title: string
  mode: AIMode
  assistantFamily: AssistantFamily
  preview: string
  messageCount: number
  isPinned: boolean
  memorySummary?: string | null
  memoryUpdatedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type ProjectHomeFileSummary = FileIntelligence

export interface ProjectHomeGeneratedImageSummary {
  id: string
  prompt: string
  model: string
  status: string
  projectId?: string | null
  conversationId: string | null
  messageId: string | null
  width: number | null
  height: number | null
  url: string | null
  isFavorite?: boolean
  createdAt: string
  updatedAt: string
}

export interface PrismStudioImage {
  id: string
  prompt: string
  model: string
  status: string
  projectId: string | null
  conversationId: string | null
  messageId: string | null
  width: number | null
  height: number | null
  url: string | null
  sourceUrl: string | null
  isFavorite: boolean
  imageCreditsConsumed: number | null
  displayedCostUsd: number | null
  createdAt: string
  updatedAt: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface PrismStudioHistoryResponse {
  items: PrismStudioImage[]
}

export interface PrismStudioHistoryFilters {
  q?: string
  projectId?: string | null
  favorite?: boolean | null
  from?: string | null
  to?: string | null
}

export interface PrismStudioImagePatch {
  isFavorite?: boolean
  projectId?: string | null
}

export type PrismStudioQuickAction =
  | 'generate_more'
  | 'ad_concept'
  | 'matching_caption'
  | 'campaign_idea'

export type PulseResearchActionType =
  | 'summarize_sources'
  | 'opposing_views'
  | 'research_brief'
  | 'compare_sources'

export interface PulseResearchConversationSummary {
  id: string
  title: string
  projectId: string
  projectName: string
  preview: string
  messageCount: number
  sourceCount: number
  latestSourceAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PulseResearchSourceItem {
  id: string
  source: MessageSource
  conversationId: string
  conversationTitle: string
  projectId: string
  projectName: string
  messageId: string
  parentUserMessageId: string | null
  prompt: string | null
  responsePreview: string
  createdAt: string
}

export interface PulseResearchSavedSource {
  artifactId: string
  title: string
  url: string | null
  domain: string | null
  snippet: string
  projectId: string | null
  conversationId: string | null
  sourceMessageId: string | null
  createdAt: string
  updatedAt: string
}

export interface PulseResearchSearchHistoryItem {
  id: string
  prompt: string
  conversationId: string
  conversationTitle: string
  projectId: string
  projectName: string
  sourceCount: number
  createdAt: string
}

export interface PulseResearchRoomResponse {
  webSearchAvailable: boolean
  project: Project | null
  conversations: PulseResearchConversationSummary[]
  recentSources: PulseResearchSourceItem[]
  savedSources: PulseResearchSavedSource[]
  recentSearches: PulseResearchSearchHistoryItem[]
  generatedAt: string
}

export type FileKnowledgeStatus =
  | 'indexed'
  | 'skipped'
  | 'unsupported'
  | 'failed'
  | 'pending'

export interface FileIntelligence {
  id: string
  fileName: string
  mimeType: string | null
  byteSize: number | null
  projectId: string | null
  conversationId: string | null
  messageId: string | null
  visibility: 'private' | 'public'
  viewUrl: string | null
  downloadUrl: string | null
  knowledgeStatus: FileKnowledgeStatus
  knowledgeStatusLabel: string
  knowledgeReason: string | null
  chunkCount: number
  embeddingModel: string | null
  knowledgeUpdatedAt: string | null
  embeddingsAvailable: boolean
  createdAt: string
  updatedAt: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface FileIntelligenceListResponse {
  files: FileIntelligence[]
  embeddingsAvailable: boolean
}

export interface FileIntelligenceMutationResponse {
  file: FileIntelligence | null
}

export interface FileIntelligenceListFilters {
  ids?: string[]
  projectId?: string | null
  conversationId?: string | null
}

export type IntegrationProvider = 'github'

export type IntegrationAccountStatus = 'connected' | 'revoked' | 'error'

export type IntegrationItemStatus =
  | 'available'
  | 'imported'
  | 'skipped'
  | 'failed'

export interface GitHubIntegrationAccount {
  id: string
  provider: 'github'
  externalAccountId: string
  externalAccountLogin: string | null
  externalAccountName: string | null
  installationId: string | null
  scopes: string[]
  status: IntegrationAccountStatus
  connectedAt: string
  revokedAt: string | null
  syncState: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface GitHubIntegrationStatus {
  configured: boolean
  connected: boolean
  account: GitHubIntegrationAccount | null
  connectUrl: string | null
  missingConfiguration?: string[]
}

export interface GitHubRepositorySummary {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  defaultBranch: string
  description: string | null
  language: string | null
  pushedAt: string | null
  updatedAt: string | null
}

export interface GitHubImportableFile {
  path: string
  name: string
  type: 'readme' | 'package' | 'source'
  sha: string
  size: number
  language: string | null
  mimeType: string
  selectedByDefault: boolean
  reason?: string | null
}

export interface GitHubRepoFilesResponse {
  repository: GitHubRepositorySummary
  branch: string
  files: GitHubImportableFile[]
  skipped: Array<{ path: string; reason: string }>
}

export interface GitHubImportRequest {
  projectId: string
  owner: string
  repo: string
  branch?: string
  files: Array<{ path: string; sha?: string }>
}

export interface GitHubImportedItem {
  id: string
  accountId: string | null
  projectId: string | null
  fileId: string | null
  repoFullName: string | null
  branch: string | null
  path: string | null
  title: string
  status: IntegrationItemStatus
  contentHash: string | null
  byteSize: number | null
  mimeType: string | null
  lastImportedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface GitHubImportResponse {
  imported: GitHubImportedItem[]
  skipped: Array<{ path: string; reason: string }>
}

export interface ProjectHomeGitHubSummary {
  connected: boolean
  accountLogin: string | null
  importedCount: number
  lastImportedAt: string | null
  repositories: Array<{
    fullName: string
    branch: string | null
    importedCount: number
    lastImportedAt: string | null
  }>
}

export interface ProjectHomeWorkflowSummary {
  id: string
  title: string
  description?: string | null
  stepCount: number
  variableCount: number
  createdAt: string
  updatedAt: string
}

export interface ProjectHomeArtifactSummary {
  id: string
  title: string
  artifactType: ArtifactType
  sourceType: ArtifactSourceType
  conversationId: string | null
  sourceMessageId: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectHomeMemoryStatus {
  status: 'empty' | 'active'
  conversationCount: number
  memoryConversationCount: number
  latestMemoryUpdatedAt: string | null
}

export interface ProjectHomeSuggestedAction {
  id: string
  type: ProjectHomeSuggestedActionType
  title: string
  description: string
}

export interface ProjectHomeResponse {
  project: Project
  overview: ProjectHomeOverview
  recentConversations: ProjectHomeConversationSummary[]
  uploadedFiles: ProjectHomeFileSummary[]
  generatedImages: ProjectHomeGeneratedImageSummary[]
  workflows: ProjectHomeWorkflowSummary[]
  artifacts: ProjectHomeArtifactSummary[]
  githubIntegration?: ProjectHomeGitHubSummary | null
  memoryStatus: ProjectHomeMemoryStatus
  suggestedActions: ProjectHomeSuggestedAction[]
  generatedAt: string
}

export interface MemoryVaultConversationSummary {
  id: string
  title: string
  projectId: string
  projectName: string
  mode: AIMode
  assistantFamily: AssistantFamily
  preview: string
  messageCount: number
  memoryEnabled: boolean
  memorySummary: string | null
  memoryUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface MemoryVaultProjectGroup {
  project: Project
  conversationCount: number
  memoryConversationCount: number
  memoryEnabledConversationCount: number
  latestMemoryUpdatedAt: string | null
  conversations: MemoryVaultConversationSummary[]
}

export interface MemoryVaultTotals {
  projectCount: number
  conversationCount: number
  memoryConversationCount: number
  memoryEnabledConversationCount: number
  latestMemoryUpdatedAt: string | null
}

export interface MemoryVaultResponse {
  globalMemoryEnabled: boolean
  totals: MemoryVaultTotals
  projects: MemoryVaultProjectGroup[]
  recentMemories: MemoryVaultConversationSummary[]
  generatedAt: string
}

export interface MemoryVaultConversationPatch {
  memoryEnabled: boolean
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
  customAssistantId?: string | null
}

export interface PendingSend {
  sendId: string
  content: string
  attachments?: Array<Attachment | PendingAttachment>
  kind: 'chat' | 'image'
  originalMode: AIMode
  resolvedMode: AIMode
  conversationId?: string
  projectId: string
  settings: SessionSettings
  customAssistantId?: string | null
}

export interface ResolvedSend extends PendingSend {
  transport: SendTransport
}

export interface AssistantRecommendationResult {
  currentAssistant: AssistantFamily
  predictedAssistant: AssistantFamily
  recommendedMode: AIMode
  confidence: number
  reason: string
  matchedSignals: string[]
  shouldRecommendSwitch: boolean
  lockedToCurrentAssistant?: boolean
}

export interface ChatResponse {
  conversation: Conversation
  message: Message
  usage?: UsageEstimate
  subscriptionTier?: SubscriptionTier
}

export interface ConversationMessagesPageResponse {
  conversationId: string
  messages: Message[]
  hasMoreBefore: boolean
  nextBefore: string | null
}

export interface ImageGenerateRequest {
  action?: ChatAction
  conversationId?: string
  conversation?: Conversation
  mode: AIMode
  targetMode?: AIMode
  prompt?: string
  content?: string
  settings: SessionSettings
  targetMessageId?: string
  attachments?: Attachment[]
  negativePrompt?: string | null
  size?: string | null
  aspectRatio?: string | null
  imageCount?: number
}

export interface ImageGenerateResponse extends ChatResponse {
  displayedUsageMessage?: string
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
      type: 'working'
      conversationId: string
      messageId: string
      title?: string
      notes: string[]
    }
  | {
      type: 'sources'
      conversationId: string
      messageId: string
      sources: MessageSource[]
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
  workingTitle?: string
  workingNotes?: string[]
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
  fileId?: string
  storageProvider?: 'external' | 'local'
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

export interface AssistantPublicPageConfig {
  family: AssistantFamily
  slug: string
  mode: AIMode
  badge: string
  headline: string
  subheadline: string
  positioning: string
  bestFor: string[]
  demoHighlights: string[]
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
  displayName: string | null
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

export interface DashboardRecentImageSummary {
  id: string
  conversationId: string | null
  messageId: string | null
  model: string
  prompt: string
  imageCount: number
  imageCreditsConsumed: number
  displayedCostUsd: number
  outputCount: number
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

export interface AssistantRecommendationEvent {
  id: string
  userId: string
  conversationId?: string | null
  currentAssistant: AssistantFamily
  recommendedAssistant: AssistantFamily
  confidence: number
  matchedSignals: string[]
  reason: string
  outcome: RecommendationOutcome
  createdAt: string
}

export interface AssistantRecommendationAnalyticsSummary {
  totalEvents: number
  shown: number
  accepted: number
  continued: number
  cancelled: number
  autoswitched: number
  notShown: number
  topSuggestedSwitches: Array<{
    currentAssistant: AssistantFamily
    recommendedAssistant: AssistantFamily
    count: number
  }>
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
