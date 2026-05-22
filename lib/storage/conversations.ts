import { createSessionSettings, DEFAULT_PROJECT_ID } from '@/lib/config'
import { createSupabaseSignedUrl, supabaseRequest } from './supabase'
import {
  createConversation,
  sortConversationSummaries,
  toConversationSummary,
  updateConversationSnapshot,
} from '@/lib/utils/chat'
import { Conversation, ConversationMutation, ConversationSummary, Message } from '@/types'

const CONVERSATIONS_TABLE = 'zen_conversations'
const MESSAGES_TABLE = 'zen_messages'

type ConversationRow = {
  id: string
  user_id: string
  project_id: string | null
  title: string
  mode: Conversation['mode']
  is_pinned: boolean
  preview: string
  message_count: number
  session_settings: Conversation['sessionSettings']
  usage: Conversation['usage'] | null
  memory_summary: string | null
  memory_updated_at: string | null
  created_at: string
  updated_at: string
  messages?: MessageRow[]
}

type MessageRow = {
  id: string
  conversation_id: string
  role: Message['role']
  content: string
  mode: Message['mode']
  status: Message['status'] | null
  model: string | null
  provider: Message['provider'] | null
  error: string | null
  parent_user_message_id: string | null
  branch_label: string | null
  attachments: Message['attachments'] | null
  usage: Message['usage'] | null
  created_at: string
}

export interface ConversationStore {
  list(userId: string): Promise<Conversation[]>
  listSummaries(userId: string): Promise<ConversationSummary[]>
  get(userId: string, id: string): Promise<Conversation | null>
  create(
    userId: string,
    input: {
      mode: Conversation['mode']
      title?: string
      projectId?: string
      sessionSettings: Conversation['sessionSettings']
    }
  ): Promise<Conversation>
  save(userId: string, conversation: Conversation): Promise<Conversation>
  patch(
    userId: string,
    id: string,
    mutation: ConversationMutation
  ): Promise<Conversation | null>
  delete(userId: string, id: string): Promise<void>
}

async function hydrateAttachments<T extends { attachments?: Message['attachments'] | null }>(
  input: T
): Promise<T> {
  const attachments = await Promise.all(
    (input.attachments ?? []).map(async (attachment) => {
      if (!attachment.bucket || !attachment.storagePath) {
        return attachment
      }

      try {
        return {
          ...attachment,
          previewUrl: await createSupabaseSignedUrl({
            bucket: attachment.bucket,
            path: attachment.storagePath,
          }),
        }
      } catch {
        return attachment
      }
    })
  )

  return {
    ...input,
    attachments,
  }
}

async function rowToConversation(row: ConversationRow): Promise<Conversation> {
  const hydratedMessages = await Promise.all(
    [...(row.messages ?? [])]
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .map(async (messageRow) =>
        hydrateAttachments({
          id: messageRow.id,
          role: messageRow.role,
          content: messageRow.content,
          mode: messageRow.mode,
          createdAt: messageRow.created_at,
          status: messageRow.status ?? undefined,
          model: messageRow.model ?? undefined,
          provider: messageRow.provider ?? undefined,
          error: messageRow.error ?? undefined,
          attachments: messageRow.attachments ?? [],
          usage: messageRow.usage ?? undefined,
          parentUserMessageId: messageRow.parent_user_message_id ?? undefined,
          branchLabel: messageRow.branch_label ?? undefined,
        })
      )
  )

  const attachments = hydratedMessages.flatMap((message) => message.attachments ?? [])

  return updateConversationSnapshot({
    id: row.id,
    title: row.title,
    mode: row.mode,
    projectId: row.project_id ?? DEFAULT_PROJECT_ID,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPinned: row.is_pinned,
    preview: row.preview,
    messageCount: row.message_count,
    sessionSettings: createSessionSettings(row.mode, row.session_settings ?? {}),
    messages: hydratedMessages,
    attachments,
    usage: row.usage ?? undefined,
    memorySummary: row.memory_summary ?? undefined,
    memoryUpdatedAt: row.memory_updated_at ?? undefined,
  })
}

function conversationToRow(userId: string, conversation: Conversation): ConversationRow {
  return {
    id: conversation.id,
    user_id: userId,
    project_id: conversation.projectId ?? DEFAULT_PROJECT_ID,
    title: conversation.title,
    mode: conversation.mode,
    is_pinned: conversation.isPinned,
    preview: conversation.preview,
    message_count: conversation.messageCount,
    session_settings: conversation.sessionSettings,
    usage: conversation.usage ?? null,
    memory_summary: conversation.memorySummary ?? null,
    memory_updated_at: conversation.memoryUpdatedAt ?? null,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
  }
}

