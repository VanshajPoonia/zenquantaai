import 'server-only'

import { createHash, createHmac } from 'crypto'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'

export type ObjectStorageProvider = 'local' | 's3' | 'r2'

export interface StoredObjectRef {
  provider: ObjectStorageProvider
  bucket: string
  key: string
}

export interface PutObjectInput {
  bucket?: string
  key: string
  contentType: string
  body: Buffer
}

export interface GetObjectInput {
  bucket: string
  key: string
}

export interface StoredObject {
  body: Buffer
  contentType: string
  contentLength: number
}

export interface ObjectStore {
  provider: ObjectStorageProvider
  bucket: string
  putObject(input: PutObjectInput): Promise<StoredObjectRef>
  getObject(input: GetObjectInput): Promise<StoredObject>
  deleteObject(input: GetObjectInput): Promise<void>
}

interface ObjectStorageConfig {
  provider: ObjectStorageProvider
  bucket: string
  localDir: string
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

const DEFAULT_BUCKET = 'zenquanta-files'
const DEFAULT_LOCAL_DIR = '.storage/zenquanta'

let objectStore: ObjectStore | null = null

function normalizeProvider(value: string | undefined): ObjectStorageProvider {
  const provider = value?.trim().toLowerCase()
  if (provider === 's3' || provider === 'r2') return provider
  return 'local'
}

export function getObjectStorageConfig(): ObjectStorageConfig {
  return {
    provider: normalizeProvider(process.env.FILE_STORAGE_PROVIDER),
    bucket: process.env.FILE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET,
    localDir:
      process.env.FILE_STORAGE_LOCAL_DIR?.trim() || DEFAULT_LOCAL_DIR,
    endpoint: process.env.FILE_STORAGE_ENDPOINT?.trim() || '',
    region: process.env.FILE_STORAGE_REGION?.trim() || 'auto',
    accessKeyId: process.env.FILE_STORAGE_ACCESS_KEY_ID?.trim() || '',
    secretAccessKey: process.env.FILE_STORAGE_SECRET_ACCESS_KEY?.trim() || '',
  }
}

function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex')
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

function formatAmzDate(date: Date): { shortDate: string; amzDate: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return {
    shortDate: iso.slice(0, 8),
    amzDate: iso,
  }
}

function encodeObjectKey(key: string): string {
  return key
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function assertS3Config(config: ObjectStorageConfig): void {
  if (
    !config.endpoint ||
    !config.accessKeyId ||
    !config.secretAccessKey ||
    !config.bucket
  ) {
    throw new Error(
      'S3-compatible file storage is missing FILE_STORAGE_ENDPOINT, FILE_STORAGE_BUCKET, FILE_STORAGE_ACCESS_KEY_ID, or FILE_STORAGE_SECRET_ACCESS_KEY.'
    )
  }
}

function createS3ObjectUrl(config: ObjectStorageConfig, bucket: string, key: string): URL {
  const endpoint = config.endpoint.replace(/\/$/, '')
  return new URL(`${endpoint}/${encodeURIComponent(bucket)}/${encodeObjectKey(key)}`)
}

function createS3Authorization(input: {
  config: ObjectStorageConfig
  method: 'GET' | 'PUT' | 'DELETE'
  url: URL
  contentType?: string
  payloadHash: string
  date: Date
}): Record<string, string> {
  const { shortDate, amzDate } = formatAmzDate(input.date)
  const credentialScope = `${shortDate}/${input.config.region}/s3/aws4_request`
  const headers: Record<string, string> = {
    host: input.url.host,
    'x-amz-content-sha256': input.payloadHash,
    'x-amz-date': amzDate,
  }

  if (input.contentType) {
    headers['content-type'] = input.contentType
  }

  const canonicalHeaderKeys = Object.keys(headers).sort()
  const canonicalHeaders = canonicalHeaderKeys
    .map((key) => `${key}:${headers[key].trim()}`)
    .join('\n')
  const signedHeaders = canonicalHeaderKeys.join(';')
  const canonicalRequest = [
    input.method,
    input.url.pathname,
    input.url.searchParams.toString(),
    `${canonicalHeaders}\n`,
    signedHeaders,
    input.payloadHash,
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')
  const signingKey = hmac(
    hmac(
      hmac(
        hmac(`AWS4${input.config.secretAccessKey}`, shortDate),
        input.config.region
      ),
      's3'
    ),
    'aws4_request'
  )
  const signature = hmac(signingKey, stringToSign).toString('hex')

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

class LocalObjectStore implements ObjectStore {
  provider: ObjectStorageProvider = 'local'
  bucket: string
  private rootDir: string

  constructor(config: ObjectStorageConfig) {
    this.bucket = config.bucket
    this.rootDir = path.resolve(
      /*turbopackIgnore: true*/ process.cwd(),
      config.localDir
    )
  }

  private resolvePath(bucket: string, key: string): string {
    const objectPath = path.resolve(this.rootDir, bucket, key)
    const bucketRoot = path.resolve(this.rootDir, bucket)

    if (objectPath !== bucketRoot && !objectPath.startsWith(`${bucketRoot}${path.sep}`)) {
      throw new Error('Invalid object storage path.')
    }

    return objectPath
  }

  async putObject(input: PutObjectInput): Promise<StoredObjectRef> {
    const bucket = input.bucket ?? this.bucket
    const filePath = this.resolvePath(bucket, input.key)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, input.body)
    await writeFile(
      `${filePath}.meta.json`,
      JSON.stringify({ contentType: input.contentType })
    )

    return {
      provider: this.provider,
      bucket,
      key: input.key,
    }
  }

  async getObject(input: GetObjectInput): Promise<StoredObject> {
    const filePath = this.resolvePath(input.bucket, input.key)
    const body = await readFile(filePath)
    const metadata = await readFile(`${filePath}.meta.json`, 'utf8')
      .then((value) => JSON.parse(value) as { contentType?: string })
      .catch(() => null)
    return {
      body,
      contentType: metadata?.contentType || 'application/octet-stream',
      contentLength: body.length,
    }
  }

  async deleteObject(input: GetObjectInput): Promise<void> {
    const filePath = this.resolvePath(input.bucket, input.key)
    await unlink(filePath).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    })
    await unlink(`${filePath}.meta.json`).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    })
  }
}

