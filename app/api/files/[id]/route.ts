import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonFilesRepository,
  neonProfilesRepository,
  neonProjectsRepository,
} from '@/lib/db/repositories'
import { hasEmbeddingConfig } from '@/lib/rag/embeddings'
import { getObjectStore } from '@/lib/storage/object-store'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { id } = await context.params
  const file = await neonFilesRepository.get(auth.user.id, id)
  if (!file) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const patch: { projectId?: string | null } = {}

  if ('projectId' in body) {
    const projectId = body.projectId
    if (projectId === null || projectId === undefined) {
      patch.projectId = null
    } else if (typeof projectId === 'string' && projectId.trim()) {
      const project = await neonProjectsRepository.get(auth.user.id, projectId.trim())
      if (!project) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
      }
      patch.projectId = project.id
    } else {
      return NextResponse.json({ error: 'Invalid projectId.' }, { status: 400 })
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No patchable fields provided.' }, { status: 400 })
  }

  await neonFilesRepository.patch(auth.user.id, id, patch)

  const updated = await neonFilesRepository.getIntelligence(
    auth.user.id,
    id,
    hasEmbeddingConfig()
  )
  const response = NextResponse.json({ file: updated })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { id } = await context.params
  const file = await neonFilesRepository.get(auth.user.id, id)
  if (!file) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 })
  }

  if (file.bucket && file.storagePath) {
    await getObjectStore().deleteObject({
      bucket: file.bucket,
      key: file.storagePath,
    })
  }

  await neonConversationRepository.removeFileAttachmentAccess(auth.user.id, file.id)
  await neonFilesRepository.delete(auth.user.id, file.id)
  const response = NextResponse.json({ file: null })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
