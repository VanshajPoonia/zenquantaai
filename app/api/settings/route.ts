import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonSettingsRepository,
} from '@/lib/db/repositories'
import {
  ABOUT_YOU_MAX_CHARS,
  RESPONSE_INSTRUCTIONS_MAX_CHARS,
} from '@/lib/ai/user-instructions'
import { AppSettingsPatch } from '@/types'

export const runtime = 'nodejs'

const INSTRUCTION_FIELDS = [
  { field: 'aboutYou', label: 'About you', max: ABOUT_YOU_MAX_CHARS },
  {
    field: 'responseInstructions',
    label: 'How to answer',
    max: RESPONSE_INSTRUCTIONS_MAX_CHARS,
  },
] as const

function validatePersonalization(body: AppSettingsPatch): string | null {
  for (const { field, label, max } of INSTRUCTION_FIELDS) {
    const value: unknown = body[field]
    if (typeof value === 'undefined') continue
    if (typeof value !== 'string') return `${label} must be text.`
    if (value.length > max) {
      return `${label} can be up to ${max.toLocaleString('en-US')} characters.`
    }
  }

  const useCustom: unknown = body.useCustomInstructions
  if (typeof useCustom !== 'undefined' && typeof useCustom !== 'boolean') {
    return 'useCustomInstructions must be true or false.'
  }

  return null
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const settings = await neonSettingsRepository.get(auth.user.id)
  const response = NextResponse.json(settings)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = (await request.json().catch(() => ({}))) as AppSettingsPatch
  const validationError = validatePersonalization(body ?? {})
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const settings = await neonSettingsRepository.patch(auth.user.id, body)

  const response = NextResponse.json(settings)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
