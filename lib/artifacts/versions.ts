export const RESTORE_ARTIFACT_VERSION_ACTION = 'restore_version'

const MAX_ACTION_LABEL_LENGTH = 80

export function getArtifactVersionAction(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const action = metadata?.lastArtifactAction

  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return null
  }

  const actionType = (action as Record<string, unknown>).actionType

  if (typeof actionType !== 'string') return null

  const normalized = actionType.trim().slice(0, MAX_ACTION_LABEL_LENGTH)
  return normalized || null
}
