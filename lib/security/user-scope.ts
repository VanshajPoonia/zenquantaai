import { DEFAULT_PROJECT_ID } from '@/lib/config'
import { DashboardRecentImageSummary, ImageGenerationEvent } from '@/types'

export function normalizeOptionalProjectId(
  projectId: string | null | undefined
): string | null {
  const normalized = projectId?.trim()
  return normalized ? normalized : null
}

export function normalizeConversationProjectId(
  projectId: string | null | undefined
): string {
  return normalizeOptionalProjectId(projectId) ?? DEFAULT_PROJECT_ID
}

export function conversationBelongsToProject(
  conversationProjectId: string | null | undefined,
  projectId: string | null | undefined
): boolean {
  const scopedProjectId = normalizeOptionalProjectId(projectId)
  if (!scopedProjectId) return true

  return normalizeConversationProjectId(conversationProjectId) === scopedProjectId
}

export function toSafeDashboardRecentImage(
  event: ImageGenerationEvent
): DashboardRecentImageSummary {
  return {
    id: event.id,
    conversationId: event.conversationId ?? null,
    messageId: event.messageId ?? null,
    model: event.model,
    prompt: event.prompt,
    imageCount: event.imageCount,
    imageCreditsConsumed: event.imageCreditsConsumed,
    displayedCostUsd: event.displayedCostUsd,
    outputCount: event.outputUrls.length,
    createdAt: event.createdAt,
  }
}
