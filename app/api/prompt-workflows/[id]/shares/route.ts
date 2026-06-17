import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonPromptWorkflowsRepository,
  neonTemplateSharesRepository,
} from '@/lib/db/repositories'
import { TemplateShareInput, TemplateShareVisibility } from '@/types'

export const runtime = 'nodejs'

const VALID_VISIBILITY: TemplateShareVisibility[] = ['public_link', 'private_link']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params

  const workflow = await neonPromptWorkflowsRepository.get(auth.user.id, id)
  if (!workflow) {
    return NextResponse.json({ error: 'Playbook not found.' }, { status: 404 })
  }

  const shares = await neonTemplateSharesRepository.list(auth.user.id, 'playbook', id)
  const response = NextResponse.json(shares)
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params

  const workflow = await neonPromptWorkflowsRepository.get(auth.user.id, id)
  if (!workflow) {
    return NextResponse.json({ error: 'Playbook not found.' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as Partial<TemplateShareInput> | null

  const visibility =
    body?.visibility && VALID_VISIBILITY.includes(body.visibility)
      ? body.visibility
      : 'public_link'

  const expiresAt =
    typeof body?.expiresAt === 'string' && !Number.isNaN(Date.parse(body.expiresAt))
      ? body.expiresAt
      : null

  const share = await neonTemplateSharesRepository.create(auth.user.id, 'playbook', id, {
    visibility,
    expiresAt,
  })

  const response = NextResponse.json(share, { status: 201 })
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
