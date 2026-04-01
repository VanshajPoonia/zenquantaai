import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { readCookieStoreAuthSession, requireAuthenticatedUser } from './session'
import { profilesStore } from '@/lib/storage'

export async function requireServerUser() {
  const cookieStore = await cookies()
  const session = await readCookieStoreAuthSession(cookieStore)

  if (!session.user) {
    redirect('/')
  }

  const profile = await profilesStore.get(session.user.id)

  return {
    user: session.user,
    profile,
    session,
  }
}

export async function requireAdmin() {
  const result = await requireServerUser()

  if (result.profile?.role !== 'admin') {
    redirect('/')
  }

  return result
}

export async function requireAdminApiUser(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)

  if ('response' in auth) {
    return auth
  }

  const profile = await profilesStore.get(auth.user.id)

  if (profile?.role !== 'admin') {
    return {
      response: NextResponse.json(
        { error: 'Admin access is required.' },
        { status: 403 }
      ),
    }
  }

  return {
    ...auth,
    profile,
  }
}
