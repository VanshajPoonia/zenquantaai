import { NextRequest, NextResponse } from 'next/server'
import { neonArtifactSharesRepository } from '@/lib/db/repositories'

export const runtime = 'nodejs'

function isValidToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{40,60}$/.test(value)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const result = await neonArtifactSharesRepository.getPublicByToken(token)
  if (!result) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  return NextResponse.json(result)
}
