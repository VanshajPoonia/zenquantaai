import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonFilesRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { getObjectStore } from '@/lib/storage/object-store'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
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
