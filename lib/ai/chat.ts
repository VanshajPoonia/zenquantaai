import {
  IMAGE_GENERATION_CONFIG,
  MODE_CONFIGS,
  MODEL_ROUTE_CONFIGS,
  resolveModelConfig,
} from '@/lib/config'
import {
  createConversation,
  createMessage,
  getLastAssistantMessage,
  getLastUserMessage,
  nextMessageTimestamp,
  updateConversationSnapshot,
} from '@/lib/utils/chat'
import { estimateUsage } from '@/lib/utils/cost'
import { toAttachmentContext } from '@/lib/utils/files'
import {
  buildImageGenerationPrompt,
  buildGeneratedImageCaption,
  createGeneratedImageAttachment,
  createGeneratedImageAttachmentFromUrl,
} from '@/lib/utils/generated-image'
import {
  buildCrossChatBlock,
  buildDurableMemoryBlock,
  buildMemoryBlock,
  getRecentContextMessages,
  selectBoundedContextMessages,
  updateConversationMemory,
} from './memory'
import {
  AIMode,
  AttachmentContext,
  Attachment,
  ChatAction,
  ChatRequest,
  Conversation,
  CrossChatRecallContext,
  CustomAssistantReference,
  DurableMemoryContext,
  FileKnowledgeContext,
  MessageSource,
  Message,
  SessionSettings,
  SubscriptionTier,
  StreamEvent,
  UsageEstimate,
  WebSearchContext,
  WebSearchSource,
} from '@/types'
import {
  isContextBudgetEnabled,
  isMemoryV2Enabled,
  isToonSerializationEnabled,
} from '@/lib/context/flags'
import { computeMessageSelectionBudget } from '@/lib/context/token-budget'
import {
  encodeToon,
  isToonWorthwhile,
  MIN_TOON_ROWS,
  type ToonRow,
} from '@/lib/context/toon'
import { buildSystemPrompt } from './prompts'
import {
  createOpenRouterImage,
  hasOpenRouterConfig,
  streamOpenRouterTextResponse,
} from './openrouter'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunkText(text: string, chunkSize = 28): string[] {
  const words = text.split(/(\s+)/).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const word of words) {
    if ((current + word).length > chunkSize && current) {
      chunks.push(current)
      current = word
    } else {
      current += word
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

async function* streamText(text: string, delayMs = 24) {
  for (const chunk of chunkText(text)) {
    await sleep(delayMs)
    yield chunk
  }
}

export async function generateImageFromPrompt(input: {
  prompt: string
  mode: AIMode
  settings: SessionSettings
  model?: string
}): Promise<{
  attachment: Attachment
  content: string
  imageUrl?: string
}> {
  const model = input.model ?? IMAGE_GENERATION_CONFIG.model

  if (!hasOpenRouterConfig()) {
    return {
      attachment: createGeneratedImageAttachment(input.prompt, input.mode),
      content: "I've created a visual concept based on your prompt.",
    }
  }

  const image = await createOpenRouterImage({
    model,
    prompt: buildImageGenerationPrompt(input.prompt, input.mode),
    systemPrompt: `${buildSystemPrompt(
      input.mode,
      input.settings.systemPreset
    )}\n\nGenerate a single premium image that matches the user's request with strong composition, clean subject focus, and minimal companion text.`,
    modalities: [...IMAGE_GENERATION_CONFIG.modalities],
  })

  return {
    attachment: createGeneratedImageAttachmentFromUrl(input.prompt, image.imageUrl),
    content: image.content,
    imageUrl: image.imageUrl,
  }
}

function formatMockSources(sources: WebSearchSource[] | undefined): string {
  if (!sources?.length) return ''

  return [
    '',
    '## Sources',
    ...sources.map((source) => `[${source.id}] ${source.title} - ${source.url}`),
  ].join('\n')
}

function buildMockResponse(
  mode: AIMode,
  prompt: string,
  webSearchContext?: WebSearchContext
): string {
  switch (mode) {
    case 'general':
      return `# Helpful Answer

Here is a practical response to your request:

> ${prompt}

## Quick answer
I would start with the most useful next step, keep it simple, and give you something actionable right away.

## If you want more
- ask for a shorter version
- ask for a checklist
- ask for examples tailored to your situation`
    case 'creative':
      return `# Creative Draft

Here is a stronger, more polished direction based on your prompt:

> ${prompt}

## Voice
Keep the language imaginative, elegant, and emotionally precise.

## Draft
There is a version of this idea that feels lighter on the surface and richer underneath. I would lean into atmosphere first, then sharpen the phrasing so the final copy feels premium, intentional, and memorable.

## Next moves
- create 3 tonal variations
- rewrite for landing-page copy
- turn it into a campaign concept`
    case 'logic':
      return `# Structured Reasoning

## Request
${prompt}

## Analysis
1. State the objective clearly.
2. Identify assumptions and constraints.
3. Compare options on evidence, risk, and reversibility.
4. Recommend the path with the strongest expected value.

## Recommendation
Start with the most informative and lowest-regret next step. That usually improves decision quality faster than optimizing for certainty too early.`
    case 'code':
      return `# Implementation Direction

\`\`\`ts
type NextStep = {
  focus: 'clean architecture'
  approach: 'typed abstractions and practical implementation'
}
\`\`\`

## Recommended path
- define the contract first
- keep the UI presentational
- route all model calls through one OpenRouter client
- structure the response flow so real streaming can slot in later`
    case 'live':
      return `# Fast Research Readout

## Request
${prompt}

## What matters most
- identify the current signal
- highlight likely changes or risks
- separate confirmed facts from inference
- end with the next practical action${formatMockSources(webSearchContext?.sources)}`
    case 'image':
      return `# Visual Direction

I can turn that into a polished image prompt and generate a finished visual with:

- strong composition
- clean subject focus
- premium lighting and detail
- minimal unnecessary text in-frame`
  }
}

function formatAttachmentBlock(
  attachments: AttachmentContext[] | undefined
): string {
  if (!attachments || attachments.length === 0) return ''

  return [
    '',
    '[Attached context]',
    ...attachments.map((attachment) => {
      const detail = attachment.textContent
        ? `\n${attachment.textContent.slice(0, 1_500)}${
            attachment.textContent.length > 1_500 ? '\n[attachment excerpt truncated]' : ''
          }`
        : '\nNo extracted text available.'

      return `File: ${attachment.name} (${attachment.kind}, ${attachment.mimeType})${detail}`
    }),
  ].join('\n\n')
}

// Phase 5: render a uniform list of sources as a TOON table when the flag is on
// AND it is a measured token win over the readable rendering; otherwise return
// the readable rendering unchanged. Flag-off and not-worthwhile are therefore
// byte-identical to the legacy prompt. The TOON preamble is folded into the
// candidate so the win check accounts for its cost.
function maybeToonSourceList(input: {
  readable: string
  name: string
  columns: string[]
  rows: ToonRow[]
  preamble: string
}): string {
  if (!isToonSerializationEnabled() || input.rows.length < MIN_TOON_ROWS) {
    return input.readable
  }

  const candidate = `${input.preamble}\n${encodeToon(
    input.name,
    input.columns,
    input.rows
  )}`

  return isToonWorthwhile(input.readable, candidate) ? candidate : input.readable
}

function formatFileKnowledgeBlock(context: FileKnowledgeContext | undefined): string {
  if (!context?.sources.length) return ''

  const readableSources = context.sources
    .map((source) =>
      [
        `[${source.id}] ${source.title}`,
        `Source: ${source.domain}`,
        `Excerpt: ${source.snippet}`,
      ].join('\n')
    )
    .join('\n\n')

  const sourcesSection = maybeToonSourceList({
    readable: readableSources,
    name: 'files',
    columns: ['id', 'title', 'source', 'excerpt'],
    rows: context.sources.map((source) => ({
      id: source.id,
      title: source.title,
      source: source.domain,
      excerpt: source.snippet,
    })),
    preamble:
      'File excerpts (TOON table; the header lists the columns, each following line is one excerpt in column order). Cite inline with the id column like [F1] and [F2].',
  })

  return [
    '[Uploaded file knowledge]',
    `Retrieval time: ${context.retrievedAt}`,
    `Query: ${context.query}`,
    '',
    'Use these private uploaded-file excerpts only when relevant. Cite them inline with file source labels like [F1] and [F2]. Do not claim access to full raw files beyond these excerpts.',
    '',
    sourcesSection,
  ].join('\n\n')
}

export interface CustomAssistantRuntimeContext {
  assistant: CustomAssistantReference
  systemInstructions: string
}

function formatCustomAssistantBlock(
  context: CustomAssistantRuntimeContext | undefined
): string {
  const instructions = context?.systemInstructions.trim()
  if (!context || !instructions) return ''

  return [
    '[Custom assistant instructions]',
    `Name: ${context.assistant.name}`,
    context.assistant.description
      ? `Description: ${context.assistant.description}`
      : '',
    '',
    'Follow these user-defined assistant instructions while staying within the selected built-in assistant family, safety rules, available tools, and plan/model limits.',
    '',
    instructions.slice(0, 6_000),
  ]
    .filter(Boolean)
    .join('\n')
}

function formatElapsedDuration(ms: number): string {
  const clamped = Math.max(ms, 0)
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000

  if (clamped < minute) return 'less than a minute'
  if (clamped < hour) {
    const minutes = Math.round(clamped / minute)
    return `${minutes} minute${minutes === 1 ? '' : 's'}`
  }
  if (clamped < day) {
    const hours = Math.round(clamped / hour)
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  const days = Math.round(clamped / day)
  return `${days} day${days === 1 ? '' : 's'}`
}

function formatLocalDateTime(date: Date, timeZone?: string): { text: string; zone: string } {
  const formatOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }

  if (timeZone) {
    try {
      const text = new Intl.DateTimeFormat('en-US', {
        ...formatOptions,
        timeZone,
      }).format(date)
      return { text, zone: timeZone }
    } catch {
      // Fall through to UTC below if the client sent an invalid IANA zone name.
    }
  }

  const text = new Intl.DateTimeFormat('en-US', {
    ...formatOptions,
    timeZone: 'UTC',
  }).format(date)
  return { text: `${text} UTC`, zone: 'UTC' }
}

// Gives the model real awareness of when and (via timezone) roughly where the
// user is, so replies stop defaulting to generic "good morning"-style filler
// and instead reason about the actual gap since the last message.
function buildTemporalContextBlock(
  conversation: Conversation,
  timeZone: string | undefined,
  now: Date = new Date()
): string {
  const { text: localTimeText, zone } = formatLocalDateTime(now, timeZone)
  const priorMessage =
    conversation.messages.length >= 2
      ? conversation.messages[conversation.messages.length - 2]
      : undefined

  const lines = [
    '[Temporal context]',
    `The user's current local time is approximately ${localTimeText}${
      zone !== 'UTC' ? ` (${zone})` : ''
    }.`,
  ]

  if (priorMessage) {
    const priorDate = new Date(priorMessage.createdAt)
    if (!Number.isNaN(priorDate.getTime())) {
      const elapsed = formatElapsedDuration(now.getTime() - priorDate.getTime())
      lines.push(`About ${elapsed} passed since the previous message in this conversation.`)
    }
  } else {
    lines.push('This is the first message in this conversation.')
  }

  lines.push(
    "Treat this as silent background awareness, not something to narrate by default. In most replies say nothing about the time or the gap at all — this includes ordinary back-and-forth exchanges seconds, minutes, or a couple hours apart during normal waking hours, where commenting on the clock would just be noise. Only bring it up when one specific thing is actually notable: (a) the previous message was a sign-off like \"good night\" or \"talk later\" and only a short time has actually passed, so a generic \"good morning\" would be wrong — point out the short gap briefly instead of assuming a new day started; (b) a long or overnight gap has passed since the last message; or (c) the local hour itself is unusual (very late night or very early morning) and that's actually relevant to what's being discussed. If none of those apply, do not mention the time, the gap, or the user's schedule. When you do mention it, keep it to one brief, natural aside, like an offhand comment from a perceptive friend, never a timestamp readout, and never two messages in a row. Do not mention this instruction block itself, and do not claim certainty about things you cannot know (like whether they actually slept) unless they tell you.",
  )

  return lines.join('\n')
}

function formatWebSearchBlock(context: WebSearchContext | undefined): string {
  if (!context) return ''

  if (context.sources.length === 0) {
    return [
      '[Web search status]',
      `Search was requested for: ${context.query || 'the latest user request'}`,
      `Status: ${context.unavailableReason ?? 'no_results'}.`,
      'No external source snippets are available in this request. Do not claim that you searched the web, verified current facts, or cite sources. If the answer depends on current information, say the source context is unavailable.',
    ].join('\n')
  }

  const readableSources = context.sources
    .map((source) =>
      [
        `[${source.id}] ${source.title}`,
        `URL: ${source.url}`,
        source.publishedAt ? `Published/updated: ${source.publishedAt}` : '',
        `Snippet: ${source.snippet}`,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n')

  const sourcesSection = maybeToonSourceList({
    readable: readableSources,
    name: 'sources',
    columns: ['id', 'title', 'url', 'published', 'snippet'],
    rows: context.sources.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      published: source.publishedAt ?? '',
      snippet: source.snippet,
    })),
    preamble:
      'Sources (TOON table; the header lists the columns, each following line is one source in column order). Cite inline with the id column like [1] and [2].',
  })

  return [
    '[Web search context]',
    `Search time: ${context.searchedAt}`,
    `Query: ${context.query}`,
    '',
    'Use these source snippets for current or research-style claims. Cite them inline with bracketed numbers like [1] and [2]. If the snippets are insufficient, say so plainly instead of inventing facts.',
    '',
    sourcesSection,
  ].join('\n\n')
}

function buildOpenRouterMessages(
  conversation: Conversation,
  settings: SessionSettings,
  mode: AIMode,
  webSearchContext?: WebSearchContext,
  fileKnowledgeContext?: FileKnowledgeContext,
  customAssistantContext?: CustomAssistantRuntimeContext,
  durableMemoryContext?: DurableMemoryContext,
  crossChatContext?: CrossChatRecallContext,
  timeZone?: string
): Array<{
  role: 'system' | 'user' | 'assistant'
  content: string
}> {
  const systemPrompt = buildSystemPrompt(mode, settings.systemPreset)
  const temporalBlock = buildTemporalContextBlock(conversation, timeZone)
  const memoryBlock =
    settings.memory && conversation.memorySummary
      ? buildMemoryBlock(conversation.memorySummary)
      : ''
  // Phase 3 durable memory. The retrieval layer only returns a context when the
  // MEMORY_EXTRACTION flag is on, so this is '' otherwise and the block is never
  // injected (legacy prompt stays byte-identical).
  const durableMemoryBlock = settings.memory
    ? buildDurableMemoryBlock(durableMemoryContext)
    : ''
  // Phase 4 cross-chat recall. Same discipline: '' unless CROSS_CHAT_RECALL is
  // on and the retrieval layer returned matches.
  const crossChatBlock = settings.memory ? buildCrossChatBlock(crossChatContext) : ''
  const webSearchBlock = formatWebSearchBlock(webSearchContext)
  const fileKnowledgeBlock = formatFileKnowledgeBlock(fileKnowledgeContext)
  const customAssistantBlock = formatCustomAssistantBlock(customAssistantContext)

  const budgetEnabled = isContextBudgetEnabled()

  // Phase 2 governor: size the recent-message window against what the fixed
  // context blocks already consume. Legacy path keeps the fixed last-N window.
  const contextMessages = budgetEnabled
    ? selectBoundedContextMessages(
        conversation.messages,
        computeMessageSelectionBudget({
          contextBlockTexts: [
            systemPrompt,
            temporalBlock,
            customAssistantBlock,
            durableMemoryBlock,
            crossChatBlock,
            memoryBlock,
            webSearchBlock,
            fileKnowledgeBlock,
          ],
        })
      )
    : getRecentContextMessages(conversation)

  const mappedMessages = contextMessages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role,
      content:
        message.role === 'user' && settings.fileContext
          ? `${message.content}${formatAttachmentBlock(
              (message.attachments ?? []).map(toAttachmentContext)
            )}`
          : message.content,
    }))

  // Phase 2 reorders blocks stable-prefix-first (system → identity → memory →
  // per-query retrieval → volatile recent turns) so a provider can cache the
  // stable prefix. Legacy order is preserved byte-for-byte when the flag is off.
  if (budgetEnabled) {
    return [
      { role: 'system', content: systemPrompt },
      ...(customAssistantBlock
        ? [{ role: 'system' as const, content: customAssistantBlock }]
        : []),
      ...(durableMemoryBlock
        ? [{ role: 'system' as const, content: durableMemoryBlock }]
        : []),
      ...(crossChatBlock
        ? [{ role: 'system' as const, content: crossChatBlock }]
        : []),
      ...(memoryBlock
        ? [{ role: 'system' as const, content: memoryBlock }]
        : []),
      ...(webSearchBlock
        ? [{ role: 'system' as const, content: webSearchBlock }]
        : []),
      ...(fileKnowledgeBlock
        ? [{ role: 'system' as const, content: fileKnowledgeBlock }]
        : []),
      { role: 'system' as const, content: temporalBlock },
      ...mappedMessages,
    ]
  }

  return [
    { role: 'system', content: systemPrompt },
    ...(customAssistantBlock
      ? [{ role: 'system' as const, content: customAssistantBlock }]
      : []),
    ...(durableMemoryBlock
      ? [{ role: 'system' as const, content: durableMemoryBlock }]
      : []),
    ...(crossChatBlock
      ? [{ role: 'system' as const, content: crossChatBlock }]
      : []),
    ...(webSearchBlock
      ? [{ role: 'system' as const, content: webSearchBlock }]
      : []),
    ...(fileKnowledgeBlock
      ? [{ role: 'system' as const, content: fileKnowledgeBlock }]
      : []),
    ...(memoryBlock
      ? [{ role: 'system' as const, content: memoryBlock }]
      : []),
    { role: 'system' as const, content: temporalBlock },
    ...mappedMessages,
  ]
}

