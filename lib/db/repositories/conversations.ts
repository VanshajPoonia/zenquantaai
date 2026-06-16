import 'server-only'

import { SQL, and, asc, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm'
import { createSessionSettings, DEFAULT_PROJECT_ID } from '@/lib/config'
import { conversationUsageAggregateToEstimate } from '@/lib/conversations/usage-aggregate'
import { getAssistantFamilyFromMode } from '@/lib/config/assistants'
import { createPrivateFileUrl } from '@/lib/storage/object-store'
import {
  createConversation,
  sortConversationSummaries,
  updateConversationSnapshot,
} from '@/lib/utils/chat'
import {
  Attachment,
  Conversation,
  ConversationMutation,
  ConversationSummary,
  CustomAssistantReference,
  ConversationMessagesPageResponse,
  MessageSource,
  Message,
  SessionSettings,
  UsageEstimate,
} from '@/types'
import { getDatabaseClient } from '../client'
import { zenConversations, zenMessages } from '../schema'
import {
  toDate,
  toIsoString,
  toJsonArray,
  toJsonObject,
  toNullableDate,
  toNullableIsoString,
} from './helpers'
import { neonUsersRepository } from './users'

type ConversationRow = typeof zenConversations.$inferSelect & {
  messages?: MessageRow[]
  messagePageInfo?: Conversation['messagePageInfo']
}
type MessageRow = typeof zenMessages.$inferSelect
type ChatPersistenceAction =
  | 'send'
  | 'regenerate'
  | 'retry'
  | 'edit-last-user'
  | 'ask-another-mode'
  | 'generate-image'
type ConversationListOptions = {
  projectId?: string | null
  limit?: number | null
  beforeUpdatedAt?: Date | null
  includeMessages?: boolean
  messageLimit?: number | null
}

const MAX_CONVERSATION_LIST_LIMIT = 500
const DEFAULT_MESSAGE_PAGE_LIMIT = 80
const MAX_MESSAGE_PAGE_LIMIT = 200

function normalizeLimit(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(1, Math.min(MAX_CONVERSATION_LIST_LIMIT, Math.floor(value)))
}

function normalizeMessageLimit(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MESSAGE_PAGE_LIMIT
  }
  return Math.max(1, Math.min(MAX_MESSAGE_PAGE_LIMIT, Math.floor(value)))
}

async function hydrateAttachments<T extends { attachments?: Message['attachments'] | null }>(
  input: T
): Promise<T> {
  const attachments = await Promise.all(
    (input.attachments ?? []).map(async (attachment) => {
      if (!attachment.bucket || !attachment.storagePath) {
        return attachment
      }

      return {
        ...attachment,
        previewUrl: (() => {
          try {
            return createPrivateFileUrl({
              bucket: attachment.bucket!,
              storagePath: attachment.storagePath!,
            })
          } catch {
            return undefined
          }
        })(),
      }
    })
  )

  return {
    ...input,
    attachments,
  }
}

async function rowToMessage(messageRow: MessageRow): Promise<Message> {
  return await hydrateAttachments({
    id: messageRow.id,
    role: messageRow.role as Message['role'],
    content: messageRow.content,
    mode: messageRow.mode as Message['mode'],
    createdAt: toIsoString(messageRow.createdAt),
    status: (messageRow.status as Message['status'] | null) ?? undefined,
    model: messageRow.model ?? undefined,
    provider: (messageRow.provider as Message['provider'] | null) ?? undefined,
    error: messageRow.error ?? undefined,
    assistantFamily:
      (messageRow.assistantFamily as Message['assistantFamily'] | null) ??
      undefined,
    attachments: toJsonArray<Attachment>(messageRow.attachments),
    usage: messageRow.usage
      ? toJsonObject<UsageEstimate>(messageRow.usage, {} as UsageEstimate)
      : undefined,
    sources: toJsonArray<MessageSource>(messageRow.sources),
    parentUserMessageId: messageRow.parentUserMessageId ?? undefined,
    branchLabel: messageRow.branchLabel ?? undefined,
    customAssistantId: messageRow.customAssistantId,
    customAssistant: messageRow.customAssistant
      ? toJsonObject<CustomAssistantReference>(
          messageRow.customAssistant,
          {} as CustomAssistantReference
        )
      : null,
  })
}