class S3CompatibleObjectStore implements ObjectStore {
  provider: ObjectStorageProvider
  bucket: string
  private config: ObjectStorageConfig

  constructor(config: ObjectStorageConfig) {
    assertS3Config(config)
    this.provider = config.provider
    this.bucket = config.bucket
    this.config = config
  }

  async putObject(input: PutObjectInput): Promise<StoredObjectRef> {
    const bucket = input.bucket ?? this.bucket
    const url = createS3ObjectUrl(this.config, bucket, input.key)
    const payloadHash = sha256Hex(input.body)
    const headers = createS3Authorization({
      config: this.config,
      method: 'PUT',
      url,
      contentType: input.contentType,
      payloadHash,
      date: new Date(),
    })
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: input.body as BodyInit,
      cache: 'no-store',
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(
        message || `Object storage upload failed with status ${response.status}.`
      )
    }

    return {
      provider: this.provider,
      bucket,
      key: input.key,
    }
  }

  async getObject(input: GetObjectInput): Promise<StoredObject> {
    const url = createS3ObjectUrl(this.config, input.bucket, input.key)
    const payloadHash = sha256Hex(Buffer.alloc(0))
    const headers = createS3Authorization({
      config: this.config,
      method: 'GET',
      url,
      payloadHash,
      date: new Date(),
    })
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(
        message || `Object storage read failed with status ${response.status}.`
      )
    }

    const body = Buffer.from(await response.arrayBuffer())
    return {
      body,
      contentType:
        response.headers.get('content-type') || 'application/octet-stream',
      contentLength: body.length,
    }
  }

  async deleteObject(input: GetObjectInput): Promise<void> {
    const url = createS3ObjectUrl(this.config, input.bucket, input.key)
    const payloadHash = sha256Hex(Buffer.alloc(0))
    const headers = createS3Authorization({
      config: this.config,
      method: 'DELETE',
      url,
      payloadHash,
      date: new Date(),
    })
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    })

    if (!response.ok && response.status !== 404) {
      const message = await response.text().catch(() => '')
      throw new Error(
        message || `Object storage delete failed with status ${response.status}.`
      )
    }
  }
}

export function getObjectStore(): ObjectStore {
  if (objectStore) return objectStore

  const config = getObjectStorageConfig()
  objectStore =
    config.provider === 'local'
      ? new LocalObjectStore(config)
      : new S3CompatibleObjectStore(config)

  return objectStore
}

export function getStorageMetadataProvider(
  provider: ObjectStorageProvider
): 'external' | 'local' {
  return provider === 'local' ? 'local' : 'external'
}

export function createPrivateFileUrl(input: {
  bucket: string
  storagePath: string
  download?: boolean
}): string {
  const params = new URLSearchParams({
    bucket: input.bucket,
    path: input.storagePath,
  })

  if (input.download) {
    params.set('download', '1')
  }

  return `/api/files/object?${params.toString()}`
}