export function buildPromptTextForUsage(
  conversation: Conversation,
  settings: SessionSettings,
  mode: AIMode,
  webSearchContext?: WebSearchContext,
  fileKnowledgeContext?: FileKnowledgeContext,
  customAssistantContext?: CustomAssistantRuntimeContext,
  durableMemoryContext?: DurableMemoryContext,
  crossChatContext?: CrossChatRecallContext,
  timeZone?: string
): string {
  return buildOpenRouterMessages(
    conversation,
    settings,
    mode,
    webSearchContext,
    fileKnowledgeContext,
    customAssistantContext,
    durableMemoryContext,
    crossChatContext,
    timeZone
  )
    .map((message) => message.content)
    .join('\n\n')
}

export async function* generateAssistantStream(input: {
  conversation: Conversation
  settings: SessionSettings
  mode: AIMode
  action?: ChatAction
  tier?: SubscriptionTier
  webSearchContext?: WebSearchContext
  fileKnowledgeContext?: FileKnowledgeContext
  customAssistantContext?: CustomAssistantRuntimeContext
  durableMemoryContext?: DurableMemoryContext
  crossChatContext?: CrossChatRecallContext
  timeZone?: string
  signal?: AbortSignal
}): AsyncIterable<string> {
  if (input.mode === 'image' || input.action === 'generate-image') {
    throw new Error('Image generation must use the dedicated image route.')
  }

  const config = resolveModelConfig(
    input.mode,
    input.settings.modelOverride,
    input.tier ?? 'free'
  )
  const latestPrompt =
    [...input.conversation.messages]
      .reverse()
      .find((message) => message.role === 'user')?.content ?? 'the user request'

  if (!hasOpenRouterConfig()) {
    for await (const chunk of streamText(
      buildMockResponse(input.mode, latestPrompt, input.webSearchContext),
      16
    )) {
      if (input.signal?.aborted) return
      yield chunk
    }
    return
  }

  const stream = streamOpenRouterTextResponse({
    model: config.model,
    messages: buildOpenRouterMessages(
      input.conversation,
      input.settings,
      input.mode,
      input.webSearchContext,
      input.fileKnowledgeContext,
      input.customAssistantContext,
      input.durableMemoryContext,
      input.crossChatContext,
      input.timeZone
    ),
    temperature: input.settings.temperature,
    maxTokens: input.settings.maxTokens,
    topP: input.settings.topP,
    signal: input.signal,
  })

  for await (const chunk of stream) {
    yield chunk
  }
}

