import { createHash } from 'crypto'
import { Attachment } from '@/types'
import { createId } from '@/lib/utils/chat'
import { neonFilesRepository } from '@/lib/db/repositories'
import { indexUploadedFileForKnowledge } from '@/lib/rag/indexing'
import {
  createPrivateFileUrl,
  getObjectStore,
  getStorageMetadataProvider,
} from './object-store'

export const ZEN_ATTACHMENT_BUCKET = 'zenquanta-files'
const LEGACY_ATTACHMENT_BUCKET = ['zen', 'attachments'].join('-')
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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

function checksum(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function assertSafeAttachmentSize(bytes: Buffer): void {
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error('Attachment exceeds the 25MB upload limit.')
  }
}

function createStoragePath(input: {
  userId: string
  attachmentId: string
  fileName: string
  folder?: string
}): string {
  const safeName = sanitizeSegment(input.fileName || 'attachment')
  const folder = sanitizeSegment(input.folder || 'attachments')
  return `${input.userId}/${folder}/${input.attachmentId}-${safeName || 'file'}`
}

export async function uploadAttachmentBinary(input: {
  userId: string
  attachmentId?: string
  fileName: string
  mimeType: string
  bytes: Buffer
  projectId?: string | null
  conversationId?: string | null
  messageId?: string | null
  folder?: string
}): Promise<
  Pick<Attachment, 'bucket' | 'storagePath' | 'fileId' | 'storageProvider' | 'previewUrl'>
> {
  assertSafeAttachmentSize(input.bytes)

  const attachmentId = input.attachmentId ?? createId('att')
  const storagePath = createStoragePath({
    userId: input.userId,
    attachmentId,
    fileName: input.fileName,
    folder: input.folder,
  })
  const objectStore = getObjectStore()
  const stored = await objectStore.putObject({
    bucket: objectStore.bucket,
    key: storagePath,
    contentType: input.mimeType || 'application/octet-stream',
    body: input.bytes,
  })

  const metadataProvider = getStorageMetadataProvider(stored.provider)
  const fileMetadata = await neonFilesRepository.create({
    userId: input.userId,
    projectId: input.projectId ?? null,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
    provider: metadataProvider,
    bucket: stored.bucket,
    storagePath: stored.key,
    publicUrl: null,
    fileName: input.fileName || 'attachment',
    mimeType: input.mimeType || 'application/octet-stream',
    byteSize: input.bytes.byteLength,
    checksum: checksum(input.bytes),
    visibility: 'private',
    metadata: {
      attachmentId,
      storageProvider: stored.provider,
    },
  })
  await indexUploadedFileForKnowledge({
    userId: input.userId,
    file: fileMetadata,
    fileName: input.fileName || 'attachment',
    mimeType: input.mimeType || 'application/octet-stream',
    bytes: input.bytes,
    projectId: input.projectId ?? null,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
  })

  return {
    bucket: stored.bucket,
    storagePath: stored.key,
    fileId: fileMetadata.id,
    storageProvider: metadataProvider,
    previewUrl: createPrivateFileUrl({
      bucket: stored.bucket,
      storagePath: stored.key,
    }),
  }
}

export async function uploadImportedAttachment(
  userId: string,
  attachment: Attachment
): Promise<Attachment> {
  const isLegacyAttachment = attachment.bucket === LEGACY_ATTACHMENT_BUCKET

  if (attachment.bucket && attachment.storagePath && !isLegacyAttachment) {
    return attachment
  }

  const dataUrlUpload =
    attachment.previewUrl && attachment.previewUrl.startsWith('data:')
      ? dataUrlToBuffer(attachment.previewUrl)
      : null

  if (!dataUrlUpload) {
    return {
      ...attachment,
      ...(isLegacyAttachment
        ? { bucket: undefined, storagePath: undefined }
        : {}),
      previewUrl: undefined,
    }
  }

  const uploaded = await uploadAttachmentBinary({
    userId,
    attachmentId: attachment.id,
    fileName: attachment.name,
    mimeType: dataUrlUpload.mimeType || attachment.mimeType,
    bytes: dataUrlUpload.buffer,
  })

  return {
    ...attachment,
    ...uploaded,
    previewUrl: undefined,
  }
}
