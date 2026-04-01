import {
  AIMode,
  Attachment,
  PendingAttachment,
  PendingSend,
  ResolvedSend,
  SendTransport,
  SessionSettings,
} from '@/types'
import { resolveModelConfig } from '@/lib/config'
import { createId, createMessage } from '@/lib/utils/chat'

const SEND_DEBUG_ENABLED = process.env.NODE_ENV !== 'production'

export function debugSendPipeline(
  stage: string,
  details?: Record<string, unknown>
) {
  if (!SEND_DEBUG_ENABLED) return

  console.debug(`[zenquanta/send] ${stage}`, details ?? {})
}

export function resolveSendTransport(input: {
  kind?: 'chat' | 'image'
  mode: AIMode
}): SendTransport {
  return input.kind === 'image' || input.mode === 'image' ? 'image' : 'text'
}

export function createPendingSend(input: {
  content: string
  attachments?: Array<Attachment | PendingAttachment>
  kind?: 'chat' | 'image'
  originalMode: AIMode
  resolvedMode: AIMode
  conversationId?: string
  projectId: string
  settings: SessionSettings
}): PendingSend {
  return {
    sendId: createId('send'),
    content: input.content,
    attachments: input.attachments ?? [],
    kind: input.kind ?? 'chat',
    originalMode: input.originalMode,
    resolvedMode: input.resolvedMode,
    conversationId: input.conversationId,
    projectId: input.projectId,
    settings: input.settings,
  }
}

export function resolveSend(input: PendingSend): ResolvedSend {
  return {
    ...input,
    transport: resolveSendTransport({
      kind: input.kind,
      mode: input.resolvedMode,
    }),
  }
}

export function createAssistantPlaceholder(input: {
  mode: AIMode
  settings: SessionSettings
  parentUserMessageId?: string
  branchLabel?: string
}) {
  return createMessage({
    role: 'assistant',
    content: '',
    mode: input.mode,
    status: 'streaming',
    model: resolveModelConfig(input.mode, input.settings.modelOverride).model,
    provider: 'openrouter',
    parentUserMessageId: input.parentUserMessageId,
    branchLabel: input.branchLabel,
  })
}