function assertContent(content: string | undefined, action: ChatAction): string {
  const normalized = content?.trim()

  if (!normalized) {
    throw new Error(`Chat action "${action}" requires message content.`)
  }

  return normalized
}

function removeLastAssistantTurn(conversation: Conversation): Conversation {
  const lastAssistant = getLastAssistantMessage(conversation)

  if (!lastAssistant) return conversation

  const lastMessage = conversation.messages[conversation.messages.length - 1]
  if (lastMessage?.id !== lastAssistant.id) return conversation

  return updateConversationSnapshot(conversation, {
    messages: conversation.messages.slice(0, -1),
  })
}

function findLastUserIndex(conversation: Conversation): number {
  return conversation.messages.findLastIndex((message) => message.role === 'user')
}

function resolveConversationMode(
  conversation: Conversation,
  mode: AIMode
): Conversation {
  return updateConversationSnapshot(conversation, { mode })
}

async function resolveConversation(payload: ChatRequest): Promise<Conversation> {
  if (payload.conversation) {
    return updateConversationSnapshot(payload.conversation, {
      mode: payload.mode,
      sessionSettings: payload.settings,
      updatedAt: payload.conversation.updatedAt,
    })
  }

  return createConversation({
    id: payload.conversationId,
    mode: payload.mode,
    sessionSettings: payload.settings,
  })
}

