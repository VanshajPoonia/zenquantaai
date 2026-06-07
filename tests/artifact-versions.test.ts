import { describe, expect, it } from 'vitest'
import {
  RESTORE_ARTIFACT_VERSION_ACTION,
  getArtifactVersionAction,
} from '@/lib/artifacts/versions'

describe('artifact version helpers', () => {
  it('extracts the last applied artifact action from metadata', () => {
    expect(
      getArtifactVersionAction({
        lastArtifactAction: {
          actionType: 'improve_writing',
        },
      })
    ).toBe('improve_writing')
  })

  it('returns null for missing or malformed action metadata', () => {
    expect(getArtifactVersionAction({})).toBeNull()
    expect(getArtifactVersionAction({ lastArtifactAction: null })).toBeNull()
    expect(
      getArtifactVersionAction({
        lastArtifactAction: {
          actionType: '',
        },
      })
    ).toBeNull()
  })

  it('keeps restore snapshots on a stable action label', () => {
    expect(RESTORE_ARTIFACT_VERSION_ACTION).toBe('restore_version')
  })
})
