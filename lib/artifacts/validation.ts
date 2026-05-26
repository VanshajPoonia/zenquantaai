import { ArtifactInput, ArtifactPatch, ArtifactSourceType, ArtifactType } from '@/types'

export const ARTIFACT_SOURCE_TYPES: ArtifactSourceType[] = [
  'chat_message',
  'model_comparison',
  'workflow_run',
  'manual',
  'prism_prompt',
  'pulse_report',
]

export const ARTIFACT_TYPES: ArtifactType[] = [
  'document',
  'code',
  'table',
  'image_prompt',
  'research_report',
  'brand_asset',
  'checklist',
  'workflow_output',
]

export function isArtifactSourceType(value: unknown): value is ArtifactSourceType {
  return (
    typeof value === 'string' &&
    ARTIFACT_SOURCE_TYPES.includes(value as ArtifactSourceType)
  )
}

export function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && ARTIFACT_TYPES.includes(value as ArtifactType)
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  return value.trim() || null
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'undefined') return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export function normalizeArtifactInput(value: unknown):
  | { ok: true; input: ArtifactInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Artifact payload is required.' }
  }

  const body = value as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content : ''
  const sourceType = body.sourceType
  const artifactType = body.artifactType

  if (!title) return { ok: false, error: 'title is required.' }
  if (!content.trim()) return { ok: false, error: 'content is required.' }
  if (!isArtifactSourceType(sourceType)) {
    return { ok: false, error: 'sourceType is invalid.' }
  }
  if (!isArtifactType(artifactType)) {
    return { ok: false, error: 'artifactType is invalid.' }
  }

  return {
    ok: true,
    input: {
      projectId: normalizeOptionalString(body.projectId),
      conversationId: normalizeOptionalString(body.conversationId),
      sourceMessageId: normalizeOptionalString(body.sourceMessageId),
      sourceType,
      title,
      artifactType,
      content,
      metadata: normalizeMetadata(body.metadata) ?? {},
    },
  }
}

export function normalizeArtifactPatch(value: unknown):
  | { ok: true; patch: ArtifactPatch }
  | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Artifact payload is required.' }
  }

  const body = value as Record<string, unknown>
  const patch: ArtifactPatch = {}

  if (typeof body.projectId !== 'undefined') {
    patch.projectId = normalizeOptionalString(body.projectId) ?? null
  }

  if (typeof body.title !== 'undefined') {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return { ok: false, error: 'title is invalid.' }
    }
    patch.title = body.title.trim()
  }

  if (typeof body.content !== 'undefined') {
    if (typeof body.content !== 'string' || !body.content.trim()) {
      return { ok: false, error: 'content is invalid.' }
    }
    patch.content = body.content
  }

  if (typeof body.artifactType !== 'undefined') {
    if (!isArtifactType(body.artifactType)) {
      return { ok: false, error: 'artifactType is invalid.' }
    }
    patch.artifactType = body.artifactType
  }

  if (typeof body.metadata !== 'undefined') {
    patch.metadata = normalizeMetadata(body.metadata) ?? {}
  }

  return { ok: true, patch }
}
