import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  requireAuthenticatedUser,
} from '@/lib/auth/session'
import { createSessionSettings } from '@/lib/config'
import { conversationStore, settingsStore } from '@/lib/storage'
import { encodeStreamEvent } from '@/lib/utils/stream'
import { ChatRequest } from '@/types'
import {
  completeConversationWithAssistant,
  generateAssistantStream,
  prepareConversationForChat,
  resolveSessionSettings,
} from '@/lib/ai/chat'

export const runtime = 'nodejs'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'An unknown chat error occurred.'
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as Partial<ChatRequest> | null

  if (!body?.action || !body.mode) {
    return NextResponse.json(
      { error: 'Chat action and mode are required.' },
      { status: 400 }
    )
  }

  const appSettings = await settingsStore.get(auth.user.id)
  const settings = resolveSessionSettings(
    body.mode,
    body.settings,
    createSessionSettings(body.mode, appSettings.sessionDefaults)
  )

  const storedConversation = body.conversationId
    ? await conversationStore.get(auth.user.id, body.conversationId)
    : null

  const payload: ChatRequest = {
    action: body.action,
    conversationId: storedConversation?.id ?? body.conversationId,
    conversation: storedConversation ?? body.conversation,
    mode: body.mode,
    targetMode: body.targetMode,
    content: body.content,
    settings,
    targetMessageId: body.targetMessageId,
    attachments: body.attachments,
    attachmentContext: body.attachmentContext,
  }

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  void (async () => {
    let conversationId = storedConversation?.id ?? payload.conversationId
    let messageId: string | undefined

    try {
      const prepared = await prepareConversationForChat(payload)
      const persistedConversation = await conversationStore.save(
        auth.user.id,
        prepared.conversation
      )

      conversationId = persistedConversation.id
      messageId = prepared.assistantPlaceholder.id

      await writer.write(
        encodeStreamEvent({
          type: 'start',
          conversation: persistedConversation,
          message: prepared.assistantPlaceholder,
        })
      )

      let accumulated = ''

      for await (const chunk of generateAssistantStream({
        conversation: prepared.generationConversation,
        settings: payload.settings,
        mode: prepared.assistantMode,
        action: payload.action,
      })) {
        accumulated += chunk

        await writer.write(
          encodeStreamEvent({
            type: 'delta',
            conversationId: persistedConversation.id,
            messageId: prepared.assistantPlaceholder.id,
            delta: chunk,
          })
        )
      }

      const completedConversation = await completeConversationWithAssistant(
        persistedConversation,
        prepared.assistantPlaceholder,
        accumulated || 'No response returned.',
        prepared.generationConversation,
        prepared.assistantMode,
        {
          action: payload.action,
          userMessage: prepared.userMessage,
        }
      )

      const savedConversation = await conversationStore.save(
        auth.user.id,
        completedConversation
      )

      await writer.write(
        encodeStreamEvent({
          type: 'done',
          conversation: savedConversation,
          message: {
            ...prepared.assistantPlaceholder,
            content: accumulated || 'No response returned.',
            status: 'complete',
            usage: savedConversation.messages.at(-1)?.usage,
          },
          usage: savedConversation.messages.at(-1)?.usage,
        })
      )
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

  const headers = new Headers({
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })

  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  return new Response(stream.readable, { headers })
}
