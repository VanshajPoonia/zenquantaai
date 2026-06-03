import { describe, expect, it } from 'vitest'
import {
  assertSafeObjectKey,
  assertSafeObjectRef,
  assertSafePrivateFileSize,
  MAX_PRIVATE_FILE_BYTES,
  normalizeMimeType,
  parseValidatedDataUrl,
} from '@/lib/storage/security'

describe('storage security helpers', () => {
  it('normalizes unsafe MIME values to octet stream', () => {
    expect(normalizeMimeType(' IMAGE/PNG ')).toBe('image/png')
    expect(normalizeMimeType('text/plain')).toBe('text/plain')
    expect(normalizeMimeType('text/plain\r\nx-bad: 1')).toBe(
      'application/octet-stream'
    )
    expect(normalizeMimeType('')).toBe('application/octet-stream')
  })

  it('rejects object keys that can escape expected prefixes', () => {
    expect(() => assertSafeObjectKey('user/attachments/file.txt')).not.toThrow()
    expect(() => assertSafeObjectKey('../file.txt')).toThrow()
    expect(() => assertSafeObjectKey('/user/file.txt')).toThrow()
    expect(() => assertSafeObjectKey('user//file.txt')).toThrow()
    expect(() => assertSafeObjectKey('user\\file.txt')).toThrow()
  })

  it('rejects invalid object bucket or key pairs', () => {
    expect(() =>
      assertSafeObjectRef({ bucket: 'zenquanta-files', key: 'user/file.txt' })
    ).not.toThrow()
    expect(() =>
      assertSafeObjectRef({ bucket: '../secret', key: 'user/file.txt' })
    ).toThrow()
  })

  it('validates base64 data URLs and allowed MIME prefixes', () => {
    const parsed = parseValidatedDataUrl({
      dataUrl: `data:image/png;base64,${Buffer.from('png').toString('base64')}`,
      allowedMimePrefix: 'image/',
      maxBytes: 100,
      label: 'Image',
    })

    expect(parsed?.mimeType).toBe('image/png')
    expect(parsed?.buffer.toString()).toBe('png')
    expect(() =>
      parseValidatedDataUrl({
        dataUrl: `data:text/plain;base64,${Buffer.from('x').toString('base64')}`,
        allowedMimePrefix: 'image/',
        label: 'Image',
      })
    ).toThrow()
    expect(() =>
      parseValidatedDataUrl({
        dataUrl: 'data:image/png;base64,%%%%',
        allowedMimePrefix: 'image/',
        label: 'Image',
      })
    ).toThrow()
  })

  it('enforces the private file size cap', () => {
    expect(() =>
      assertSafePrivateFileSize(Buffer.alloc(MAX_PRIVATE_FILE_BYTES), 'File')
    ).not.toThrow()
    expect(() =>
      assertSafePrivateFileSize(Buffer.alloc(MAX_PRIVATE_FILE_BYTES + 1), 'File')
    ).toThrow()
  })
})