function buildAssistantPlaceholder(
  mode: AIMode,
  settings: SessionSettings,
  tier: SubscriptionTier = 'free',
  parentUserMessageId?: string,
  precedingTimestamps?: Array<string | undefined>,
  branchLabel?: string
): Message {
  const config = resolveModelConfig(mode, settings.modelOverride, tier)

  return createMessage({
    role: 'assistant',
    content: '',
    mode,
    status: 'streaming',
    model: config.model,
    provider: 'openrouter',
    parentUserMessageId,
    createdAt: precedingTimestamps?.length
      ? nextMessageTimestamp(...precedingTimestamps)
      : undefined,
    branchLabel,
  })
}

function applySend(
  conversation: Conversation,
  payload: ChatRequest
): {
  conversation: Conversation
  generationConversation: Conversation
  userMessage: Message
  assistantMode: AIMode
} {
  const content = assertContent(payload.content, payload.action)
  const userMessage = createMessage({
    role: 'user',
    content,
    mode: payload.mode,
    attachments: payload.attachments,
  })

  const nextConversation = updateConversationSnapshot(
    resolveConversationMode(conversation, payload.mode),
    {
      sessionSettings: payload.settings,
      messages: [...conversation.messages, userMessage],
    }
  )

  return {
    conversation: nextConversation,
    generationConversation: nextConversation,
    userMessage,
    assistantMode: payload.mode,
  }
}

