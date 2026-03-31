import { Attachment } from '@/types'
import { createId } from '@/lib/utils/chat'
import { supabaseStorageUpload } from './supabase'

export const ZEN_ATTACHMENT_BUCKET = 'zen-attachments'

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

export async function uploadAttachmentBinary(input: {
  userId: string
  attachmentId?: string
  fileName: string
  mimeType: string
  bytes: Buffer
}): Promise<Pick<Attachment, 'bucket' | 'storagePath'>> {
  const attachmentId = input.attachmentId ?? createId('att')
  const safeName = sanitizeSegment(input.fileName || 'attachment')
  const storagePath = `${input.userId}/${attachmentId}-${safeName || 'file'}`

  await supabaseStorageUpload({
    bucket: ZEN_ATTACHMENT_BUCKET,
    path: storagePath,
    contentType: input.mimeType || 'application/octet-stream',
    body: input.bytes,
    upsert: true,
  })

  return {
    bucket: ZEN_ATTACHMENT_BUCKET,
    storagePath,
  }
}

export async function uploadImportedAttachment(
  userId: string,
  attachment: Attachment
): Promise<Attachment> {
  if (attachment.bucket && attachment.storagePath) {
    return attachment
  }

  const dataUrlUpload =
    attachment.previewUrl && attachment.previewUrl.startsWith('data:')
      ? dataUrlToBuffer(attachment.previewUrl)
      : null

  if (!dataUrlUpload) {
    return {
      ...attachment,
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
