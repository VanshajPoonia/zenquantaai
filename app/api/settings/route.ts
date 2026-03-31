import { NextRequest, NextResponse } from 'next/server'
import { settingsStore } from '@/lib/storage'
import { AppSettingsPatch } from '@/types'

export const runtime = 'nodejs'

export async function GET() {
  const settings = await settingsStore.get()
  return NextResponse.json(settings)
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as AppSettingsPatch
  const settings = await settingsStore.patch(body)

  return NextResponse.json(settings)
}
