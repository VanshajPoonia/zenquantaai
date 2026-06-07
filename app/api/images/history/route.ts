import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonGeneratedImagesRepository,
  neonImageGenerationEventsRepository,
  neonProjectsRepository,
} from '@/lib/db/repositories'
import { createPrivateFileUrl } from '@/lib/storage/object-store'
import { PrismStudioHistoryResponse } from '@/types'

export const runtime = 'nodejs'

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseLimit(value: string | null, fallback = 80): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(200, Math.floor(parsed)))
}

function privateImageUrl(bucket: string | null, storagePath: string | null) {
  if (!bucket || !storagePath) return null
  try {
    return createPrivateFileUrl({ bucket, storagePath })
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')?.trim() || null
  const projectId = searchParams.get('projectId')?.trim() || null
  const favoriteParam = searchParams.get('favorite')
  const favorite =
    favoriteParam === 'true' ? true : favoriteParam === 'false' ? false : null
  const from = parseDateParam(searchParams.get('from'))
  const to = parseDateParam(searchParams.get('to'))
  const before = parseDateParam(searchParams.get('before'))
  const limit = parseLimit(searchParams.get('limit'))

  if (projectId) {
    const project = await neonProjectsRepository.get(auth.user.id, projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
  }

  const images = await neonGeneratedImagesRepository.listByUser(auth.user.id, {
    q,
    projectId,
    favorite,
    from,
    to,
    before,
    limit,
  })
  const messageIds = [
    ...new Set(images.map((image) => image.messageId).filter(Boolean)),
  ] as string[]
  const usageEvents =
    messageIds.length > 0
      ? await neonImageGenerationEventsRepository.listByUserMessageIds(
          auth.user.id,
          messageIds
        )
      : []
  const usageByMessageId = new Map(
    usageEvents
      .filter((event) => event.messageId)
      .map((event) => [event.messageId as string, event])
  )
  const headers = new Headers()

  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  const response: PrismStudioHistoryResponse = {
    items: images.map((image) => {
      const usage = image.messageId
        ? usageByMessageId.get(image.messageId) ?? null
        : null

      return {
        id: image.id,
        prompt: image.prompt,
        model: image.model,
        status: image.status,
        projectId: image.projectId,
        conversationId: image.conversationId,
        messageId: image.messageId,
        width: image.width,
        height: image.height,
        url: privateImageUrl(image.storageBucket, image.storagePath),
        sourceUrl: null,
        isFavorite: image.isFavorite,
        imageCreditsConsumed: usage?.imageCreditsConsumed ?? null,
        displayedCostUsd: usage?.displayedCostUsd ?? null,
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
        metadata: {
          provider: image.provider,
          storageProvider: image.storageProvider,
        },
      }
    }),
  }

  return NextResponse.json(response, { headers })
}