function applyGenerateImage(
  conversation: Conversation,
  payload: ChatRequest
): {
  conversation: Conversation
  generationConversation: Conversation
  userMessage: Message
  assistantMode: AIMode
} {
  const content = assertContent(payload.content, payload.action)
  const userMessage = createMessage({
    role: 'user',
    content,
    mode: payload.mode,
    attachments: payload.attachments,
  })

  const nextConversation = updateConversationSnapshot(
    resolveConversationMode(conversation, payload.mode),
    {
      sessionSettings: payload.settings,
      messages: [...conversation.messages, userMessage],
    }
  )

  return {
    conversation: nextConversation,
    generationConversation: nextConversation,
    userMessage,
    assistantMode: payload.mode,
  }
}

function applyRegenerate(
  conversation: Conversation,
  payload: ChatRequest
): {
  conversation: Conversation
  generationConversation: Conversation
  userMessage: Message
  assistantMode: AIMode
} {
  const withoutAssistant = removeLastAssistantTurn(conversation)
  const lastUser = getLastUserMessage(withoutAssistant)

  if (!lastUser) {
    throw new Error('There is no user message to regenerate from.')
  }

  const nextConversation = updateConversationSnapshot(
    resolveConversationMode(withoutAssistant, payload.mode),
    {
      sessionSettings: payload.settings,
    }
  )

  return {
    conversation: nextConversation,
    generationConversation: nextConversation,
    userMessage: lastUser,
    assistantMode: payload.mode,
  }
}

