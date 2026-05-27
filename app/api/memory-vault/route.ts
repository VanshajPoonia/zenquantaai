import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonMemoryVaultRepository,
  neonProfilesRepository,
  neonSettingsRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const settings = await neonSettingsRepository.get(auth.user.id)
  const vault = await neonMemoryVaultRepository.getVault(
    auth.user.id,
    settings.sessionDefaults.memory
  )
  const response = NextResponse.json(vault)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
