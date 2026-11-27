import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  ensureFromAuthUser: vi.fn(),
  getSettings: vi.fn(),
  patchSettings: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  appendAuthCookies: vi.fn(),
}))
vi.mock('@/lib/db/repositories', () => ({
  neonProfilesRepository: { ensureFromAuthUser: mocks.ensureFromAuthUser },
  neonSettingsRepository: { get: mocks.getSettings, patch: mocks.patchSettings },
}))

import { POST } from '@/app/api/settings/route'

const userAuth = {
  user: { id: 'user-a', loginId: 'alpha', email: null, role: 'user' },
  session: { refreshed: false },
}

async function postSettings(body: unknown): Promise<Response> {
  const response = await POST(
    new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
  if (!response) throw new Error('Route did not return a response.')
  return response
}

describe('POST /api/settings personalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthenticatedUser.mockResolvedValue(userAuth)
    mocks.patchSettings.mockImplementation(async (_userId: string, patch: object) => ({
      aboutYou: '',
      responseInstructions: '',
      useCustomInstructions: true,
      ...patch,
    }))
  })

  it('returns 401 when signed out', async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await postSettings({ aboutYou: 'Hi' })

    expect(response.status).toBe(401)
    expect(mocks.patchSettings).not.toHaveBeenCalled()
  })

  it('saves about you for the signed-in user only', async () => {
    const response = await postSettings({
      aboutYou: 'I teach maths.',
      responseInstructions: 'Use short answers.',
      useCustomInstructions: false,
      userId: 'user-b',
    })

    expect(response.status).toBe(200)
    expect(mocks.patchSettings).toHaveBeenCalledWith(
      'user-a',
      expect.objectContaining({
        aboutYou: 'I teach maths.',
        responseInstructions: 'Use short answers.',
        useCustomInstructions: false,
      })
    )
    expect((await response.json()).aboutYou).toBe('I teach maths.')
  })

  it('rejects text over the limit', async () => {
    const response = await postSettings({ aboutYou: 'a'.repeat(1_501) })

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('About you can be up to 1,500 characters.')
    expect(mocks.patchSettings).not.toHaveBeenCalled()
  })

  it('rejects the wrong types', async () => {
    expect((await postSettings({ responseInstructions: 42 })).status).toBe(400)
    expect((await postSettings({ useCustomInstructions: 'yes' })).status).toBe(400)
    expect(mocks.patchSettings).not.toHaveBeenCalled()
  })
})
