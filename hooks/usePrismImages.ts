'use client'

import { useCallback } from 'react'
import {
  PrismStudioHistoryFilters,
  PrismStudioHistoryResponse,
  PrismStudioImage,
  PrismStudioImagePatch,
} from '@/types'

export function usePrismImages(input: {
  requestJson: <T>(url: string, init?: RequestInit) => Promise<T>
}) {
  const listPrismImages = useCallback(
    async (filters: PrismStudioHistoryFilters = {}) => {
      const params = new URLSearchParams()

      if (filters.q) params.set('q', filters.q)
      if (filters.projectId) params.set('projectId', filters.projectId)
      if (typeof filters.favorite === 'boolean') {
        params.set('favorite', String(filters.favorite))
      }
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)

      const query = params.toString()
      return await input.requestJson<PrismStudioHistoryResponse>(
        query ? `/api/images/history?${query}` : '/api/images/history'
      )
    },
    [input]
  )

  const updatePrismImage = useCallback(
    async (imageId: string, patch: PrismStudioImagePatch) => {
      try {
        return await input.requestJson<PrismStudioImage>(
          `/api/images/history/${imageId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(patch),
          }
        )
      } catch (error) {
        console.error('Failed to update Prism image.', error)
        return null
      }
    },
    [input]
  )

  return { listPrismImages, updatePrismImage }
}