async function rowToConversation(row: ConversationRow): Promise<Conversation> {
  const hydratedMessages = await Promise.all(
    [...(row.messages ?? [])]
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map(rowToMessage)
  )

  const attachments = hydratedMessages.flatMap((message) => message.attachments ?? [])

  return {
    id: row.id,
    title: row.title,
    mode: row.mode as Conversation['mode'],
    projectId: row.projectId ?? DEFAULT_PROJECT_ID,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    isPinned: row.isPinned,
    preview: row.preview,
    messageCount: row.messageCount,
    sessionSettings: createSessionSettings(
      row.mode as Conversation['mode'],
      toJsonObject<Partial<SessionSettings>>(row.sessionSettings, {})
    ),
    messages: hydratedMessages,
    attachments,
    usage: row.usage
      ? toJsonObject<UsageEstimate>(row.usage, {} as UsageEstimate)
      : undefined,
    memorySummary: row.memorySummary ?? undefined,
    memoryUpdatedAt: toNullableIsoString(row.memoryUpdatedAt) ?? undefined,
    customAssistantId: row.customAssistantId,
    customAssistant: row.customAssistant
      ? toJsonObject<CustomAssistantReference>(
          row.customAssistant,
          {} as CustomAssistantReference
        )
      : null,
    messagePageInfo: row.messagePageInfo,
  }
}

function conversationToInsert(userId: string, conversation: Conversation) {
  return {
    id: conversation.id,
    userId,
    projectId: conversation.projectId ?? DEFAULT_PROJECT_ID,
    title: conversation.title,
    mode: conversation.mode,
    assistantFamily: getAssistantFamilyFromMode(conversation.mode),
    isPinned: conversation.isPinned,
    preview: conversation.preview,
    messageCount: conversation.messageCount,
    sessionSettings: conversation.sessionSettings,
    customAssistantId: conversation.customAssistantId ?? null,
    customAssistant: conversation.customAssistant ?? null,
    usage: conversation.usage ?? null,
    memorySummary: conversation.memorySummary ?? null,
    memoryUpdatedAt: toNullableDate(conversation.memoryUpdatedAt),
    createdAt: toDate(conversation.createdAt),
    updatedAt: toDate(conversation.updatedAt),
  }
}

function messageToInsert(conversationId: string, message: Message) {
  return {
    id: message.id,
    conversationId,
    role: message.role,
    content: message.content,
    mode: message.mode,
    assistantFamily: message.assistantFamily ?? null,
    status: message.status ?? null,
    model: message.model ?? null,
    provider: message.provider ?? null,
    error: message.error ?? null,
    parentUserMessageId: message.parentUserMessageId ?? null,
    branchLabel: message.branchLabel ?? null,
    customAssistantId: message.customAssistantId ?? null,
    customAssistant: message.customAssistant ?? null,
    attachments: message.attachments ?? [],
    usage: message.usage ?? null,
    sources: message.sources ?? [],
    createdAt: toDate(message.createdAt),
  }
}

async function loadConversationRows(
  userId: string,
  id?: string,
  options: ConversationListOptions = {}
): Promise<ConversationRow[]> {
  const db = getDatabaseClient()
  const conditions: SQL[] = [eq(zenConversations.userId, userId)]

  if (id) {
    conditions.push(eq(zenConversations.id, id))
  }
  if (!id && options.projectId) {
    conditions.push(eq(zenConversations.projectId, options.projectId))
  }
  if (!id && options.beforeUpdatedAt) {
    conditions.push(lt(zenConversations.updatedAt, options.beforeUpdatedAt))
  }

  const limit = id ? null : normalizeLimit(options.limit)
  const query = db
    .select()
    .from(zenConversations)
    .where(and(...conditions))
    .orderBy(desc(zenConversations.updatedAt))
  const conversations = limit ? await query.limit(limit) : await query

  if (conversations.length === 0) {
    return []
  }

  if (options.includeMessages === false) {
    return conversations.map((conversation) => ({
      ...conversation,
      messages: [],
      messagePageInfo: {
        loadedCount: 0,
        totalCount: conversation.messageCount,
        hasMoreBefore: conversation.messageCount > 0,
        nextBefore: null,
      },
    }))
  }

  if (conversations.length === 1 && options.messageLimit) {
    const conversation = conversations[0]
    const limit = normalizeMessageLimit(options.messageLimit)
    const newestRows = await db
      .select()
      .from(zenMessages)
      .where(eq(zenMessages.conversationId, conversation.id))
      .orderBy(desc(zenMessages.createdAt))
      .limit(limit + 1)
    const hasMoreBefore = newestRows.length > limit
    const pageRows = newestRows.slice(0, limit).reverse()
    const oldest = pageRows[0]

    return [
      {
        ...conversation,
        messages: pageRows,
        messagePageInfo: {
          loadedCount: pageRows.length,
          totalCount: conversation.messageCount,
          hasMoreBefore,
          nextBefore: hasMoreBefore && oldest ? toIsoString(oldest.createdAt) : null,
        },
      },
    ]
  }

  const messages = await db
    .select()
    .from(zenMessages)
    .where(
      inArray(
        zenMessages.conversationId,
        conversations.map((conversation) => conversation.id)
      )
    )
    .orderBy(asc(zenMessages.createdAt))
  const messagesByConversation = new Map<string, MessageRow[]>()

  for (const message of messages) {
    messagesByConversation.set(message.conversationId, [
      ...(messagesByConversation.get(message.conversationId) ?? []),
      message,
    ])
  }

  return conversations.map((conversation) => ({
    ...conversation,
    messages: messagesByConversation.get(conversation.id) ?? [],
  }))
}

