import 'server-only'

import { Attachment, Conversation, Message } from '@/types'
import {
  neonGeneratedImagesRepository,
} from '@/lib/db/repositories'
import { updateConversationSnapshot } from '@/lib/utils/chat'
import { uploadAttachmentBinary } from './attachments'
import { createPrivateFileUrl } from './object-store'

function dataUrlToBuffer(dataUrl: string): {
  mimeType: string
  buffer: Buffer
} | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  ) {
    return true
  }

  const parts = normalized.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false
  }

  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function assertSafeGeneratedImageUrl(value: string): void {
  if (value.startsWith('data:')) {
    if (!value.startsWith('data:image/')) {
      throw new Error('Generated image data URL must be an image.')
    }
    return
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Generated image URL is invalid.')
  }

  if (url.protocol !== 'https:' || isPrivateHostname(url.hostname)) {
    throw new Error('Generated image URL is not an allowed external image URL.')
  }
}

async function imageUrlToBuffer(url: string): Promise<{
  mimeType: string
  buffer: Buffer
}> {
  assertSafeGeneratedImageUrl(url)

  if (url.startsWith('data:')) {
    const parsed = dataUrlToBuffer(url)
    if (!parsed) {
      throw new Error('Generated image data URL is invalid.')
    }
    return parsed
  }

  const response = await fetch(url, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Unable to fetch generated image for storage.')
  }

  return {
    mimeType: response.headers.get('content-type') || 'image/png',
    buffer: Buffer.from(await response.arrayBuffer()),
  }
}

function generatedImageName(attachment: Attachment): string {
  const trimmed = attachment.name.trim()
  if (trimmed) return trimmed
  return attachment.mimeType === 'image/svg+xml'
    ? 'generated-concept.svg'
    : 'generated-visual.png'
}

export async function storeGeneratedImageAttachment(input: {
  userId: string
  projectId?: string | null
  conversationId: string
  messageId: string
  prompt: string
  model: string
  attachment: Attachment
  sourceUrl?: string | null
}): Promise<Attachment> {
  const previewUrl = input.attachment.previewUrl
  if (!previewUrl) {
    return input.attachment
  }

  const image = await imageUrlToBuffer(previewUrl)
  const fileName = generatedImageName(input.attachment)
  const uploaded = await uploadAttachmentBinary({
    userId: input.userId,
    attachmentId: input.attachment.id,
    fileName,
    mimeType: image.mimeType || input.attachment.mimeType || 'image/png',
    bytes: image.buffer,
    projectId: input.projectId ?? null,
    conversationId: input.conversationId,
    messageId: input.messageId,
    folder: 'generated-images',
  })
  await neonGeneratedImagesRepository.create({
    userId: input.userId,
    projectId: input.projectId ?? null,
    conversationId: input.conversationId,
    messageId: input.messageId,
    imageGenerationEventId: null,
    provider: 'openrouter',
    model: input.model,
    prompt: input.prompt,
    negativePrompt: null,
    storageProvider: uploaded.storageProvider ?? 'external',
    storageBucket: uploaded.bucket ?? null,
    storagePath: uploaded.storagePath ?? null,
    sourceUrl:
      input.sourceUrl && !input.sourceUrl.startsWith('data:')
        ? input.sourceUrl
        : null,
    width: null,
    height: null,
    status: 'stored',
    isFavorite: false,
    metadata: {
      attachmentId: input.attachment.id,
      fileId: uploaded.fileId,
    },
  })

  return {
    ...input.attachment,
    name: fileName,
    mimeType: image.mimeType || input.attachment.mimeType,
    size: image.buffer.byteLength,
    bucket: uploaded.bucket,
    storagePath: uploaded.storagePath,
    fileId: uploaded.fileId,
    storageProvider: uploaded.storageProvider,
    previewUrl:
      uploaded.bucket && uploaded.storagePath
        ? createPrivateFileUrl({
            bucket: uploaded.bucket,
            storagePath: uploaded.storagePath,
          })
        : undefined,
  }
}

export async function storeLatestGeneratedImageInConversation(input: {
  userId: string
  conversation: Conversation
  prompt: string
  model: string
  sourceUrl?: string | null
}): Promise<Conversation> {
  const targetIndex = [...input.conversation.messages]
    .reverse()
    .findIndex(
      (message) =>
        message.role === 'assistant' &&
        message.mode === 'image' &&
        (message.attachments ?? []).some((attachment) => attachment.kind === 'image')
    )

  if (targetIndex === -1) return input.conversation

  const messageIndex = input.conversation.messages.length - 1 - targetIndex
  const nextMessages: Message[] = await Promise.all(
    input.conversation.messages.map(async (message, index) => {
      if (index !== messageIndex) return message

      return {
        ...message,
        attachments: await Promise.all(
          (message.attachments ?? []).map((attachment) =>
            attachment.kind === 'image'
              ? storeGeneratedImageAttachment({
                  userId: input.userId,
                  projectId: input.conversation.projectId ?? null,
                  conversationId: input.conversation.id,
                  messageId: message.id,
                  prompt: input.prompt,
                  model: input.model,
                  attachment,
                  sourceUrl: input.sourceUrl,
                })
              : attachment
          )
        ),
      }
    })
  )

  return updateConversationSnapshot({
    ...input.conversation,
    messages: nextMessages,
    attachments: nextMessages.flatMap((message) => message.attachments ?? []),
  })
}
