import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonSearchRepository,
} from '@/lib/db/repositories'
import { SearchResponse } from '@/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? searchParams.get('query') ?? '').trim()
  const results = await neonSearchRepository.search(auth.user.id, query)
  const response = NextResponse.json({
    query,
    results,
  } satisfies SearchResponse)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
