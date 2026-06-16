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
const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/docx',
])
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

export function isDocxKnowledgeFile(input: {
  fileName: string
  mimeType: string
}): boolean {
  const mimeType = input.mimeType.toLowerCase()
  const extension = extensionOf(input.fileName)

  return DOCX_MIME_TYPES.has(mimeType) || extension === 'docx'
}

function isJsonKnowledgeFile(input: { fileName: string; mimeType: string }): boolean {
  return (
    input.mimeType.toLowerCase() === 'application/json' ||
    extensionOf(input.fileName) === 'json'
  )
}

function isCsvKnowledgeFile(input: { fileName: string; mimeType: string }): boolean {
  const mimeType = input.mimeType.toLowerCase()
  const extension = extensionOf(input.fileName)
  return (
    mimeType === 'text/csv' ||
    mimeType === 'application/csv' ||
    extension === 'csv'
  )
}

function isMarkdownKnowledgeFile(input: { fileName: string; mimeType: string }): boolean {
  const mimeType = input.mimeType.toLowerCase()
  const extension = extensionOf(input.fileName)
  return (
    mimeType === 'text/markdown' ||
    mimeType === 'text/x-markdown' ||
    extension === 'md' ||
    extension === 'mdx'
  )
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
  const replacementCount = (sample.match(/�/g) ?? []).length
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

async function extractTextFromDocxBytes(input: {
  bytes: Buffer
}): Promise<ExtractedFileText> {
  const mammoth = await import('mammoth')

  try {
    const result = await mammoth.extractRawText({ buffer: input.bytes })
    const normalized = normalizeExtractedText(result.value).slice(0, MAX_EXTRACTED_CHARS)

    if (!normalized) {
      return {
        text: '',
        status: 'empty',
        reason: 'No text content was found in the DOCX file.',
      }
    }

    return { text: normalized, status: 'extracted' }
  } catch {
    return {
      text: '',
      status: 'unsupported',
      reason: 'The DOCX file could not be parsed. It may be encrypted or corrupted.',
    }
  }
}

function extractTextFromJsonBytes(input: { bytes: Buffer }): ExtractedFileText {
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(input.bytes)

  if (looksBinary(raw)) {
    return {
      text: '',
      status: 'unsupported',
      reason: 'The file could not be decoded as text.',
    }
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const pretty = JSON.stringify(parsed, null, 2)
    const normalized = normalizeExtractedText(pretty).slice(0, MAX_EXTRACTED_CHARS)

    if (!normalized) {
      return {
        text: '',
        status: 'empty',
        reason: 'JSON parsed but produced no extractable content.',
      }
    }

    return { text: normalized, status: 'extracted' }
  } catch {
    return {
      text: '',
      status: 'unsupported',
      reason: 'The file is not valid JSON and could not be indexed.',
    }
  }
}

// Minimal RFC 4180 CSV parser. Caps input scanning at 2× MAX_EXTRACTED_CHARS
// to avoid scanning multi-million-row files, and stops after maxRows rows.
function parseCsvRows(input: string, maxRows: number): string[][] {
  const rows: string[][] = []
  let i = 0
  const scanLimit = Math.min(input.length, MAX_EXTRACTED_CHARS * 2)

  while (i < scanLimit && rows.length < maxRows) {
    const row: string[] = []

    while (i < scanLimit) {
      let field = ''

      if (input[i] === '"') {
        // Quoted field — handles embedded commas, newlines, and escaped quotes ("")
        i++ // skip opening quote
        while (i < scanLimit) {
          if (input[i] === '"') {
            if (input[i + 1] === '"') {
              field += '"'
              i += 2
            } else {
              i++ // skip closing quote
              break
            }
          } else {
            field += input[i++]
          }
        }
      } else {
        // Unquoted field — read until comma or end of record
        while (
          i < scanLimit &&
          input[i] !== ',' &&
          input[i] !== '\n' &&
          !(input[i] === '\r' && input[i + 1] === '\n')
        ) {
          field += input[i++]
        }
      }

      row.push(field.trim())

      if (
        i >= scanLimit ||
        input[i] === '\n' ||
        (input[i] === '\r' && input[i + 1] === '\n')
      ) {
        if (i < scanLimit && input[i] === '\r') i++
        if (i < scanLimit) i++
        break
      }

      if (input[i] === ',') i++
    }

    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row)
    }
  }

  return rows
}