function applyRetry(
  conversation: Conversation,
  payload: ChatRequest
): {
  conversation: Conversation
  generationConversation: Conversation
  userMessage: Message
  assistantMode: AIMode
} {
  const normalized = removeLastAssistantTurn(conversation)
  const lastUser = getLastUserMessage(normalized)

  if (!lastUser) {
    throw new Error('There is no user message to retry.')
  }

  const nextConversation = updateConversationSnapshot(
    resolveConversationMode(normalized, payload.mode),
    {
      sessionSettings: payload.settings,
    }
  )

  return {
    conversation: nextConversation,
    generationConversation: nextConversation,
    userMessage: lastUser,
    assistantMode: payload.mode,
  }
}

function applyEditLastUser(
  conversation: Conversation,
  payload: ChatRequest
): {
  conversation: Conversation
  generationConversation: Conversation
  userMessage: Message
  assistantMode: AIMode
} {
  const lastUserIndex = findLastUserIndex(conversation)

  if (lastUserIndex === -1) {
    throw new Error('There is no user message to edit.')
  }

  const lastUser = conversation.messages[lastUserIndex]
  if (payload.targetMessageId && payload.targetMessageId !== lastUser.id) {
    throw new Error('Only the most recent user message can be edited right now.')
  }

  const editedUserMessage = {
    ...lastUser,
    content: assertContent(payload.content, payload.action),
    mode: payload.mode,
  }

  const nextConversation = updateConversationSnapshot(
    resolveConversationMode(conversation, payload.mode),
    {
      sessionSettings: payload.settings,
      messages: [
        ...conversation.messages.slice(0, lastUserIndex),
        editedUserMessage,
      ],
    }
  )

  return {
    conversation: nextConversation,
    generationConversation: nextConversation,
    userMessage: editedUserMessage,
    assistantMode: payload.mode,
  }
}

