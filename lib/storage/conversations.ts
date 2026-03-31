import { MODEL_ROUTE_CONFIGS, createSessionSettings } from '@/lib/config'
import { SEEDED_CONVERSATIONS } from '@/data/seed/conversations'
import { Conversation, ConversationMutation, ConversationSummary } from '@/types'
import { resolveRuntimePath, fileExists, readJsonFile, writeJsonFile } from './files'
import { createConversation, sortConversationSummaries, toConversationSummary, updateConversationSnapshot } from '@/lib/utils/chat'

const CONVERSATIONS_FILE = resolveRuntimePath('conversations.json')

export interface ConversationStore {
  list(): Promise<ConversationSummary[]>
  get(id: string): Promise<Conversation | null>
  create(input: {
    mode: Conversation['mode']
    title?: string
    sessionSettings: Conversation['sessionSettings']
  }): Promise<Conversation>
  save(conversation: Conversation): Promise<Conversation>
  patch(id: string, mutation: ConversationMutation): Promise<Conversation | null>
  delete(id: string): Promise<void>
}

async function ensureSeededConversations(): Promise<Conversation[]> {
  const existing = await readJsonFile<Conversation[]>(CONVERSATIONS_FILE)
  if (existing && existing.length > 0) return existing

  await writeJsonFile(CONVERSATIONS_FILE, SEEDED_CONVERSATIONS)
  return SEEDED_CONVERSATIONS
}

function migrateConversation(conversation: Conversation): Conversation {
  const modelConfig = MODEL_ROUTE_CONFIGS[conversation.mode]

  return updateConversationSnapshot({
    ...conversation,
    sessionSettings: createSessionSettings(conversation.mode, {
      webSearch: conversation.sessionSettings?.webSearch ?? false,
      memory: conversation.sessionSettings?.memory ?? true,
      fileContext: conversation.sessionSettings?.fileContext ?? false,
    }),
    messages: conversation.messages.map((message) =>
      message.role === 'assistant'
        ? {
            ...message,
            model: modelConfig.model,
            provider: 'openrouter',
          }
        : message
    ),
  })
}

async function readConversations(): Promise<Conversation[]> {
  const fileAlreadyExists = await fileExists(CONVERSATIONS_FILE)
  if (!fileAlreadyExists) {
    return ensureSeededConversations()
  }

  const conversations = await readJsonFile<Conversation[]>(CONVERSATIONS_FILE)
  if (!conversations) {
    return ensureSeededConversations()
  }

  const migrated = conversations.map(migrateConversation)
  await writeConversations(migrated)

  return migrated
}

async function writeConversations(conversations: Conversation[]): Promise<void> {
  await writeJsonFile(CONVERSATIONS_FILE, conversations)
}

class JsonConversationStore implements ConversationStore {
  async list(): Promise<ConversationSummary[]> {
    const conversations = await readConversations()
    return sortConversationSummaries(conversations.map(toConversationSummary))
  }

  async get(id: string): Promise<Conversation | null> {
    const conversations = await readConversations()
    return conversations.find((conversation) => conversation.id === id) ?? null
  }

  async create(input: {
    mode: Conversation['mode']
    title?: string
    sessionSettings: Conversation['sessionSettings']
  }): Promise<Conversation> {
    const conversations = await readConversations()
    const conversation = createConversation(input)

    await writeConversations([conversation, ...conversations])

    return conversation
  }

  async save(conversation: Conversation): Promise<Conversation> {
    const conversations = await readConversations()
    const nextConversation = updateConversationSnapshot(conversation)
    const remaining = conversations.filter((item) => item.id !== conversation.id)

    await writeConversations([nextConversation, ...remaining])

    return nextConversation
  }

  async patch(
    id: string,
    mutation: ConversationMutation
  ): Promise<Conversation | null> {
    const conversations = await readConversations()
    const existing = conversations.find((conversation) => conversation.id === id)

    if (!existing) return null

    const updated = updateConversationSnapshot(existing, mutation)
    const remaining = conversations.filter((conversation) => conversation.id !== id)

    await writeConversations([updated, ...remaining])

    return updated
  }

  async delete(id: string): Promise<void> {
    const conversations = await readConversations()
    await writeConversations(
      conversations.filter((conversation) => conversation.id !== id)
    )
  }
}

export const conversationStore: ConversationStore = new JsonConversationStore()
