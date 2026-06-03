export const MAX_PRIVATE_FILE_BYTES = 25 * 1024 * 1024

const MIME_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,126}[a-z0-9]$/i

export function normalizeMimeType(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() || ''
  if (!normalized || normalized.length > 120 || !MIME_TYPE_PATTERN.test(normalized)) {
    return 'application/octet-stream'
  }
  return normalized
}

export function assertSafePrivateFileSize(bytes: Buffer, label = 'File'): void {
  if (bytes.byteLength > MAX_PRIVATE_FILE_BYTES) {
    throw new Error(`${label} exceeds the 25MB upload limit.`)
  }
}

export function assertSafeObjectBucket(bucket: string): void {
  if (
    !bucket ||
    bucket !== bucket.trim() ||
    bucket.includes('/') ||
    bucket.includes('\\') ||
    bucket.includes('..') ||
    /[\0-\x1F\x7F]/.test(bucket) ||
    !BUCKET_PATTERN.test(bucket)
  ) {
    throw new Error('Invalid object storage bucket.')
  }
}

export function assertSafeObjectKey(key: string): void {
  if (
    !key ||
    key !== key.trim() ||
    key.length > 1024 ||
    key.startsWith('/') ||
    key.endsWith('/') ||
    key.includes('\\') ||
    /[\0-\x1F\x7F]/.test(key)
  ) {
    throw new Error('Invalid object storage path.')
  }

  const segments = key.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Invalid object storage path.')
  }
}

export function assertSafeObjectRef(input: {
  bucket: string
  key: string
}): void {
  assertSafeObjectBucket(input.bucket)
  assertSafeObjectKey(input.key)
}

export function parseValidatedDataUrl(input: {
  dataUrl: string
  allowedMimePrefix?: string
  maxBytes?: number
  label?: string
}): { mimeType: string; buffer: Buffer } | null {
  const match = input.dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/)
  if (!match) return null

  const mimeType = normalizeMimeType(match[1])
  if (
    input.allowedMimePrefix &&
    !mimeType.startsWith(input.allowedMimePrefix.toLowerCase())
  ) {
    throw new Error(`${input.label ?? 'Data URL'} must use an allowed MIME type.`)
  }

  const base64 = match[2].replace(/\s/g, '')
  if (
    !base64 ||
    base64.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    throw new Error(`${input.label ?? 'Data URL'} is not valid base64.`)
  }

  const buffer = Buffer.from(base64, 'base64')
  if (input.maxBytes && buffer.byteLength > input.maxBytes) {
    throw new Error(`${input.label ?? 'Data URL'} exceeds the 25MB upload limit.`)
  }

  return { mimeType, buffer }
}
