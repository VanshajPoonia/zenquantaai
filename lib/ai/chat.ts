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
  updateConversationSnapshot,
} from '@/lib/utils/chat'
import { estimateUsage } from '@/lib/utils/cost'
import { toAttachmentContext } from '@/lib/utils/files'
import {
  buildGeneratedImageCaption,
  createGeneratedImageAttachment,
  createGeneratedImageAttachmentFromUrl,
} from '@/lib/utils/generated-image'
import {
  buildMemoryBlock,
  getRecentContextMessages,
  updateConversationMemory,
} from './memory'
import {
  AIMode,
  AttachmentContext,
  Attachment,
  ChatAction,
  ChatRequest,
  Conversation,
  Message,
  SessionSettings,
  StreamEvent,
} from '@/types'
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

async function generateImageAttachment(
  prompt: string,
  mode: AIMode,
  settings: SessionSettings
): Promise<Attachment> {
  if (!hasOpenRouterConfig()) {
    return createGeneratedImageAttachment(prompt, mode)
  }

  try {
    const image = await createOpenRouterImage({
      model: IMAGE_GENERATION_CONFIG.model,
      prompt,
      systemPrompt: `${buildSystemPrompt(
        mode,
        settings.systemPreset
      )}\n\nGenerate a single polished image that matches the user's request. Keep any companion text extremely brief and let the image do the work.`,
    })

    return createGeneratedImageAttachmentFromUrl(prompt, image.imageUrl)
  } catch (error) {
    console.error('Falling back to local generated image placeholder.', error)
    return createGeneratedImageAttachment(prompt, mode)
  }
}

function buildMockResponse(mode: AIMode, prompt: string): string {
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
        ? `\n${attachment.textContent}`
        : '\nNo extracted text available.'

      return `File: ${attachment.name} (${attachment.kind}, ${attachment.mimeType})${detail}`
    }),
  ].join('\n\n')
}

function buildOpenRouterMessages(
  conversation: Conversation,
  settings: SessionSettings,
  mode: AIMode
): Array<{
  role: 'system' | 'user' | 'assistant'
  content: string
}> {
  const systemPrompt = buildSystemPrompt(mode, settings.systemPreset)
  const contextMessages = getRecentContextMessages(conversation)
  const memoryBlock =
    settings.memory && conversation.memorySummary
      ? buildMemoryBlock(conversation.memorySummary)
      : ''

  return [
    { role: 'system', content: systemPrompt },
    ...(memoryBlock
      ? [{ role: 'system' as const, content: memoryBlock }]
      : []),
    ...contextMessages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role,
        content:
          message.role === 'user' && settings.fileContext
            ? `${message.content}${formatAttachmentBlock(
                (message.attachments ?? []).map(toAttachmentContext)
              )}`
            : message.content,
      })),
  ]
}

export async function* generateAssistantStream(input: {
  conversation: Conversation
  settings: SessionSettings
  mode: AIMode
  action?: ChatAction
}): AsyncIterable<string> {
  const config = resolveModelConfig(input.mode, input.settings.modelOverride)
  const latestPrompt =
    [...input.conversation.messages]
      .reverse()
      .find((message) => message.role === 'user')?.content ?? 'the user request'

  if (input.action === 'generate-image') {
    for await (const chunk of streamText(
      'Creating a polished visual based on your prompt...',
      20
    )) {
      yield chunk
    }
    return
  }

  if (!hasOpenRouterConfig()) {
    for await (const chunk of streamText(buildMockResponse(input.mode, latestPrompt), 16)) {
      yield chunk
    }
    return
  }

  const stream = streamOpenRouterTextResponse({
    model: config.model,
    messages: buildOpenRouterMessages(
      input.conversation,
      input.settings,
      input.mode
    ),
    temperature: input.settings.temperature,
    maxTokens: input.settings.maxTokens,
    topP: input.settings.topP,
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
  parentUserMessageId?: string,
  branchLabel?: string
): Message {
  const config = resolveModelConfig(mode, settings.modelOverride)

  return createMessage({
    role: 'assistant',
    content: '',
    mode,
    status: 'streaming',
    model: config.model,
    provider: 'openrouter',
    parentUserMessageId,
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

  return {
    conversation: prepared.conversation,
    generationConversation: prepared.generationConversation,
    userMessage: prepared.userMessage,
    assistantMode: prepared.assistantMode,
    assistantPlaceholder: buildAssistantPlaceholder(
      prepared.assistantMode,
      payload.settings,
      prepared.userMessage.id,
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
  }
): Promise<Conversation> {
  const generatedAttachments =
    options?.action === 'generate-image' && options.userMessage
      ? [
          await generateImageAttachment(
            options.userMessage.content,
            generationMode,
            conversation.sessionSettings
          ),
        ]
      : []

  const activeConfig = resolveModelConfig(
    generationMode,
    conversation.sessionSettings.modelOverride
  )
  const promptText = buildOpenRouterMessages(
    generationConversation,
    conversation.sessionSettings,
    generationMode
  )
    .map((message) => message.content)
    .join('\n\n')
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
    usage: options?.action === 'generate-image' ? undefined : usage,
  }

  const completedConversation = updateConversationSnapshot(conversation, {
    messages: [...conversation.messages, finalAssistant],
  })
  const memoryUpdate = updateConversationMemory(
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
    settings: payload.settings,
    mode: prepared.assistantMode,
    action: payload.action,
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
  provided: SessionSettings | undefined,
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
