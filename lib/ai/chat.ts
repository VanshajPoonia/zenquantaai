import { MODEL_ROUTE_CONFIGS, resolveModelConfig } from '@/lib/config'
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
  AIMode,
  Attachment,
  AttachmentContext,
  ChatAction,
  ChatRequest,
  Conversation,
  Message,
  SessionSettings,
  StreamEvent,
} from '@/types'
import { SYSTEM_PROMPTS } from './prompts'
import {
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
  settings: SessionSettings
): Array<{
  role: 'system' | 'user' | 'assistant'
  content: string
}> {
  const systemPrompt = SYSTEM_PROMPTS[conversation.mode]

  return [
    { role: 'system', content: systemPrompt },
    ...conversation.messages
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

async function* generateAssistantStream(
  conversation: Conversation,
  settings: SessionSettings
): AsyncIterable<string> {
  const config = resolveModelConfig(conversation.mode, settings.modelOverride)
  const latestPrompt =
    [...conversation.messages].reverse().find((message) => message.role === 'user')
      ?.content ?? 'the user request'

  if (!hasOpenRouterConfig()) {
    for await (const chunk of streamText(buildMockResponse(conversation.mode, latestPrompt), 16)) {
      yield chunk
    }
    return
  }

  const stream = streamOpenRouterTextResponse({
    model: config.model,
    messages: buildOpenRouterMessages(conversation, settings),
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    topP: settings.topP,
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

function resolveConversationMode(conversation: Conversation, mode: AIMode): Conversation {
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
  settings: SessionSettings
): Message {
  const config = resolveModelConfig(mode, settings.modelOverride)

  return createMessage({
    role: 'assistant',
    content: '',
    mode,
    status: 'streaming',
    model: config.model,
    provider: 'openrouter',
  })
}

function applySend(
  conversation: Conversation,
  payload: ChatRequest
): { conversation: Conversation; userMessage: Message } {
  const content = assertContent(payload.content, payload.action)
  const userMessage = createMessage({
    role: 'user',
    content,
    mode: payload.mode,
    attachments: payload.attachments,
  })

  return {
    conversation: updateConversationSnapshot(
      resolveConversationMode(conversation, payload.mode),
      {
        sessionSettings: payload.settings,
        messages: [...conversation.messages, userMessage],
      }
    ),
    userMessage,
  }
}

function applyRegenerate(
  conversation: Conversation,
  payload: ChatRequest
): { conversation: Conversation; userMessage: Message } {
  const withoutAssistant = removeLastAssistantTurn(conversation)
  const lastUser = getLastUserMessage(withoutAssistant)

  if (!lastUser) {
    throw new Error('There is no user message to regenerate from.')
  }

  return {
    conversation: updateConversationSnapshot(
      resolveConversationMode(withoutAssistant, payload.mode),
      {
        sessionSettings: payload.settings,
      }
    ),
    userMessage: lastUser,
  }
}

function applyRetry(
  conversation: Conversation,
  payload: ChatRequest
): { conversation: Conversation; userMessage: Message } {
  const normalized = removeLastAssistantTurn(conversation)
  const lastUser = getLastUserMessage(normalized)

  if (!lastUser) {
    throw new Error('There is no user message to retry.')
  }

  return {
    conversation: updateConversationSnapshot(
      resolveConversationMode(normalized, payload.mode),
      {
        sessionSettings: payload.settings,
      }
    ),
    userMessage: lastUser,
  }
}

function applyEditLastUser(
  conversation: Conversation,
  payload: ChatRequest
): { conversation: Conversation; userMessage: Message } {
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

  return {
    conversation: updateConversationSnapshot(
      resolveConversationMode(conversation, payload.mode),
      {
        sessionSettings: payload.settings,
        messages: [
          ...conversation.messages.slice(0, lastUserIndex),
          editedUserMessage,
        ],
      }
    ),
    userMessage: editedUserMessage,
  }
}

export async function prepareConversationForChat(
  payload: ChatRequest
): Promise<{
  conversation: Conversation
  assistantPlaceholder: Message
  userMessage: Message
}> {
  const baseConversation = await resolveConversation(payload)

  let prepared:
    | {
        conversation: Conversation
        userMessage: Message
      }
    | undefined

  switch (payload.action) {
    case 'send':
      prepared = applySend(baseConversation, payload)
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
    default:
      throw new Error('Unsupported chat action.')
  }

  return {
    conversation: prepared.conversation,
    userMessage: prepared.userMessage,
    assistantPlaceholder: buildAssistantPlaceholder(payload.mode, payload.settings),
  }
}

export async function completeConversationWithAssistant(
  conversation: Conversation,
  assistantMessage: Message,
  content: string
): Promise<Conversation> {
  const activeConfig = resolveModelConfig(
    conversation.mode,
    conversation.sessionSettings.modelOverride
  )
  const promptText = buildOpenRouterMessages(
    conversation,
    conversation.sessionSettings
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
    content,
    status: 'complete' as const,
    error: undefined,
    usage,
  }

  return updateConversationSnapshot(conversation, {
    messages: [...conversation.messages, finalAssistant],
  })
}

export async function* streamConversationReply(
  payload: ChatRequest
): AsyncIterable<StreamEvent> {
  const { conversation, assistantPlaceholder } =
    await prepareConversationForChat(payload)

  yield {
    type: 'start',
    conversation,
    message: assistantPlaceholder,
  }

  let accumulated = ''

  for await (const chunk of generateAssistantStream(conversation, payload.settings)) {
    accumulated += chunk

    yield {
      type: 'delta',
      conversationId: conversation.id,
      messageId: assistantPlaceholder.id,
      delta: chunk,
    }
  }

  const savedConversation = await completeConversationWithAssistant(
    conversation,
    assistantPlaceholder,
    accumulated || 'No response returned.'
  )

  yield {
    type: 'done',
    conversation: savedConversation,
    message: {
      ...assistantPlaceholder,
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
    webSearch: provided?.webSearch ?? fallback.webSearch,
    memory: provided?.memory ?? fallback.memory,
    fileContext: provided?.fileContext ?? fallback.fileContext,
  }
}
