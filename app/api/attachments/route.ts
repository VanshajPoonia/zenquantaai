import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { uploadAttachmentBinary } from '@/lib/storage/attachments'
import { Attachment } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const formData = await request.formData()
  const metadataRaw = formData.get('metadata')
  const fileEntries = formData.getAll('files')

  if (!metadataRaw || typeof metadataRaw !== 'string') {
    return NextResponse.json(
      { error: 'Attachment metadata is required.' },
      { status: 400 }
    )
  }

  const metadata = JSON.parse(metadataRaw) as Attachment[]
  const files = fileEntries.filter((entry): entry is File => entry instanceof File)

  if (files.length !== metadata.length) {
    return NextResponse.json(
      { error: 'Uploaded file count did not match attachment metadata.' },
      { status: 400 }
    )
  }

  const attachments = await Promise.all(
    files.map(async (file, index) => {
      const meta = metadata[index]
      const uploaded = await uploadAttachmentBinary({
        userId: auth.user.id,
        attachmentId: meta.id,
        fileName: meta.name || file.name,
        mimeType: meta.mimeType || file.type || 'application/octet-stream',
        bytes: Buffer.from(await file.arrayBuffer()),
      })

      return {
        ...meta,
        size: meta.size || file.size,
        mimeType: meta.mimeType || file.type || 'application/octet-stream',
        ...uploaded,
        previewUrl: undefined,
      }
    })
  )

  const response = NextResponse.json(attachments)
  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
