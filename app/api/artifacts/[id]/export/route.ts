import { NextRequest } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonArtifactsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import {
  buildArtifactExport,
  isArtifactExportFormat,
} from '@/lib/artifacts/export'

export const runtime = 'nodejs'

function createExportError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status })
}

function toContentDisposition(filename: string): string {
  const asciiFilename = filename.replace(/[\r\n"]/g, '_')
  const encodedFilename = encodeURIComponent(filename)
  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const formatParam = request.nextUrl.searchParams.get('format') ?? 'markdown'
  if (!isArtifactExportFormat(formatParam)) {
    return createExportError('Artifact export format is invalid.', 400)
  }

  const { id } = await params
  const artifact = await neonArtifactsRepository.get(auth.user.id, id)

  if (!artifact) {
    return createExportError('Artifact not found.', 404)
  }

  const artifactExport = buildArtifactExport(artifact, formatParam)
  const headers = new Headers({
    'Content-Type': artifactExport.contentType,
    'Content-Disposition': toContentDisposition(artifactExport.filename),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  })

  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  return new Response(artifactExport.content, { headers })
}
