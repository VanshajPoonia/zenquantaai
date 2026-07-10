'use client'

import { useCallback } from 'react'
import {
  Artifact,
  ArtifactActionResponse,
  ArtifactActionType,
  ArtifactInput,
  ArtifactListFilters,
  ArtifactPatch,
  ArtifactVersionDuplicateResponse,
  ArtifactVersionListResponse,
  ArtifactVersionRestoreResponse,
} from '@/types'

export function useArtifacts(input: {
  requestJson: <T>(url: string, init?: RequestInit) => Promise<T>
  openWorkspaceTool: (request: {
    tool: 'artifacts'
    artifactId?: string | null
    projectId?: string | null
  }) => void
}) {
  const listArtifacts = useCallback(
    async (filters: ArtifactListFilters = {}) => {
      const params = new URLSearchParams()

      if (filters.projectId) params.set('projectId', filters.projectId)
      if (filters.q) params.set('q', filters.q)
      if (filters.artifactType) params.set('artifactType', filters.artifactType)
      if (filters.sourceType) params.set('sourceType', filters.sourceType)
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.beforeUpdatedAt) {
        params.set('beforeUpdatedAt', filters.beforeUpdatedAt)
      }

      const query = params.toString()
      return await input.requestJson<Artifact[]>(
        query ? `/api/artifacts?${query}` : '/api/artifacts'
      )
    },
    [input]
  )

  const saveArtifact = useCallback(
    async (artifactInput: ArtifactInput) => {
      try {
        const artifact = await input.requestJson<Artifact>('/api/artifacts', {
          method: 'POST',
          body: JSON.stringify(artifactInput),
        })

        input.openWorkspaceTool({
          tool: 'artifacts',
          artifactId: artifact.id,
          projectId: artifact.projectId,
        })
        return artifact
      } catch (error) {
        console.error('Failed to save artifact.', error)
        return null
      }
    },
    [input]
  )

  const updateArtifact = useCallback(
    async (artifactId: string, patch: ArtifactPatch) => {
      try {
        return await input.requestJson<Artifact>(`/api/artifacts/${artifactId}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        })
      } catch (error) {
        console.error('Failed to update artifact.', error)
        return null
      }
    },
    [input]
  )

  const deleteArtifact = useCallback(
    async (artifactId: string) => {
      try {
        await input.requestJson(`/api/artifacts/${artifactId}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Failed to delete artifact.', error)
      }
    },
    [input]
  )

  const runArtifactAction = useCallback(
    async (artifactId: string, actionType: ArtifactActionType) => {
      return await input.requestJson<ArtifactActionResponse>(
        `/api/artifacts/${artifactId}/actions`,
        {
          method: 'POST',
          body: JSON.stringify({ actionType }),
        }
      )
    },
    [input]
  )

  const listArtifactVersions = useCallback(
    async (artifactId: string) => {
      const response = await input.requestJson<ArtifactVersionListResponse>(
        `/api/artifacts/${artifactId}/versions`
      )
      return response.versions
    },
    [input]
  )

  const restoreArtifactVersion = useCallback(
    async (artifactId: string, versionId: string) => {
      try {
        const response = await input.requestJson<ArtifactVersionRestoreResponse>(
          `/api/artifacts/${artifactId}/versions/${versionId}/restore`,
          {
            method: 'POST',
          }
        )
        return response.artifact
      } catch (error) {
        console.error('Failed to restore artifact version.', error)
        return null
      }
    },
    [input]
  )

  const duplicateArtifactVersion = useCallback(
    async (artifactId: string, versionId: string) => {
      try {
        const response = await input.requestJson<ArtifactVersionDuplicateResponse>(
          `/api/artifacts/${artifactId}/versions/${versionId}/duplicate`,
          {
            method: 'POST',
          }
        )

        input.openWorkspaceTool({
          tool: 'artifacts',
          artifactId: response.artifact.id,
          projectId: response.artifact.projectId,
        })

        return response.artifact
      } catch (error) {
        console.error('Failed to duplicate artifact version.', error)
        return null
      }
    },
    [input]
  )

  return {
    listArtifacts,
    saveArtifact,
    updateArtifact,
    deleteArtifact,
    runArtifactAction,
    listArtifactVersions,
    restoreArtifactVersion,
    duplicateArtifactVersion,
  }
}