function applyAskAnotherMode(
  conversation: Conversation,
  payload: ChatRequest
): {
  conversation: Conversation
  generationConversation: Conversation
  userMessage: Message
  assistantMode: AIMode
} {
  const targetMode = payload.targetMode

  if (!targetMode) {
    throw new Error('A target mode is required to ask another mode.')
  }

  const lastUserIndex = findLastUserIndex(conversation)

  if (lastUserIndex === -1) {
    throw new Error('There is no recent user message to re-run.')
  }

  const lastUser = conversation.messages[lastUserIndex]
  const uiConversation = updateConversationSnapshot(conversation, {
    mode: payload.mode,
    sessionSettings: payload.settings,
  })

  const generationConversation = updateConversationSnapshot(uiConversation, {
    messages: uiConversation.messages.slice(0, lastUserIndex + 1),
  })

  return {
    conversation: uiConversation,
    generationConversation,
    userMessage: lastUser,
    assistantMode: targetMode,
  }
}

type PreparedConversation = {
  conversation: Conversation
  generationConversation: Conversation
  responseSettings: SessionSettings
  assistantPlaceholder: Message
  userMessage: Message
  assistantMode: AIMode
}

export async function prepareConversationForChat(
  payload: ChatRequest
): Promise<PreparedConversation> {
  const baseConversation = await resolveConversation(payload)

  let prepared:
    | {
        conversation: Conversation
        generationConversation: Conversation
        userMessage: Message
        assistantMode: AIMode
      }
    | undefined

  switch (payload.action) {
    case 'send':
      prepared = applySend(baseConversation, payload)
      break
    case 'generate-image':
      prepared = applyGenerateImage(baseConversation, payload)
      break
    case 'regenerate':
      prepared = applyRegenerate(baseConversation, payload)
      break
    case 'retry':
      prepared = applyRetry(baseConversation, payload)
      break
    case 'edit-last-user':
      prepared = applyEditLastUser(baseConversation, payload)
      break
    case 'ask-another-mode':
      prepared = applyAskAnotherMode(baseConversation, payload)
      break
    default:
      throw new Error('Unsupported chat action.')
  }

  const branchLabel =
    payload.action === 'ask-another-mode'
      ? `Asked in ${MODE_CONFIGS[prepared.assistantMode].name}`
      : undefined
  const responseSettings = payload.responseModelOverride
    ? {
        ...payload.settings,
        modelOverride: payload.responseModelOverride,
      }
    : payload.settings
  // Ask-another-mode can add multiple branch replies to the same parent user
  // message; anchoring only to the parent's timestamp would collide when more
  // than one branch reply already exists, so every existing sibling reply's
  // timestamp is also considered a lower bound.
  const siblingReplyTimestamps = prepared.conversation.messages
    .filter(
      (message) =>
        message.role === 'assistant' &&
        message.parentUserMessageId === prepared.userMessage.id
    )
    .map((message) => message.createdAt)

  return {
    conversation: prepared.conversation,
    generationConversation: prepared.generationConversation,
    responseSettings,
    userMessage: prepared.userMessage,
    assistantMode: prepared.assistantMode,
    assistantPlaceholder: buildAssistantPlaceholder(
      prepared.assistantMode,
      responseSettings,
      'free',
      prepared.userMessage.id,
      [prepared.userMessage.createdAt, ...siblingReplyTimestamps],
      branchLabel
    ),
  }
}

