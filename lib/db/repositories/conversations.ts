import 'server-only'

import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { createSessionSettings, DEFAULT_PROJECT_ID } from '@/lib/config'
import { getAssistantFamilyFromMode } from '@/lib/config/assistants'
import { createPrivateFileUrl } from '@/lib/storage/object-store'
import {
  createConversation,
  sortConversationSummaries,
  toConversationSummary,
  updateConversationSnapshot,
} from '@/lib/utils/chat'
import {
  Attachment,
  Conversation,
  ConversationMutation,
  ConversationSummary,
  CustomAssistantReference,
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
}
type MessageRow = typeof zenMessages.$inferSelect

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
        previewUrl: createPrivateFileUrl({
          bucket: attachment.bucket,
          storagePath: attachment.storagePath,
        }),
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
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map(async (messageRow) =>
        hydrateAttachments({
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
      )
  )

  const attachments = hydratedMessages.flatMap((message) => message.attachments ?? [])

  return updateConversationSnapshot({
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
  })
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
  id?: string
): Promise<ConversationRow[]> {
  const db = getDatabaseClient()
  const conversations = await db
    .select()
    .from(zenConversations)
    .where(
      id
        ? and(eq(zenConversations.userId, userId), eq(zenConversations.id, id))
        : eq(zenConversations.userId, userId)
    )
    .orderBy(desc(zenConversations.updatedAt))

  if (conversations.length === 0) {
    return []
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
  async list(userId: string): Promise<Conversation[]> {
    const rows = await loadConversationRows(userId)

    return await Promise.all(rows.map(rowToConversation))
  }

  async listSummaries(userId: string): Promise<ConversationSummary[]> {
    const conversations = await this.list(userId)
    return sortConversationSummaries(conversations.map(toConversationSummary))
  }

  async get(userId: string, id: string): Promise<Conversation | null> {
    const rows = await loadConversationRows(userId, id)
    return rows[0] ? await rowToConversation(rows[0]) : null
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
    await neonUsersRepository.ensureUserReference(userId)

    const db = getDatabaseClient()
    const normalizedConversation = updateConversationSnapshot(conversation, {
      projectId: conversation.projectId ?? DEFAULT_PROJECT_ID,
    })
    const existing = await db
      .select({ userId: zenConversations.userId })
      .from(zenConversations)
      .where(eq(zenConversations.id, normalizedConversation.id))
      .limit(1)

    if (existing[0] && existing[0].userId !== userId) {
      throw new Error('Conversation already exists for another user.')
    }

    const values = conversationToInsert(userId, normalizedConversation)
    await db
      .insert(zenConversations)
      .values(values)
      .onConflictDoUpdate({
        target: zenConversations.id,
        set: {
          projectId: values.projectId,
          title: values.title,
          mode: values.mode,
          isPinned: values.isPinned,
          preview: values.preview,
          messageCount: values.messageCount,
          sessionSettings: values.sessionSettings,
          usage: values.usage,
          memorySummary: values.memorySummary,
          memoryUpdatedAt: values.memoryUpdatedAt,
          updatedAt: values.updatedAt,
        },
      })

    await db
      .delete(zenMessages)
      .where(eq(zenMessages.conversationId, normalizedConversation.id))

    if (normalizedConversation.messages.length > 0) {
      await db.insert(zenMessages).values(
        normalizedConversation.messages.map((message) =>
          messageToInsert(normalizedConversation.id, message)
        )
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
    const existing = await this.get(userId, id)
    if (!existing) return

    await getDatabaseClient()
      .delete(zenConversations)
      .where(and(eq(zenConversations.userId, userId), eq(zenConversations.id, id)))
  }

  async removeFileAttachmentAccess(userId: string, fileId: string): Promise<void> {
    const conversations = await this.list(userId)
    const affected = conversations.filter((conversation) =>
      conversation.messages.some((message) =>
        (message.attachments ?? []).some((attachment) => attachment.fileId === fileId)
      )
    )

    await Promise.all(
      affected.map((conversation) =>
        this.save(userId, {
          ...conversation,
          messages: conversation.messages.map((message) => ({
            ...message,
            attachments: (message.attachments ?? []).map((attachment) => {
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
            }),
          })),
        })
      )
    )
  }
}

export const neonConversationRepository = new NeonConversationsRepository()
