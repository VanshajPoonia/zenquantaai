import { NextRequest, NextResponse } from 'next/server'
import { createSessionSettings } from '@/lib/config'
import { conversationStore, settingsStore } from '@/lib/storage'
import { AIMode } from '@/types'

export const runtime = 'nodejs'

export async function GET() {
  const conversations = await conversationStore.list()
  return NextResponse.json(conversations)
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    mode?: AIMode
  }
  const settings = await settingsStore.get()
  const mode = body.mode ?? settings.defaultMode

  const conversation = await conversationStore.create({
    mode,
    sessionSettings: createSessionSettings(mode, settings.sessionDefaults),
  })

  return NextResponse.json(conversation, { status: 201 })
}