export async function completeConversationWithAssistant(
  conversation: Conversation,
  assistantMessage: Message,
  content: string,
  generationConversation: Conversation,
  generationMode: AIMode,
  options?: {
    action?: ChatAction
    userMessage?: Message
    tier?: SubscriptionTier
    usageOverride?: UsageEstimate
    modelOverride?: string
    webSearchContext?: WebSearchContext
    fileKnowledgeContext?: FileKnowledgeContext
    customAssistantContext?: CustomAssistantRuntimeContext
    durableMemoryContext?: DurableMemoryContext
    crossChatContext?: CrossChatRecallContext
    timeZone?: string
    sources?: MessageSource[]
    generatedImageResultOverride?: {
      attachment: Attachment
      content: string
      imageUrl?: string
    } | null
    responseSettings?: SessionSettings
  }
): Promise<Conversation> {
  const generatedImageResult = options?.generatedImageResultOverride ?? null

  if (options?.action === 'generate-image' && options.userMessage && !generatedImageResult) {
    throw new Error('Image replies must provide a finalized generated image result.')
  }

  const generatedAttachments = generatedImageResult
    ? [generatedImageResult.attachment]
    : []

  const responseSettings = options?.responseSettings ?? conversation.sessionSettings
  const activeConfig = resolveModelConfig(
    generationMode,
    responseSettings.modelOverride,
    options?.tier ?? 'free'
  )
  const promptText = buildPromptTextForUsage(
    generationConversation,
    responseSettings,
    generationMode,
    options?.webSearchContext,
    options?.fileKnowledgeContext,
    options?.customAssistantContext,
    options?.durableMemoryContext,
    options?.crossChatContext,
    options?.timeZone
  )
  const usage = estimateUsage({
    config: activeConfig,
    promptText,
    completionText: content,
  })
  const finalAssistant = {
    ...assistantMessage,
    content:
      options?.action === 'generate-image' && options.userMessage
        ? buildGeneratedImageCaption(options.userMessage.content)
        : content,
    attachments: generatedAttachments,
    status: 'complete' as const,
    error: undefined,
    usage: options?.usageOverride ?? usage,
    sources: options?.sources ?? assistantMessage.sources,
  }

  const existingAssistantIndex = conversation.messages.findIndex(
    (message) => message.id === finalAssistant.id
  )
  const nextMessages =
    existingAssistantIndex === -1
      ? [...conversation.messages, finalAssistant]
      : conversation.messages.map((message) =>
          message.id === finalAssistant.id ? finalAssistant : message
        )
  const completedConversation = updateConversationSnapshot(conversation, {
    messages: nextMessages,
  })
  // When MEMORY_V2 is on, the async rolling-summary job (maybeUpdateRollingSummary)
  // owns memorySummary, so skip the legacy regex pass and preserve whatever the
  // job last wrote. Otherwise fall back to the deterministic summarizer.
  const memoryUpdate = isMemoryV2Enabled()
    ? {
        memorySummary: completedConversation.memorySummary,
        memoryUpdatedAt: completedConversation.memoryUpdatedAt,
      }
    : updateConversationMemory(
        completedConversation,
        completedConversation.sessionSettings.memory
      )

  return updateConversationSnapshot(completedConversation, {
    ...memoryUpdate,
  })
}

export async function* streamConversationReply(
  payload: ChatRequest
): AsyncIterable<StreamEvent> {
  const prepared = await prepareConversationForChat(payload)

  yield {
    type: 'start',
    conversation: prepared.conversation,
    message: prepared.assistantPlaceholder,
  }

  let accumulated = ''

  for await (const chunk of generateAssistantStream({
    conversation: prepared.generationConversation,
    settings: prepared.responseSettings,
    mode: prepared.assistantMode,
    action: payload.action,
    tier: 'free',
  })) {
    accumulated += chunk

    yield {
      type: 'delta',
      conversationId: prepared.conversation.id,
      messageId: prepared.assistantPlaceholder.id,
      delta: chunk,
    }
  }

  const savedConversation = await completeConversationWithAssistant(
    prepared.conversation,
    prepared.assistantPlaceholder,
    accumulated || 'No response returned.',
    prepared.generationConversation,
    prepared.assistantMode,
    {
      action: payload.action,
      userMessage: prepared.userMessage,
      responseSettings: prepared.responseSettings,
    }
  )

  yield {
    type: 'done',
    conversation: savedConversation,
    message: {
      ...prepared.assistantPlaceholder,
      content: accumulated || 'No response returned.',
      status: 'complete',
      usage: savedConversation.messages.at(-1)?.usage,
    },
    usage: savedConversation.messages.at(-1)?.usage,
  }
}

export function resolveSessionSettings(
  mode: AIMode,
  provided: Partial<SessionSettings> | undefined,
  fallback: SessionSettings
): SessionSettings {
  return {
    temperature:
      provided?.temperature ?? fallback.temperature ?? MODEL_ROUTE_CONFIGS[mode].temperature,
    maxTokens:
      provided?.maxTokens ?? fallback.maxTokens ?? MODEL_ROUTE_CONFIGS[mode].maxTokens,
    topP: provided?.topP ?? fallback.topP ?? MODEL_ROUTE_CONFIGS[mode].topP,
    modelOverride:
      provided?.modelOverride ?? fallback.modelOverride ?? 'auto',
    systemPreset:
      provided?.systemPreset ?? fallback.systemPreset ?? 'default',
    webSearch: provided?.webSearch ?? fallback.webSearch,
    memory: provided?.memory ?? fallback.memory,
    fileContext: provided?.fileContext ?? fallback.fileContext,
  }
}

export function clampSessionSettingsMaxTokens(
  settings: SessionSettings,
  maxOutputTokensPerRequest: number
): SessionSettings {
  const boundedMaxTokens = Math.max(
    256,
    Math.min(settings.maxTokens, maxOutputTokensPerRequest)
  )

  if (boundedMaxTokens === settings.maxTokens) {
    return settings
  }

  return {
    ...settings,
    maxTokens: boundedMaxTokens,
  }
}
