import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonFilesRepository,
  neonProfilesRepository,
  neonProjectsRepository,
} from '@/lib/db/repositories'
import { hasEmbeddingConfig } from '@/lib/rag/embeddings'

export const runtime = 'nodejs'

function parseIds(value: string | null): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ].slice(0, 100)
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { searchParams } = new URL(request.url)
  const ids = parseIds(searchParams.get('ids'))
  const projectId = searchParams.get('projectId')?.trim() || null
  const conversationId = searchParams.get('conversationId')?.trim() || null

  if (projectId) {
    const project = await neonProjectsRepository.get(auth.user.id, projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
  }

  if (conversationId) {
    const conversation = await neonConversationRepository.get(
      auth.user.id,
      conversationId
    )
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      )
    }
  }

  const embeddingsAvailable = hasEmbeddingConfig()
  const files = await neonFilesRepository.listIntelligence(auth.user.id, {
    ids,
    projectId,
    conversationId,
    embeddingsAvailable,
  })

  if (ids.length > 0 && files.length !== ids.length) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 })
  }

  const response = NextResponse.json({ files, embeddingsAvailable })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
