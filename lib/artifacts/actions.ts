import { ArtifactActionType, TextAIMode } from '@/types'

export const ARTIFACT_ACTION_TYPES: ArtifactActionType[] = [
  'improve_writing',
  'make_shorter',
  'make_more_professional',
  'expand_detail',
  'turn_into_checklist',
  'turn_into_email',
  'create_summary',
  'find_weaknesses',
]

export const ARTIFACT_ACTION_LABELS: Record<ArtifactActionType, string> = {
  improve_writing: 'Improve writing',
  make_shorter: 'Make shorter',
  make_more_professional: 'Make more professional',
  expand_detail: 'Expand with more detail',
  turn_into_checklist: 'Turn into checklist',
  turn_into_email: 'Turn into email',
  create_summary: 'Create summary',
  find_weaknesses: 'Find weaknesses',
}

export const ARTIFACT_ACTION_MODES: Record<ArtifactActionType, TextAIMode> = {
  improve_writing: 'creative',
  make_shorter: 'creative',
  make_more_professional: 'creative',
  expand_detail: 'creative',
  turn_into_checklist: 'general',
  turn_into_email: 'creative',
  create_summary: 'general',
  find_weaknesses: 'logic',
}

export function isArtifactActionType(value: unknown): value is ArtifactActionType {
  return (
    typeof value === 'string' &&
    ARTIFACT_ACTION_TYPES.includes(value as ArtifactActionType)
  )
}
