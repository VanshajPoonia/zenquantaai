import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
} from '@/lib/db/repositories'
import { resolveOwnedProjectScope } from '@/lib/security/ownership'
import { conversationBelongsToProject } from '@/lib/security/user-scope'
import { uploadAttachmentBinary } from '@/lib/storage/attachments'
import { MAX_PRIVATE_FILE_BYTES, normalizeMimeType } from '@/lib/storage/security'
import { Attachment, AttachmentKind } from '@/types'

export const runtime = 'nodejs'

const ATTACHMENT_KINDS: AttachmentKind[] = [
  'image',
  'pdf',
  'text',
  'code',
  'document',
  'spreadsheet',
  'other',
]

function isAttachmentMetadata(value: unknown): value is Attachment {
  if (!value || typeof value !== 'object') return false

  const attachment = value as Partial<Attachment>
  return (
    typeof attachment.id === 'string' &&
    attachment.id.trim().length > 0 &&
    typeof attachment.name === 'string' &&
    attachment.name.trim().length > 0 &&
    typeof attachment.mimeType === 'string' &&
    attachment.mimeType.trim().length > 0 &&
    typeof attachment.size === 'number' &&
    Number.isFinite(attachment.size) &&
    attachment.size >= 0 &&
    typeof attachment.createdAt === 'string' &&
    attachment.createdAt.trim().length > 0 &&
    typeof attachment.kind === 'string' &&
    ATTACHMENT_KINDS.includes(attachment.kind as AttachmentKind)
  )
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const formData = await request.formData()
  const metadataRaw = formData.get('metadata')
  const projectId = formData.get('projectId')
  const conversationId = formData.get('conversationId')
  const fileEntries = formData.getAll('files')

  if (!metadataRaw || typeof metadataRaw !== 'string') {
    return NextResponse.json(
      { error: 'Attachment metadata is required.' },
      { status: 400 }
    )
  }

  const metadata = (() => {
    try {
      const parsed = JSON.parse(metadataRaw)
      return Array.isArray(parsed) ? (parsed as Attachment[]) : null
    } catch {
      return null
    }
  })()

  if (!metadata) {
    return NextResponse.json(
      { error: 'Attachment metadata is invalid.' },
      { status: 400 }
    )
  }

  if (!metadata.every(isAttachmentMetadata)) {
    return NextResponse.json(
      { error: 'Attachment metadata is invalid.' },
      { status: 400 }
    )
  }

  const files = fileEntries.filter((entry): entry is File => entry instanceof File)

  if (files.length !== metadata.length) {
    return NextResponse.json(
      { error: 'Uploaded file count did not match attachment metadata.' },
      { status: 400 }
    )
  }

  if (files.some((file) => file.size > MAX_PRIVATE_FILE_BYTES)) {
    return NextResponse.json(
      { error: 'Attachments must be 25MB or smaller.' },
      { status: 413 }
    )
  }

  const scopedProjectId =
    typeof projectId === 'string' && projectId ? projectId : null
  const scopedConversationId =
    typeof conversationId === 'string' && conversationId ? conversationId : null
  let scopedConversationProjectId: string | null = null

  const projectScope = await resolveOwnedProjectScope(auth.user.id, scopedProjectId)
  if (!projectScope.ok) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  if (scopedConversationId) {
    const conversation = await neonConversationRepository.get(
      auth.user.id,
      scopedConversationId
    )
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      )
    }
    scopedConversationProjectId = conversation.projectId ?? null
  }

  if (
    scopedConversationId &&
    projectScope.projectId &&
    !conversationBelongsToProject(scopedConversationProjectId, projectScope.projectId)
  ) {
    return NextResponse.json(
      { error: 'Conversation does not belong to project.' },
      { status: 400 }
    )
  }

  const attachments = await Promise.all(
    files.map(async (file, index) => {
      const meta = metadata[index]
      const mimeType = normalizeMimeType(
        file.type || meta.mimeType || 'application/octet-stream'
      )
      const uploaded = await uploadAttachmentBinary({
        userId: auth.user.id,
        attachmentId: meta.id,
        fileName: meta.name || file.name,
        mimeType,
        bytes: Buffer.from(await file.arrayBuffer()),
        projectId: projectScope.projectId,
        conversationId: scopedConversationId,
      })

      return {
        ...meta,
        size: meta.size || file.size,
        mimeType,
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
