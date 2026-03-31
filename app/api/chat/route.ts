import { NextRequest, NextResponse } from 'next/server'
import { createSessionSettings } from '@/lib/config'
import { settingsStore } from '@/lib/storage'
import { encodeStreamEvent } from '@/lib/utils/stream'
import { ChatRequest } from '@/types'
import { resolveSessionSettings, streamConversationReply } from '@/lib/ai/chat'

export const runtime = 'nodejs'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'An unknown chat error occurred.'
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Partial<ChatRequest> | null

  if (!body?.action || !body.mode) {
    return NextResponse.json(
      { error: 'Chat action and mode are required.' },
      { status: 400 }
    )
  }

  const appSettings = await settingsStore.get()
  const settings = resolveSessionSettings(
    body.mode,
    body.settings,
    createSessionSettings(body.mode, appSettings.sessionDefaults)
  )

  const payload: ChatRequest = {
    action: body.action,
    conversationId: body.conversationId,
    mode: body.mode,
    content: body.content,
    settings,
    targetMessageId: body.targetMessageId,
  }

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  void (async () => {
    let conversationId = payload.conversationId
    let messageId: string | undefined

    try {
      for await (const event of streamConversationReply(payload)) {
        if (event.type === 'start') {
          conversationId = event.conversation.id
          messageId = event.message.id
        }

        await writer.write(encodeStreamEvent(event))
      }
    } catch (error) {
      await writer.write(
        encodeStreamEvent({
          type: 'error',
          conversationId,
          messageId,
          error: toErrorMessage(error),
          recoverable: true,
        })
      )
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