function extractTextFromCsvBytes(input: { bytes: Buffer }): ExtractedFileText {
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(input.bytes)

  if (looksBinary(raw)) {
    return {
      text: '',
      status: 'unsupported',
      reason: 'The file could not be decoded as text.',
    }
  }

  const rows = parseCsvRows(raw, 10_000)

  if (rows.length === 0) {
    return { text: '', status: 'empty', reason: 'CSV file contains no data.' }
  }

  const headers = rows[0]
  const dataRows = rows.slice(1)

  if (dataRows.length === 0) {
    return {
      text: '',
      status: 'empty',
      reason: 'CSV file has headers but no data rows.',
    }
  }

  const lines: string[] = [`Columns: ${headers.join(', ')}`, '']
  let charCount = lines.join('\n').length

  for (const row of dataRows) {
    const pairs = headers
      .map((header, colIndex) => {
        const value = row[colIndex] ?? ''
        return value ? `${header}: ${value}` : null
      })
      .filter((pair): pair is string => pair !== null)

    if (pairs.length > 0) {
      const line = pairs.join(' | ')
      lines.push(line)
      charCount += line.length + 1
      if (charCount >= MAX_EXTRACTED_CHARS) break
    }
  }

  const normalized = normalizeExtractedText(lines.join('\n')).slice(
    0,
    MAX_EXTRACTED_CHARS
  )

  if (!normalized) {
    return {
      text: '',
      status: 'empty',
      reason: 'CSV file produced no extractable content.',
    }
  }

  return { text: normalized, status: 'extracted' }
}

function extractTextFromMarkdownBytes(input: { bytes: Buffer }): ExtractedFileText {
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(input.bytes)

  if (looksBinary(raw)) {
    return {
      text: '',
      status: 'unsupported',
      reason: 'The file could not be decoded as text.',
    }
  }

  // Strip markdown rendering syntax while keeping prose content.
  // Order matters: fenced blocks and inline code must be stripped before
  // bold/italic markers to avoid corrupting code content.
  const stripped = raw
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/___([^_\n]+)___/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[ \t]*[-*+]\s+/gm, '')
    .replace(/^[ \t]*\d+\.\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\|[-|: ]+\|$/gm, '')
    .replace(/\|/g, ' ')

  const normalized = normalizeExtractedText(stripped).slice(0, MAX_EXTRACTED_CHARS)

  if (!normalized) {
    return {
      text: '',
      status: 'empty',
      reason: 'No extractable content found in markdown file.',
    }
  }

  return { text: normalized, status: 'extracted' }
}

export async function extractTextFromFileBytes(input: {
  bytes: Buffer
  fileName: string
  mimeType: string
}): Promise<ExtractedFileText> {
  if (isPdfKnowledgeFile(input)) {
    return extractTextFromPdfBytes({ bytes: input.bytes })
  }

  if (isDocxKnowledgeFile(input)) {
    return extractTextFromDocxBytes({ bytes: input.bytes })
  }

  if (!isTextKnowledgeFile(input)) {
    return {
      text: '',
      status: 'unsupported',
      reason:
        'Only text, code-like, PDF, and DOCX files are indexed in this knowledge-base version.',
    }
  }

  if (isJsonKnowledgeFile(input)) {
    return extractTextFromJsonBytes({ bytes: input.bytes })
  }

  if (isCsvKnowledgeFile(input)) {
    return extractTextFromCsvBytes({ bytes: input.bytes })
  }

  if (isMarkdownKnowledgeFile(input)) {
    return extractTextFromMarkdownBytes({ bytes: input.bytes })
  }

  // Generic UTF-8 text and code files
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
