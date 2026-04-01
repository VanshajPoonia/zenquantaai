import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { planRequestsStore, subscriptionsStore } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const items = await planRequestsStore.listByUser(auth.user.id)
  const headers = new Headers()

  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  return NextResponse.json({ items }, { headers })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as
    | {
        requestedTier?: 'basic' | 'pro' | 'ultra' | 'prime'
        note?: string
        contact?: string
      }
    | null

  if (!body?.requestedTier) {
    return NextResponse.json(
      { error: 'Requested plan is required.' },
      { status: 400 }
    )
  }

  const subscription = await subscriptionsStore.ensureForUser(auth.user)
  const pending = await planRequestsStore.getLatestPendingForUser(auth.user.id)

  if (pending) {
    return NextResponse.json(
      { error: 'You already have a pending plan request.' },
      { status: 400 }
    )
  }

  const requestRow = await planRequestsStore.create({
    userId: auth.user.id,
    currentTier: subscription.tier,
    requestedTier: body.requestedTier,
    note: body.note?.trim(),
    contact: body.contact?.trim(),
  })

  const headers = new Headers()
  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  return NextResponse.json(
    {
      request: requestRow,
      message: 'Your request has been sent. Your plan will be activated soon.',
    },
    { headers }
  )
}
