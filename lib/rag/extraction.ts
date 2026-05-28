import 'server-only'

import { createHash } from 'crypto'
import {
  FormatError,
  InvalidPDFException,
  PasswordException,
  PDFParse,
} from 'pdf-parse'

const TEXT_MIME_PREFIXES = ['text/']
const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/typescript',
  'application/x-sh',
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
const PDF_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf'])
const MAX_EXTRACTED_CHARS = 160_000
const MAX_CHUNK_CHARS = 1_200
const CHUNK_OVERLAP_CHARS = 180
const MIN_CHUNK_CHARS = 80

export interface ExtractedFileText {
  text: string
  status: 'extracted' | 'unsupported' | 'empty'
  reason?: string
}

export interface FileTextChunk {
  chunkIndex: number
  content: string
  contentHash: string
  tokenCountEstimate: number
  charStart: number
  charEnd: number
}

function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split('.').pop() ?? ''
}

export function isTextKnowledgeFile(input: {
  fileName: string
  mimeType: string
}): boolean {
  const mimeType = input.mimeType.toLowerCase()
  const extension = extensionOf(input.fileName)

  return (
    TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) ||
    TEXT_MIME_TYPES.has(mimeType) ||
    TEXT_FILE_EXTENSIONS.has(extension)
  )
}

export function isPdfKnowledgeFile(input: {
  fileName: string
  mimeType: string
}): boolean {
  const mimeType = input.mimeType.toLowerCase()
  const extension = extensionOf(input.fileName)

  return PDF_MIME_TYPES.has(mimeType) || extension === 'pdf'
}

function normalizeExtractedText(input: string): string {
  return input
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function looksBinary(text: string): boolean {
  if (!text) return false

  const sample = text.slice(0, 4096)
  const replacementCount = (sample.match(/\uFFFD/g) ?? []).length
  return replacementCount / sample.length > 0.05
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

async function extractTextFromPdfBytes(input: {
  bytes: Buffer
}): Promise<ExtractedFileText> {
  const parser = new PDFParse({
    data: new Uint8Array(input.bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
  })

  try {
    const result = await parser.getText({
      lineEnforce: true,
      itemJoiner: ' ',
      pageJoiner: '\n\n',
    })
    const normalized = normalizeExtractedText(result.text).slice(
      0,
      MAX_EXTRACTED_CHARS
    )

    if (!normalized) {
      return {
        text: '',
        status: 'empty',
        reason:
          'No embedded text was found. OCR/image-only PDFs are not supported yet.',
      }
    }

    return {
      text: normalized,
      status: 'extracted',
    }
  } catch (error) {
    if (error instanceof PasswordException) {
      return {
        text: '',
        status: 'unsupported',
        reason: 'Password-protected PDFs are not supported for knowledge indexing.',
      }
    }

    if (error instanceof InvalidPDFException || error instanceof FormatError) {
      return {
        text: '',
        status: 'unsupported',
        reason: 'The PDF could not be parsed as a valid text-based PDF.',
      }
    }

    throw error
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

export async function extractTextFromFileBytes(input: {
  bytes: Buffer
  fileName: string
  mimeType: string
}): Promise<ExtractedFileText> {
  if (isPdfKnowledgeFile(input)) {
    return await extractTextFromPdfBytes({ bytes: input.bytes })
  }

  if (!isTextKnowledgeFile(input)) {
    return {
      text: '',
      status: 'unsupported',
      reason:
        'Only text, code-like, and text-based PDF files are indexed in this knowledge-base version.',
    }
  }

  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(input.bytes)
  if (looksBinary(decoded)) {
    return {
      text: '',
      status: 'unsupported',
      reason: 'The file appears to be binary or not safely decodable as text.',
    }
  }

  const normalized = normalizeExtractedText(decoded).slice(0, MAX_EXTRACTED_CHARS)
  if (!normalized) {
    return {
      text: '',
      status: 'empty',
      reason: 'No extractable text was found.',
    }
  }

  return {
    text: normalized,
    status: 'extracted',
  }
}

export function chunkExtractedText(text: string): FileTextChunk[] {
  const chunks: FileTextChunk[] = []
  let cursor = 0

  while (cursor < text.length) {
    const idealEnd = Math.min(text.length, cursor + MAX_CHUNK_CHARS)
    const paragraphBreak = text.lastIndexOf('\n\n', idealEnd)
    const sentenceBreak = text.lastIndexOf('. ', idealEnd)
    const end =
      idealEnd === text.length
        ? idealEnd
        : paragraphBreak > cursor + MIN_CHUNK_CHARS
          ? paragraphBreak
          : sentenceBreak > cursor + MIN_CHUNK_CHARS
            ? sentenceBreak + 1
            : idealEnd

    const content = text.slice(cursor, end).trim()
    if (content.length >= MIN_CHUNK_CHARS || text.length <= MAX_CHUNK_CHARS) {
      chunks.push({
        chunkIndex: chunks.length,
        content,
        contentHash: hashText(content),
        tokenCountEstimate: estimateTokens(content),
        charStart: cursor,
        charEnd: end,
      })
    }

    if (end >= text.length) break
    cursor = Math.max(end - CHUNK_OVERLAP_CHARS, cursor + 1)
  }

  return chunks
}
