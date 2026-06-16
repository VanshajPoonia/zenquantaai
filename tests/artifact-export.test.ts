import { describe, expect, it } from 'vitest'
import {
  buildArtifactExport,
  getArtifactExportFilename,
  isArtifactExportFormat,
  sanitizeArtifactExportBaseName,
} from '@/lib/artifacts/export'
import { Artifact } from '@/types'

const artifact: Artifact = {
  id: 'artifact-1234567890',
  userId: 'user-private-id',
  projectId: 'project-1',
  conversationId: 'conversation-1',
  sourceMessageId: 'message-1',
  sourceType: 'chat_message',
  title: 'Launch Plan / Q3: "MVP"',
  artifactType: 'document',
  content: 'Ship the MVP.\nValidate export formats.',
  metadata: {
    tags: ['launch', 'mvp'],
    nested: {
      priority: 'high',
    },
  },
  createdAt: '2026-06-16T08:00:00.000Z',
  updatedAt: '2026-06-16T09:00:00.000Z',
}

describe('artifact export helpers', () => {
  it('validates supported export formats', () => {
    expect(isArtifactExportFormat('markdown')).toBe(true)
    expect(isArtifactExportFormat('text')).toBe(true)
    expect(isArtifactExportFormat('json')).toBe(true)
    expect(isArtifactExportFormat('pdf')).toBe(false)
  })

  it('sanitizes file basenames safely', () => {
    expect(sanitizeArtifactExportBaseName(' ../My "Artifact"\n.md ')).toBe(
      'my-artifact-md'
    )
    expect(sanitizeArtifactExportBaseName('', '123456789abcdef')).toBe(
      'artifact-12345678'
    )
    expect(
      sanitizeArtifactExportBaseName('a'.repeat(120), '123456789abcdef')
    ).toHaveLength(80)
  })

  it('assigns the expected file extension per format', () => {
    expect(getArtifactExportFilename(artifact, 'markdown')).toBe(
      'launch-plan-q3-mvp.md'
    )
    expect(getArtifactExportFilename(artifact, 'text')).toBe(
      'launch-plan-q3-mvp.txt'
    )
    expect(getArtifactExportFilename(artifact, 'json')).toBe(
      'launch-plan-q3-mvp.json'
    )
  })

  it('builds a markdown export with content and metadata', () => {
    const result = buildArtifactExport(
      artifact,
      'markdown',
      '2026-06-16T10:00:00.000Z'
    )

    expect(result.contentType).toBe('text/markdown; charset=utf-8')
    expect(result.content).toContain('# Launch Plan / Q3: "MVP"')
    expect(result.content).toContain('- Type: document')
    expect(result.content).toContain('Ship the MVP.')
    expect(result.content).toContain('```json')
    expect(result.content).toContain('"priority": "high"')
  })

  it('builds a plain text export with readable sections', () => {
    const result = buildArtifactExport(artifact, 'text')

    expect(result.contentType).toBe('text/plain; charset=utf-8')
    expect(result.content).toContain('Launch Plan / Q3: "MVP"')
    expect(result.content).toContain('Content\n-------')
    expect(result.content).toContain('Metadata\n--------')
  })

  it('builds a JSON export without user-owned private ids', () => {
    const result = buildArtifactExport(
      artifact,
      'json',
      '2026-06-16T10:00:00.000Z'
    )
    const parsed = JSON.parse(result.content)

    expect(result.contentType).toBe('application/json; charset=utf-8')
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.exportedAt).toBe('2026-06-16T10:00:00.000Z')
    expect(parsed.artifact.title).toBe(artifact.title)
    expect(parsed.artifact.content).toBe(artifact.content)
    expect(parsed.artifact.metadata.tags).toEqual(['launch', 'mvp'])
    expect(parsed.artifact.userId).toBeUndefined()
    expect(result.content).not.toContain('user-private-id')
  })
})
