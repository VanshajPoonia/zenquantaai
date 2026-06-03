import { describe, expect, it } from 'vitest'
import { normalizeFileKnowledge } from '@/lib/files/intelligence'
import { getAttachmentKind, serializeAttachment, toAttachmentContext } from '@/lib/utils/files'
import { PendingAttachment } from '@/types'

function makeFile(name: string, type: string): File {
  return new File(['hello'], name, { type })
}

describe('file helper pure logic', () => {
  it('detects common attachment kinds', () => {
    expect(getAttachmentKind(makeFile('photo.png', 'image/png'))).toBe('image')
    expect(getAttachmentKind(makeFile('notes.txt', 'text/plain'))).toBe('code')
    expect(getAttachmentKind(makeFile('component.tsx', ''))).toBe('code')
    expect(getAttachmentKind(makeFile('paper.pdf', 'application/pdf'))).toBe('pdf')
    expect(getAttachmentKind(makeFile('paper.pdf', ''))).toBe('pdf')
    expect(getAttachmentKind(makeFile('report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe('document')
    expect(getAttachmentKind(makeFile('archive.bin', 'application/octet-stream'))).toBe('other')
  })

  it('normalizes file knowledge metadata safely', () => {
    expect(
      normalizeFileKnowledge({
        knowledgeBase: {
          status: 'indexed',
          chunkCount: 3,
          embeddingModel: 'text-embedding-3-small',
          updatedAt: '2026-06-03T00:00:00.000Z',
        },
      })
    ).toMatchObject({
      knowledgeStatus: 'indexed',
      knowledgeStatusLabel: 'Indexed',
      knowledgeReason: null,
      chunkCount: 3,
      embeddingModel: 'text-embedding-3-small',
    })

    expect(
      normalizeFileKnowledge({
        knowledgeBase: { status: 'skipped_not_configured' },
      })
    ).toMatchObject({
      knowledgeStatus: 'skipped',
      knowledgeReason: 'Embedding provider is not configured.',
    })

    expect(
      normalizeFileKnowledge({
        knowledgeBase: {
          status: 'failed',
          reason: 'secret provider stack trace should not appear',
        },
      })
    ).toMatchObject({
      knowledgeStatus: 'failed',
      knowledgeReason: 'Indexing failed. Try re-indexing this file.',
    })

    expect(normalizeFileKnowledge({})).toMatchObject({
      knowledgeStatus: 'pending',
      knowledgeReason: 'Indexing state has not been recorded yet.',
    })
  })

  it('serializes pending attachments without the File object', () => {
    const pending: PendingAttachment = {
      id: 'att_1',
      kind: 'text',
      name: 'notes.txt',
      mimeType: 'text/plain',
      size: 5,
      createdAt: '2026-06-03T00:00:00.000Z',
      file: makeFile('notes.txt', 'text/plain'),
      textContent: 'hello',
    }

    const serialized = serializeAttachment(pending)
    expect('file' in serialized).toBe(false)
    expect(toAttachmentContext(serialized)).toEqual({
      id: 'att_1',
      name: 'notes.txt',
      kind: 'text',
      mimeType: 'text/plain',
      textContent: 'hello',
    })
  })
})
