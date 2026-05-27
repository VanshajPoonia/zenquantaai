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

function privateImageUrl(bucket: string | null, storagePath: string | null) {
  if (!bucket || !storagePath) return null
  return createPrivateFileUrl({ bucket, storagePath })
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

  if (projectId) {
    const project = await neonProjectsRepository.get(auth.user.id, projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
  }

  const [images, usageEvents] = await Promise.all([
    neonGeneratedImagesRepository.listByUser(auth.user.id, {
      q,
      projectId,
      favorite,
      from,
      to,
    }),
    neonImageGenerationEventsRepository.listByUser(auth.user.id),
  ])
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
        sourceUrl: image.sourceUrl,
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
