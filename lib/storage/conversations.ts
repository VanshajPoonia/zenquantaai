import { createSessionSettings, DEFAULT_PROJECT_ID } from '@/lib/config'
import { createSupabaseSignedUrl } from './supabase'
import { neonQuery } from './neon'
import {
  createConversation,
  sortConversationSummaries,
  toConversationSummary,
  updateConversationSnapshot,
} from '@/lib/utils/chat'
import { Conversation, ConversationMutation, ConversationSummary, Message } from '@/types'

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
  const rows = await loadConversationRows(userId, id)

  return rows[0] ?? null
}

async function loadConversationRows(
  userId: string,
  id?: string
): Promise<ConversationRow[]> {
  const rows = await neonQuery<ConversationRow>(
    `
      select *
      from public.zen_conversations
      where user_id = $1
        and ($2::text is null or id = $2)
      order by updated_at desc
    `,
    [userId, id ?? null]
  )

  if (rows.length === 0) {
    return rows
  }

  const messages = await neonQuery<MessageRow>(
    `
      select *
      from public.zen_messages
      where conversation_id = any($1::text[])
      order by created_at asc
    `,
    [rows.map((row) => row.id)]
  )
  const messagesByConversation = new Map<string, MessageRow[]>()

  for (const message of messages) {
    messagesByConversation.set(message.conversation_id, [
      ...(messagesByConversation.get(message.conversation_id) ?? []),
      message,
    ])
  }

  return rows.map((row) => ({
    ...row,
    messages: messagesByConversation.get(row.id) ?? [],
  }))
}

class NeonConversationStore implements ConversationStore {
  async list(userId: string): Promise<Conversation[]> {
    const rows = await loadConversationRows(userId)

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

    const row = conversationToRow(userId, normalizedConversation)

    const savedRows = await neonQuery<ConversationRow>(
      `
        insert into public.zen_conversations (
          id,
          user_id,
          project_id,
          title,
          mode,
          is_pinned,
          preview,
          message_count,
          session_settings,
          usage,
          memory_summary,
          memory_updated_at,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14)
        on conflict (id) do update
        set project_id = excluded.project_id,
            title = excluded.title,
            mode = excluded.mode,
            is_pinned = excluded.is_pinned,
            preview = excluded.preview,
            message_count = excluded.message_count,
            session_settings = excluded.session_settings,
            usage = excluded.usage,
            memory_summary = excluded.memory_summary,
            memory_updated_at = excluded.memory_updated_at,
            updated_at = excluded.updated_at
        where public.zen_conversations.user_id = excluded.user_id
        returning *
      `,
      [
        row.id,
        row.user_id,
        row.project_id,
        row.title,
        row.mode,
        row.is_pinned,
        row.preview,
        row.message_count,
        JSON.stringify(row.session_settings),
        row.usage ? JSON.stringify(row.usage) : null,
        row.memory_summary,
        row.memory_updated_at,
        row.created_at,
        row.updated_at,
      ]
    )

    if (!savedRows[0]) {
      throw new Error('Conversation already exists for another user.')
    }

    await neonQuery(
      `
        delete from public.zen_messages
        where conversation_id = $1
          and exists (
            select 1
            from public.zen_conversations
            where id = $1 and user_id = $2
          )
      `,
      [normalizedConversation.id, userId]
    )

    if (normalizedConversation.messages.length > 0) {
      await neonQuery<MessageRow>(
        `
          insert into public.zen_messages (
            id,
            conversation_id,
            role,
            content,
            mode,
            status,
            model,
            provider,
            error,
            parent_user_message_id,
            branch_label,
            attachments,
            usage,
            created_at
          )
          select
            id,
            conversation_id,
            role,
            content,
            mode,
            status,
            model,
            provider,
            error,
            parent_user_message_id,
            branch_label,
            attachments,
            usage,
            created_at
          from jsonb_to_recordset($1::jsonb) as message_rows(
            id text,
            conversation_id text,
            role text,
            content text,
            mode text,
            status text,
            model text,
            provider text,
            error text,
            parent_user_message_id text,
            branch_label text,
            attachments jsonb,
            usage jsonb,
            created_at timestamptz
          )
        `,
        [
          JSON.stringify(
            normalizedConversation.messages.map((message) =>
              messageToRow(normalizedConversation.id, message)
            )
          ),
        ]
      )
    }

    const saved = await this.get(userId, normalizedConversation.id)

    if (!saved) {
      throw new Error('Unable to load saved conversation from Neon.')
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
    await neonQuery(
      `
        delete from public.zen_messages
        where conversation_id in (
          select conversation.id
          from public.zen_conversations conversation
          where conversation.user_id = $1 and conversation.id = $2
        )
      `,
      [userId, id]
    )

    await neonQuery(
      'delete from public.zen_conversations where user_id = $1 and id = $2',
      [userId, id]
    )
  }
}

export const conversationStore: ConversationStore = new NeonConversationStore()
