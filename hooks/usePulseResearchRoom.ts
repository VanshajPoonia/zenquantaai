'use client'

import { useCallback } from 'react'
import { PulseResearchRoomResponse } from '@/types'

export function usePulseResearchRoom(input: {
  requestJson: <T>(url: string, init?: RequestInit) => Promise<T>
}) {
  const listPulseResearchRoom = useCallback(
    async (
      filters: {
        q?: string
        projectId?: string | null
      } = {}
    ) => {
      const params = new URLSearchParams()

      if (filters.q) params.set('q', filters.q)
      if (filters.projectId) params.set('projectId', filters.projectId)

      const query = params.toString()
      return await input.requestJson<PulseResearchRoomResponse>(
        query ? `/api/pulse/research-room?${query}` : '/api/pulse/research-room'
      )
    },
    [input]
  )

  return { listPulseResearchRoom }
}
