'use client'

import { useCallback } from 'react'
import { DEFAULT_PROJECT_ID } from '@/lib/config'
import {
  createPendingSend,
  debugSendPipeline,
  resolveSend,
} from '@/lib/chat/sendMessage'
import {
  AIMode,
  Attachment,
  Conversation,
  PendingAttachment,
  ResolvedSend,
  SessionSettings,
} from '@/types'

export interface UseSendMessageInput {
  content: string
  attachments?: Array<Attachment | PendingAttachment>
  kind?: 'chat' | 'image'
  modeOverride?: AIMode
  customAssistantId?: string | null
}

interface PreparedSendDispatch {
  input: UseSendMessageInput
  resolvedSend: ResolvedSend
  dispatchOptions: {
    conversationId?: string
    mode: AIMode
    settings: SessionSettings
    projectId: string
  }
}

interface QueuedPrompt {
  id: string
  input: UseSendMessageInput
  mode: AIMode
  settings: SessionSettings
  projectId: string
  conversationId?: string
  customAssistantId?: string | null
}

export function useSendMessage(input: {
  currentMode: AIMode
  currentCustomAssistantId?: string | null
  currentChatId?: string
  currentChatSessionSettings?: SessionSettings | null
  draftSessionSettings: SessionSettings
  selectedProjectId: 'all' | string
  normalizeModeSessionSettings: (
    mode: AIMode,
    settings: SessionSettings
  ) => SessionSettings
  hasActiveSend: () => boolean
  enqueuePrompt: (prompt: QueuedPrompt) => void
  executeSendMessage: (
    payload: Omit<UseSendMessageInput, 'modeOverride'>,
    options: {
      conversationId?: string
      mode: AIMode
      settings: SessionSettings
      projectId: string
    }
  ) => Promise<Conversation | null>
}) {
  const preparePendingSend = useCallback(
    (payload: UseSendMessageInput): PreparedSendDispatch => {
      const resolvedMode = payload.modeOverride ?? input.currentMode
      const customAssistantId =
        payload.customAssistantId ?? input.currentCustomAssistantId ?? null
      const settings = input.normalizeModeSessionSettings(
        resolvedMode,
        input.currentChatSessionSettings ?? input.draftSessionSettings
      )
      const projectId =
        input.selectedProjectId === 'all'
          ? DEFAULT_PROJECT_ID
          : input.selectedProjectId
      const pendingSend = createPendingSend({
        content: payload.content,
        attachments: payload.attachments,
        kind: payload.kind,
        originalMode: input.currentMode,
        resolvedMode,
        conversationId: input.currentChatId,
        projectId,
        settings,
        customAssistantId,
      })

      return {
        input: {
          ...payload,
          customAssistantId,
        },
        resolvedSend: resolveSend(pendingSend),
        dispatchOptions: {
          conversationId: input.currentChatId,
          mode: resolvedMode,
          settings,
          projectId,
        },
      }
    },
    [input]
  )

  const finalizeSend = useCallback(
    (
      outcome: 'queued' | 'dispatched' | 'failed',
      prepared: PreparedSendDispatch,
      error?: unknown
    ) => {
      debugSendPipeline('send-finalized', {
        outcome,
        sendId: prepared.resolvedSend.sendId,
        mode: prepared.resolvedSend.resolvedMode,
        transport: prepared.resolvedSend.transport,
        conversationId: prepared.dispatchOptions.conversationId,
        error: error instanceof Error ? error.message : null,
      })
    },
    []
  )

  const dispatchPreparedSend = useCallback(
    (prepared: PreparedSendDispatch) => {
      debugSendPipeline('dispatch-confirmed', {
        sendId: prepared.resolvedSend.sendId,
        mode: prepared.resolvedSend.resolvedMode,
        transport: prepared.resolvedSend.transport,
        route:
          prepared.resolvedSend.transport === 'image'
            ? '/api/images/generate'
            : '/api/chat',
      })

      void input
        .executeSendMessage(
          {
            content: prepared.input.content,
            attachments: prepared.input.attachments,
            kind:
              prepared.resolvedSend.transport === 'image' ? 'image' : 'chat',
            customAssistantId: prepared.input.customAssistantId,
          },
          prepared.dispatchOptions
        )
        .catch((error) => {
          debugSendPipeline('dispatch-unhandled-failure', {
            sendId: prepared.resolvedSend.sendId,
            mode: prepared.resolvedSend.resolvedMode,
            transport: prepared.resolvedSend.transport,
            error: error instanceof Error ? error.message : 'Unknown dispatch error',
          })
          finalizeSend('failed', prepared, error)
        })
    },
    [finalizeSend, input]
  )

  const dispatchTextMessage = useCallback(
    (prepared: PreparedSendDispatch) => {
      dispatchPreparedSend(prepared)
    },
    [dispatchPreparedSend]
  )

  const dispatchImageMessage = useCallback(
    (prepared: PreparedSendDispatch) => {
      dispatchPreparedSend(prepared)
    },
    [dispatchPreparedSend]
  )

  const confirmAndDispatch = useCallback(
    async (payload: UseSendMessageInput) => {
      const prepared = preparePendingSend(payload)

      if (input.hasActiveSend()) {
        input.enqueuePrompt({
          id: crypto.randomUUID(),
          input: {
            ...payload,
            kind:
              prepared.resolvedSend.transport === 'image' ? 'image' : 'chat',
            modeOverride: prepared.resolvedSend.resolvedMode,
            customAssistantId: prepared.input.customAssistantId,
          },
          mode: prepared.resolvedSend.resolvedMode,
          settings: prepared.dispatchOptions.settings,
          projectId: prepared.dispatchOptions.projectId,
          conversationId: prepared.dispatchOptions.conversationId,
          customAssistantId: prepared.input.customAssistantId,
        })
        debugSendPipeline('request-queued', {
          sendId: prepared.resolvedSend.sendId,
          mode: prepared.resolvedSend.resolvedMode,
          transport: prepared.resolvedSend.transport,
          conversationId: prepared.dispatchOptions.conversationId,
        })
        finalizeSend('queued', prepared)
        return
      }

      if (prepared.resolvedSend.transport === 'image') {
        dispatchImageMessage(prepared)
      } else {
        dispatchTextMessage(prepared)
      }

      finalizeSend('dispatched', prepared)
    },
    [
      dispatchImageMessage,
      dispatchTextMessage,
      finalizeSend,
      input,
      preparePendingSend,
    ]
  )

  const sendMessage = useCallback(
    async (payload: UseSendMessageInput) => {
      await confirmAndDispatch(payload)
    },
    [confirmAndDispatch]
  )

  return {
    preparePendingSend,
    confirmAndDispatch,
    dispatchTextMessage,
    dispatchImageMessage,
    finalizeSend,
    sendMessage,
  }
}
