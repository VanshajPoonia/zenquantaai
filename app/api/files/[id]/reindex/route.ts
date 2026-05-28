import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonFilesRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { hasEmbeddingConfig } from '@/lib/rag/embeddings'
import { indexUploadedFileForKnowledge } from '@/lib/rag/indexing'
import { getObjectStore } from '@/lib/storage/object-store'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { id } = await context.params
  const file = await neonFilesRepository.get(auth.user.id, id)
  if (!file) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 })
  }

  if (!hasEmbeddingConfig()) {
    return NextResponse.json(
      { error: 'Embedding provider is not configured.' },
      { status: 400 }
    )
  }

  if (!file.bucket || !file.storagePath) {
    return NextResponse.json(
      { error: 'Stored file object is unavailable.' },
      { status: 400 }
    )
  }

  try {
    const object = await getObjectStore().getObject({
      bucket: file.bucket,
      key: file.storagePath,
    })

    await indexUploadedFileForKnowledge({
      userId: auth.user.id,
      file,
      fileName: file.fileName,
      mimeType: file.mimeType ?? object.contentType,
      bytes: object.body,
      projectId: file.projectId,
      conversationId: file.conversationId,
      messageId: file.messageId,
    })
  } catch {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 })
  }

  const updated = await neonFilesRepository.getIntelligence(
    auth.user.id,
    file.id,
    hasEmbeddingConfig()
  )
  const response = NextResponse.json({ file: updated })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
