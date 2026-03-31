import { MODEL_ROUTE_CONFIGS } from '@/lib/config'
import { conversationStore } from '@/lib/storage'
import {
  createMessage,
  getLastAssistantMessage,
  getLastUserMessage,
  updateConversationSnapshot,
} from '@/lib/utils/chat'
import {
  AIMode,
  ChatAction,
  ChatRequest,
  Conversation,
  Message,
  SessionSettings,
  StreamEvent,
} from '@/types'
import { SYSTEM_PROMPTS } from './prompts'
import {
  createOpenRouterTextResponse,
  hasOpenRouterConfig,
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

function buildOpenRouterMessages(conversation: Conversation): Array<{
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
        content: message.content,
      })),
  ]
}

async function generateAssistantText(
  conversation: Conversation,
  _settings: SessionSettings
): Promise<string> {
  const config = MODEL_ROUTE_CONFIGS[conversation.mode]
  const latestPrompt =
    [...conversation.messages].reverse().find((message) => message.role === 'user')
      ?.content ?? 'the user request'

  if (!hasOpenRouterConfig()) {
    return buildMockResponse(conversation.mode, latestPrompt)
  }

  return createOpenRouterTextResponse({
    model: config.model,
    messages: buildOpenRouterMessages(conversation),
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    topP: config.topP,
  })
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
  if (payload.conversationId) {
    const conversation = await conversationStore.get(payload.conversationId)
    if (!conversation) {
      throw new Error('Conversation not found.')
    }

    return conversation
  }

  return conversationStore.create({
    mode: payload.mode,
    sessionSettings: payload.settings,
  })
}

function buildAssistantPlaceholder(mode: AIMode): Message {
  const config = MODEL_ROUTE_CONFIGS[mode]

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

  const persistedConversation = await conversationStore.save(prepared.conversation)

  return {
    conversation: persistedConversation,
    userMessage: prepared.userMessage,
    assistantPlaceholder: buildAssistantPlaceholder(payload.mode),
  }
}

export async function completeConversationWithAssistant(
  conversation: Conversation,
  assistantMessage: Message,
  content: string
): Promise<Conversation> {
  const finalAssistant = {
    ...assistantMessage,
    content,
    status: 'complete' as const,
    error: undefined,
  }

  return conversationStore.save(
    updateConversationSnapshot(conversation, {
      messages: [...conversation.messages, finalAssistant],
    })
  )
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

  const fullContent = await generateAssistantText(conversation, payload.settings)
  let accumulated = ''

  for await (const chunk of streamText(fullContent, 16)) {
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
    },
  }
}

export function resolveSessionSettings(
  mode: AIMode,
  provided: SessionSettings | undefined,
  fallback: SessionSettings
): SessionSettings {
  return {
    temperature: MODEL_ROUTE_CONFIGS[mode].temperature,
    maxTokens: MODEL_ROUTE_CONFIGS[mode].maxTokens,
    webSearch: provided?.webSearch ?? fallback.webSearch,
    memory: provided?.memory ?? fallback.memory,
    fileContext: provided?.fileContext ?? fallback.fileContext,
  }
}
