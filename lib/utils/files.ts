import {
  Attachment,
  AttachmentContext,
  AttachmentKind,
  PendingAttachment,
} from '@/types'
import { createId, nowIso } from '@/lib/utils/chat'

const TEXT_MIME_PREFIXES = ['text/']
const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/typescript',
  'application/x-sh',
  'application/x-httpd-php',
])
const TEXT_FILE_EXTENSIONS = new Set([
  'txt',
  'md',
  'mdx',
  'csv',
  'json',
  'xml',
  'yaml',
  'yml',
  'ts',
  'tsx',
  'js',
  'jsx',
  'css',
  'scss',
  'html',
  'py',
  'go',
  'java',
  'rb',
  'rs',
  'sql',
  'sh',
])

function getExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? ''
}

export function getAttachmentKind(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf' || getExtension(file.name) === 'pdf') return 'pdf'
  if (
    TEXT_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix)) ||
    TEXT_MIME_TYPES.has(file.type) ||
    TEXT_FILE_EXTENSIONS.has(getExtension(file.name))
  ) {
    return TEXT_FILE_EXTENSIONS.has(getExtension(file.name)) ? 'code' : 'text'
  }
  if (
    file.type.includes('word') ||
    file.type.includes('officedocument') ||
    file.type.includes('rtf')
  ) {
    return 'document'
  }
  if (file.type.includes('sheet') || file.type.includes('excel')) return 'spreadsheet'
  return 'other'
}

function truncateText(value: string, limit = 12000): string {
  const normalized = value.replace(/\0/g, '').replace(/\s+/g, ' ').trim()
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit).trimEnd()}\n\n[truncated]`
}

function extractPrintableStrings(input: string): string {
  const matches = input.match(/[A-Za-z0-9][A-Za-z0-9 ,.:;'"!?()[\]{}@#%&*_+=/\-]{8,}/g) ?? []
  return truncateText(matches.join('\n'))
}

async function readAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'))
    reader.readAsDataURL(file)
  })
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const decoded = new TextDecoder('latin1').decode(buffer)
  return extractPrintableStrings(decoded)
}

async function extractText(file: File): Promise<string> {
  return truncateText(await file.text())
}

export async function createPendingAttachment(file: File): Promise<PendingAttachment> {
  const kind = getAttachmentKind(file)
  const attachment: PendingAttachment = {
    id: createId('att'),
    kind,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: nowIso(),
    file,
  }

  if (kind === 'image') {
    attachment.previewUrl = await readAsDataUrl(file)
  }

  if (kind === 'pdf') {
    const textContent = await extractPdfText(file)
    if (textContent) {
      attachment.textContent = textContent
      attachment.textExcerpt = textContent.slice(0, 240)
      attachment.isExtracted = true
    }
  }

  if (kind === 'text' || kind === 'code') {
    const textContent = await extractText(file)
    attachment.textContent = textContent
    attachment.textExcerpt = textContent.slice(0, 240)
    attachment.isExtracted = true
  }

  return attachment
}

export function serializeAttachment(
  attachment: PendingAttachment | Attachment
): Attachment {
  const { file: _file, ...rest } = attachment as PendingAttachment
  return rest
}

export function toAttachmentContext(attachment: Attachment): AttachmentContext {
  return {
    id: attachment.id,
    name: attachment.name,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    textContent: attachment.textContent,
  }
}
