import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonGeneratedImagesRepository,
  neonProjectsRepository,
} from '@/lib/db/repositories'
import { createPrivateFileUrl } from '@/lib/storage/object-store'
import { PrismStudioImage, PrismStudioImagePatch } from '@/types'

export const runtime = 'nodejs'

function privateImageUrl(bucket: string | null, storagePath: string | null) {
  if (!bucket || !storagePath) return null
  try {
    return createPrivateFileUrl({ bucket, storagePath })
  } catch {
    return null
  }
}

function toResponseImage(image: Awaited<ReturnType<typeof neonGeneratedImagesRepository.get>>): PrismStudioImage {
  if (!image) {
    throw new Error('Image not found.')
  }

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
    imageCreditsConsumed: null,
    displayedCostUsd: null,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
    metadata: {
      provider: image.provider,
      storageProvider: image.storageProvider,
    },
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const { id } = await context.params
  const image = await neonGeneratedImagesRepository.get(auth.user.id, id)

  if (!image) {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as
    | PrismStudioImagePatch
    | null

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid image update.' }, { status: 400 })
  }

  const patch: PrismStudioImagePatch = {}

  if (Object.prototype.hasOwnProperty.call(body, 'isFavorite')) {
    if (typeof body.isFavorite !== 'boolean') {
      return NextResponse.json(
        { error: 'Favorite must be a boolean.' },
        { status: 400 }
      )
    }
    patch.isFavorite = body.isFavorite
  }

  if (Object.prototype.hasOwnProperty.call(body, 'projectId')) {
    const projectId = body.projectId?.trim() || null

    if (projectId) {
      const project = await neonProjectsRepository.get(auth.user.id, projectId)
      if (!project) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
      }
    }

    patch.projectId = projectId
  }

  if (
    !Object.prototype.hasOwnProperty.call(patch, 'isFavorite') &&
    !Object.prototype.hasOwnProperty.call(patch, 'projectId')
  ) {
    return NextResponse.json(
      { error: 'No supported image fields were provided.' },
      { status: 400 }
    )
  }

  const updated = await neonGeneratedImagesRepository.patch(auth.user.id, id, patch)
  const headers = new Headers()

  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  return NextResponse.json(toResponseImage(updated), { headers })
}
