import { NextRequest } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { neonFilesRepository } from '@/lib/db/repositories'
import { getObjectStore } from '@/lib/storage/object-store'
import { assertSafeObjectRef } from '@/lib/storage/security'

export const runtime = 'nodejs'

function createStorageError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status })
}

function sanitizeDownloadName(value: string): string {
  const name = value.split('/').pop()?.trim() || 'zenquanta-file'
  return name.replace(/[\r\n"]/g, '_')
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const bucket = request.nextUrl.searchParams.get('bucket')?.trim() ?? ''
  const storagePath = request.nextUrl.searchParams.get('path')?.trim() ?? ''
  const shouldDownload = request.nextUrl.searchParams.get('download') === '1'

  if (!bucket || !storagePath) {
    return createStorageError('File bucket and path are required.')
  }

  try {
    assertSafeObjectRef({ bucket, key: storagePath })
  } catch {
    return createStorageError('File bucket or path is invalid.')
  }

  const file = await neonFilesRepository.getByObjectRef({
    userId: auth.user.id,
    bucket,
    storagePath,
  })

  if (!file || file.visibility !== 'private') {
    return createStorageError('File not found.', 404)
  }

  try {
    const object = await getObjectStore().getObject({
      bucket,
      key: storagePath,
    })
    const headers = new Headers({
      'Content-Type': object.contentType,
      'Content-Length': String(object.contentLength),
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="${sanitizeDownloadName(
        file.fileName
      )}"`,
    })

    if (auth.session.refreshed) {
      appendAuthCookies(headers, auth.session)
    }

    return new Response(object.body as BodyInit, { headers })
  } catch {
    return createStorageError('File not found.', 404)
  }
}