function messageToRow(conversationId: string, message: Message): MessageRow {
  return {
    id: message.id,
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
    mode: message.mode,
    status: message.status ?? null,
    model: message.model ?? null,
    provider: message.provider ?? null,
    error: message.error ?? null,
    parent_user_message_id: message.parentUserMessageId ?? null,
    branch_label: message.branchLabel ?? null,
    attachments: message.attachments ?? [],
    usage: message.usage ?? null,
    created_at: message.createdAt,
  }
}

async function fetchConversationRecord(
  userId: string,
  id: string
): Promise<ConversationRow | null> {
  const rows = await supabaseRequest<ConversationRow[]>(CONVERSATIONS_TABLE, {
    query: {
      user_id: `eq.${userId}`,
      id: `eq.${id}`,
      select: '*,messages:zen_messages(*)',
    },
  })

  return rows[0] ?? null
}

class SupabaseConversationStore implements ConversationStore {
  async list(userId: string): Promise<Conversation[]> {
    const rows = await supabaseRequest<ConversationRow[]>(CONVERSATIONS_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        select: '*,messages:zen_messages(*)',
        order: 'updated_at.desc',
      },
    })

    return await Promise.all(rows.map(rowToConversation))
  }

  async listSummaries(userId: string): Promise<ConversationSummary[]> {
    const conversations = await this.list(userId)
    return sortConversationSummaries(conversations.map(toConversationSummary))
  }

  async get(userId: string, id: string): Promise<Conversation | null> {
    const row = await fetchConversationRecord(userId, id)
    return row ? await rowToConversation(row) : null
  }

  async create(
    userId: string,
    input: {
      mode: Conversation['mode']
      title?: string
      projectId?: string
      sessionSettings: Conversation['sessionSettings']
    }
  ): Promise<Conversation> {
    const conversation = createConversation({
      mode: input.mode,
      title: input.title,
      projectId: input.projectId ?? DEFAULT_PROJECT_ID,
      sessionSettings: input.sessionSettings,
    })

    return await this.save(userId, conversation)
  }

  async save(userId: string, conversation: Conversation): Promise<Conversation> {
    const normalizedConversation = updateConversationSnapshot(conversation, {
      projectId: conversation.projectId ?? DEFAULT_PROJECT_ID,
    })

    await supabaseRequest<ConversationRow[]>(CONVERSATIONS_TABLE, {
      method: 'POST',
      body: conversationToRow(userId, normalizedConversation),
      prefer: 'resolution=merge-duplicates,return=representation',
    })

    await supabaseRequest(MESSAGES_TABLE, {
      method: 'DELETE',
      query: {
        conversation_id: `eq.${normalizedConversation.id}`,
      },
      prefer: 'return=minimal',
    })

    if (normalizedConversation.messages.length > 0) {
      await supabaseRequest<MessageRow[]>(MESSAGES_TABLE, {
        method: 'POST',
        body: normalizedConversation.messages.map((message) =>
          messageToRow(normalizedConversation.id, message)
        ),
        prefer: 'resolution=merge-duplicates,return=representation',
      })
    }

    const saved = await this.get(userId, normalizedConversation.id)

    if (!saved) {
      throw new Error('Unable to load saved conversation from Supabase.')
    }

    return saved
  }

  async patch(
    userId: string,
    id: string,
    mutation: ConversationMutation
  ): Promise<Conversation | null> {
    const current = await this.get(userId, id)
    if (!current) return null

    return await this.save(
      userId,
      updateConversationSnapshot(current, mutation)
    )
  }

  async delete(userId: string, id: string): Promise<void> {
    await supabaseRequest(MESSAGES_TABLE, {
      method: 'DELETE',
      query: {
        conversation_id: `eq.${id}`,
      },
      prefer: 'return=minimal',
    })

    await supabaseRequest(CONVERSATIONS_TABLE, {
      method: 'DELETE',
      query: {
        user_id: `eq.${userId}`,
        id: `eq.${id}`,
      },
      prefer: 'return=minimal',
    })
  }
}

export const conversationStore: ConversationStore = new SupabaseConversationStore()
