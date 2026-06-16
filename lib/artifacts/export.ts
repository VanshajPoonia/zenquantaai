import { Artifact } from '@/types'

export const ARTIFACT_EXPORT_FORMATS = ['markdown', 'text', 'json'] as const

export type ArtifactExportFormat = (typeof ARTIFACT_EXPORT_FORMATS)[number]

const MAX_BASENAME_LENGTH = 80

const EXPORT_CONTENT_TYPES: Record<ArtifactExportFormat, string> = {
  markdown: 'text/markdown; charset=utf-8',
  text: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
}

const EXPORT_EXTENSIONS: Record<ArtifactExportFormat, string> = {
  markdown: 'md',
  text: 'txt',
  json: 'json',
}

export interface ArtifactExport {
  format: ArtifactExportFormat
  content: string
  contentType: string
  filename: string
}

export function isArtifactExportFormat(
  value: string | null | undefined
): value is ArtifactExportFormat {
  return ARTIFACT_EXPORT_FORMATS.includes(value as ArtifactExportFormat)
}

export function sanitizeArtifactExportBaseName(
  title: string | null | undefined,
  artifactId?: string | null
): string {
  const fallback = artifactId?.trim()
    ? `artifact-${artifactId.trim().slice(0, 8)}`
    : 'artifact'
  const normalized = (title ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASENAME_LENGTH)
    .replace(/-+$/g, '')

  return normalized || fallback
}

export function getArtifactExportFilename(
  artifact: Pick<Artifact, 'id' | 'title'>,
  format: ArtifactExportFormat
): string {
  const basename = sanitizeArtifactExportBaseName(artifact.title, artifact.id)
  return `${basename}.${EXPORT_EXTENSIONS[format]}`
}

function formatMetadataLines(artifact: Artifact): string[] {
  return [
    `Type: ${artifact.artifactType}`,
    `Source: ${artifact.sourceType}`,
    `Project: ${artifact.projectId ?? 'None'}`,
    `Conversation: ${artifact.conversationId ?? 'None'}`,
    `Source message: ${artifact.sourceMessageId ?? 'None'}`,
    `Created: ${artifact.createdAt}`,
    `Updated: ${artifact.updatedAt}`,
  ]
}

function formatMetadataJson(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata ?? {}, null, 2)
}

function artifactToMarkdown(artifact: Artifact): string {
  return [
    `# ${artifact.title}`,
    '',
    ...formatMetadataLines(artifact).map((line) => `- ${line}`),
    '',
    '## Content',
    '',
    artifact.content,
    '',
    '## Metadata',
    '',
    '```json',
    formatMetadataJson(artifact.metadata),
    '```',
  ].join('\n')
}

function artifactToText(artifact: Artifact): string {
  return [
    artifact.title,
    '='.repeat(Math.max(artifact.title.length, 1)),
    '',
    ...formatMetadataLines(artifact),
    '',
    'Content',
    '-------',
    artifact.content,
    '',
    'Metadata',
    '--------',
    formatMetadataJson(artifact.metadata),
  ].join('\n')
}

function artifactToJson(artifact: Artifact, exportedAt: string): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt,
      artifact: {
        id: artifact.id,
        title: artifact.title,
        artifactType: artifact.artifactType,
        sourceType: artifact.sourceType,
        projectId: artifact.projectId ?? null,
        conversationId: artifact.conversationId ?? null,
        sourceMessageId: artifact.sourceMessageId ?? null,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
        content: artifact.content,
        metadata: artifact.metadata ?? {},
      },
    },
    null,
    2
  )
}

export function buildArtifactExport(
  artifact: Artifact,
  format: ArtifactExportFormat,
  exportedAt = new Date().toISOString()
): ArtifactExport {
  const content =
    format === 'json'
      ? artifactToJson(artifact, exportedAt)
      : format === 'text'
        ? artifactToText(artifact)
        : artifactToMarkdown(artifact)

  return {
    format,
    content,
    contentType: EXPORT_CONTENT_TYPES[format],
    filename: getArtifactExportFilename(artifact, format),
  }
}