class NeonConversationsRepository {
  async list(
    userId: string,
    options: ConversationListOptions = {}
  ): Promise<Conversation[]> {
    const rows = await loadConversationRows(userId, undefined, options)

    return await Promise.all(rows.map(rowToConversation))
  }

  async listSummaries(userId: string): Promise<ConversationSummary[]> {
    const conversations = await this.list(userId, { includeMessages: false })
    return sortConversationSummaries(
      conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        mode: conversation.mode,
        projectId: conversation.projectId,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        isPinned: conversation.isPinned,
        preview: conversation.preview,
        messageCount: conversation.messageCount,
        sessionSettings: conversation.sessionSettings,
        memorySummary: conversation.memorySummary,
        memoryUpdatedAt: conversation.memoryUpdatedAt,
        customAssistantId: conversation.customAssistantId,
        customAssistant: conversation.customAssistant,
      }))
    )
  }

  async get(
    userId: string,
    id: string,
    options: Pick<ConversationListOptions, 'messageLimit'> = {}
  ): Promise<Conversation | null> {
    const rows = await loadConversationRows(userId, id, options)
    return rows[0] ? await rowToConversation(rows[0]) : null
  }

  async listMessagesPage(
    userId: string,
    conversationId: string,
    options: { limit?: number | null; before?: Date | null } = {}
  ): Promise<ConversationMessagesPageResponse | null> {
    const conversation = await this.get(userId, conversationId, {
      messageLimit: 1,
    })
    if (!conversation) return null

    const limit = normalizeMessageLimit(options.limit)
    const conditions: SQL[] = [eq(zenMessages.conversationId, conversationId)]

    if (options.before) {
      conditions.push(lt(zenMessages.createdAt, options.before))
    }

    const rows = await getDatabaseClient()
      .select()
      .from(zenMessages)
      .where(and(...conditions))
      .orderBy(desc(zenMessages.createdAt))
      .limit(limit + 1)
    const hasMoreBefore = rows.length > limit
    const pageRows = rows.slice(0, limit).reverse()
    const messages = await Promise.all(pageRows.map(rowToMessage))
    const oldest = messages[0]

    return {
      conversationId,
      messages,
      hasMoreBefore,
      nextBefore: hasMoreBefore && oldest ? oldest.createdAt : null,
    }
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

  private async assertConversationWritable(
    userId: string,
    conversationId: string
  ): Promise<void> {
    const existing = await getDatabaseClient()
      .select({ userId: zenConversations.userId })
      .from(zenConversations)
      .where(eq(zenConversations.id, conversationId))
      .limit(1)

    if (existing[0] && existing[0].userId !== userId) {
      throw new Error('Conversation already exists for another user.')
    }
  }

  private async upsertConversationHeader(
    userId: string,
    conversation: Conversation
  ): Promise<void> {
    await neonUsersRepository.ensureUserReference(userId)
    await this.assertConversationWritable(userId, conversation.id)

    const normalizedConversation = updateConversationSnapshot(conversation, {
      projectId: conversation.projectId ?? DEFAULT_PROJECT_ID,
    })
    const values = conversationToInsert(userId, normalizedConversation)
    await getDatabaseClient()
      .insert(zenConversations)
      .values(values)
      .onConflictDoUpdate({
        target: zenConversations.id,
        set: {
          projectId: values.projectId,
          title: values.title,
          mode: values.mode,
          assistantFamily: values.assistantFamily,
          isPinned: values.isPinned,
          preview: values.preview,
          messageCount: values.messageCount,
          sessionSettings: values.sessionSettings,
          customAssistantId: values.customAssistantId,
          customAssistant: values.customAssistant,
          usage: values.usage,
          memorySummary: values.memorySummary,
          memoryUpdatedAt: values.memoryUpdatedAt,
          updatedAt: values.updatedAt,
        },
      })
  }

  private async upsertMessages(
    conversationId: string,
    messages: Message[]
  ): Promise<void> {
    if (messages.length === 0) return

    const values = messages.map((message) => messageToInsert(conversationId, message))
    await getDatabaseClient()
      .insert(zenMessages)
      .values(values)
      .onConflictDoUpdate({
        target: zenMessages.id,
        set: {
          role: sql`excluded.role`,
          content: sql`excluded.content`,
          mode: sql`excluded.mode`,
          assistantFamily: sql`excluded.assistant_family`,
          status: sql`excluded.status`,
          model: sql`excluded.model`,
          provider: sql`excluded.provider`,
          error: sql`excluded.error`,
          parentUserMessageId: sql`excluded.parent_user_message_id`,
          branchLabel: sql`excluded.branch_label`,
          customAssistantId: sql`excluded.custom_assistant_id`,
          customAssistant: sql`excluded.custom_assistant`,
          attachments: sql`excluded.attachments`,
          usage: sql`excluded.usage`,
          sources: sql`excluded.sources`,
          createdAt: sql`excluded.created_at`,
        },
      })
  }

  private async deleteMessagesAfter(
    conversationId: string,
    messageId: string
  ): Promise<void> {
    const db = getDatabaseClient()
    const rows = await db
      .select({ createdAt: zenMessages.createdAt })
      .from(zenMessages)
      .where(
        and(
          eq(zenMessages.conversationId, conversationId),
          eq(zenMessages.id, messageId)
        )
      )
      .limit(1)

    if (!rows[0]) return

    await db
      .delete(zenMessages)
      .where(
        and(
          eq(zenMessages.conversationId, conversationId),
          gt(zenMessages.createdAt, rows[0].createdAt)
        )
      )
  }

  private async refreshConversationHeaderFromMessages(
    userId: string,
    conversation: Conversation
  ): Promise<void> {
    const db = getDatabaseClient()
    const [summaryRow] = await db
      .select({
        messageCount: sql<number>`count(*)::int`,
        latestContent: sql<string | null>`(array_agg(${zenMessages.content} order by ${zenMessages.createdAt} desc) filter (where ${zenMessages.role} <> 'system'))[1]`,
        promptTokens: sql<number>`coalesce(sum((${zenMessages.usage}->>'promptTokens')::numeric), 0)::float8`,
        completionTokens: sql<number>`coalesce(sum((${zenMessages.usage}->>'completionTokens')::numeric), 0)::float8`,
        totalTokens: sql<number>`coalesce(sum((${zenMessages.usage}->>'totalTokens')::numeric), 0)::float8`,
        rawCostUsd: sql<number>`coalesce(sum((${zenMessages.usage}->>'rawCostUsd')::numeric), 0)::float8`,
        displayedCostUsd: sql<number>`coalesce(sum((${zenMessages.usage}->>'displayedCostUsd')::numeric), 0)::float8`,
        estimatedCostUsd: sql<number>`coalesce(sum((${zenMessages.usage}->>'estimatedCostUsd')::numeric), 0)::float8`,
        displayMultiplier: sql<number>`coalesce((array_agg((${zenMessages.usage}->>'displayMultiplier')::numeric order by ${zenMessages.createdAt} desc) filter (where ${zenMessages.usage} is not null))[1], 1)::float8`,
        marginUsd: sql<number>`coalesce(sum((${zenMessages.usage}->>'marginUsd')::numeric), 0)::float8`,
        creditsConsumed: sql<number>`coalesce(sum((${zenMessages.usage}->>'creditsConsumed')::numeric), 0)::float8`,
        imageCount: sql<number>`coalesce(sum((${zenMessages.usage}->>'imageCount')::numeric), 0)::float8`,
      })
      .from(zenMessages)
      .where(eq(zenMessages.conversationId, conversation.id))
    const usage = conversationUsageAggregateToEstimate(summaryRow)

    await db
      .update(zenConversations)
      .set({
        preview: summaryRow?.latestContent
          ? summaryRow.latestContent.replace(/\s+/g, ' ').trim().slice(0, 120)
          : conversation.preview,
        messageCount:
          Number(summaryRow?.messageCount) || conversation.messageCount,
        usage,
        updatedAt: toDate(conversation.updatedAt),
      })
      .where(and(eq(zenConversations.userId, userId), eq(zenConversations.id, conversation.id)))
  }

  async save(userId: string, conversation: Conversation): Promise<Conversation> {
    await this.upsertConversationHeader(userId, conversation)
    await this.upsertMessages(conversation.id, conversation.messages)
    await this.refreshConversationHeaderFromMessages(userId, conversation)

    const saved = await this.get(userId, conversation.id)

    if (!saved) {
      throw new Error('Unable to load saved conversation from Neon.')
    }

    return saved
  }

  async saveTurnStart(
    userId: string,
    input: {
      conversation: Conversation
      userMessage: Message
      assistantPlaceholder: Message
      action: ChatPersistenceAction
    }
  ): Promise<Conversation> {
    const messages = [
      ...input.conversation.messages.filter(
        (message) => message.id !== input.assistantPlaceholder.id
      ),
      input.assistantPlaceholder,
    ]
    const conversation = updateConversationSnapshot(input.conversation, {
      messages,
    })

    await this.upsertConversationHeader(userId, conversation)

    if (
      input.action === 'retry' ||
      input.action === 'regenerate' ||
      input.action === 'edit-last-user'
    ) {
      await this.deleteMessagesAfter(conversation.id, input.userMessage.id)
    }

    await this.upsertMessages(conversation.id, [
      input.userMessage,
      input.assistantPlaceholder,
    ])
    await this.refreshConversationHeaderFromMessages(userId, conversation)

    const saved = await this.get(userId, conversation.id, {
      messageLimit: DEFAULT_MESSAGE_PAGE_LIMIT,
    })

    if (!saved) {
      throw new Error('Unable to load saved conversation from Neon.')
    }

    return saved
  }

  async saveAssistantCompletion(
    userId: string,
    conversation: Conversation,
    assistantMessage: Message
  ): Promise<Conversation> {
    await this.upsertConversationHeader(userId, conversation)
    await this.upsertMessages(conversation.id, [assistantMessage])
    await this.refreshConversationHeaderFromMessages(userId, conversation)

    const saved = await this.get(userId, conversation.id, {
      messageLimit: DEFAULT_MESSAGE_PAGE_LIMIT,
    })

    if (!saved) {
      throw new Error('Unable to load saved conversation from Neon.')
    }

    return saved
  }

  async markAssistantMessageError(
    userId: string,
    input: {
      conversationId: string
      messageId: string
      content?: string
      error: string
      sources?: MessageSource[]
    }
  ): Promise<Conversation | null> {
    const conversation = await this.get(userId, input.conversationId, {
      messageLimit: DEFAULT_MESSAGE_PAGE_LIMIT,
    })
    if (!conversation) return null

    await getDatabaseClient()
      .update(zenMessages)
      .set({
        content: input.content ?? '',
        status: 'error',
        error: input.error,
        sources: input.sources ?? [],
      })
      .where(
        and(
          eq(zenMessages.conversationId, input.conversationId),
          eq(zenMessages.id, input.messageId)
        )
      )

    await this.refreshConversationHeaderFromMessages(userId, conversation)
    return await this.get(userId, input.conversationId, {
      messageLimit: DEFAULT_MESSAGE_PAGE_LIMIT,
    })
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
    const existing = await this.get(userId, id)
    if (!existing) return

    await getDatabaseClient()
      .delete(zenConversations)
      .where(and(eq(zenConversations.userId, userId), eq(zenConversations.id, id)))
  }

  async removeFileAttachmentAccess(userId: string, fileId: string): Promise<void> {
    const db = getDatabaseClient()
    const candidateRows = await db
      .select({ message: zenMessages })
      .from(zenMessages)
      .innerJoin(
        zenConversations,
        eq(zenConversations.id, zenMessages.conversationId)
      )
      .where(
        and(
          eq(zenConversations.userId, userId),
          sql`${zenMessages.attachments} @> ${JSON.stringify([{ fileId }])}::jsonb`
        )
      )

    await Promise.all(
      candidateRows.map(async ({ message }) => {
        const attachments = toJsonArray<Attachment>(message.attachments)
        const nextAttachments = attachments.map((attachment) => {
          if (attachment.fileId !== fileId) return attachment

          return {
            id: attachment.id,
            kind: attachment.kind,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            createdAt: attachment.createdAt,
            textContent: attachment.textContent,
            textExcerpt: attachment.textExcerpt,
            isExtracted: attachment.isExtracted,
          }
        })

        await db
          .update(zenMessages)
          .set({ attachments: nextAttachments })
          .where(eq(zenMessages.id, message.id))
      })
    )
  }
}

export const neonConversationRepository = new NeonConversationsRepository()
