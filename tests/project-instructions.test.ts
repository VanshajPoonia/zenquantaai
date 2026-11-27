import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  ensureFromAuthUser: vi.fn(),
  updateProject: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  appendAuthCookies: vi.fn(),
}))
vi.mock('@/lib/db/repositories', () => ({
  neonProfilesRepository: { ensureFromAuthUser: mocks.ensureFromAuthUser },
  neonProjectsRepository: { update: mocks.updateProject, delete: vi.fn() },
}))

import { PATCH } from '@/app/api/projects/[id]/route'

const userAuth = {
  user: { id: 'user-a', loginId: 'alpha', email: null, role: 'user' },
  session: { refreshed: false },
}

async function patchProject(id: string, body: unknown): Promise<Response> {
  const response = await PATCH(
    new NextRequest(`http://localhost/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  )
  if (!response) throw new Error('Route did not return a response.')
  return response
}

describe('PATCH /api/projects/[id] instructions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthenticatedUser.mockResolvedValue(userAuth)
    mocks.updateProject.mockImplementation(
      async (userId: string, projectId: string, input: { instructions?: string }) =>
        userId === 'user-a' && projectId === 'proj-a'
          ? { id: projectId, name: 'Bakery', color: 'general', ...input }
          : null
    )
  })

  it('returns 401 when signed out', async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await patchProject('proj-a', { instructions: 'Keep it short.' })

    expect(response.status).toBe(401)
    expect(mocks.updateProject).not.toHaveBeenCalled()
  })

  it('returns 404 for another user project', async () => {
    const response = await patchProject('proj-b', { instructions: 'Keep it short.' })

    expect(response.status).toBe(404)
    expect(mocks.updateProject).toHaveBeenCalledWith('user-a', 'proj-b', {
      instructions: 'Keep it short.',
    })
  })

  it('saves trimmed instructions for the owner', async () => {
    const response = await patchProject('proj-a', {
      instructions: '  We are a 3-person bakery.  ',
    })

    expect(response.status).toBe(200)
    expect(mocks.updateProject).toHaveBeenCalledWith('user-a', 'proj-a', {
      instructions: 'We are a 3-person bakery.',
    })
    expect((await response.json()).instructions).toBe('We are a 3-person bakery.')
  })

  it('clears instructions with null', async () => {
    const response = await patchProject('proj-a', { instructions: null })

    expect(response.status).toBe(200)
    expect(mocks.updateProject).toHaveBeenCalledWith('user-a', 'proj-a', { instructions: '' })
  })

  it('leaves instructions alone when the field is missing', async () => {
    await patchProject('proj-a', { name: 'Bakery' })

    expect(mocks.updateProject).toHaveBeenCalledWith('user-a', 'proj-a', { name: 'Bakery' })
  })

  it('rejects text over 4,000 characters and the wrong type', async () => {
    const long = await patchProject('proj-a', { instructions: 'a'.repeat(4_001) })
    expect(long.status).toBe(400)
    expect((await long.json()).error).toBe('Instructions can be up to 4,000 characters.')

    expect((await patchProject('proj-a', { instructions: ['x'] })).status).toBe(400)
    expect(mocks.updateProject).not.toHaveBeenCalled()
  })
})
