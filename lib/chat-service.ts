'use client'

import {
  AIMode,
  Attachment,
  AttachmentContext,
  ChatAction,
  ChatRequest,
  Conversation,
  ImageGenerateRequest,
  ImageGenerateResponse,
  Message,
  SessionSettings,
  StreamEvent,
} from '@/types'
import { readNdjsonStream } from '@/lib/utils/stream'

export class ChatServiceRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ChatServiceRequestError'
    this.status = status
  }
}

export interface ChatServiceRequest {
  action: ChatAction
  conversationId?: string
  conversation?: Conversation
  messages?: Message[]
  mode: AIMode
  targetMode?: AIMode
  content?: string
  requestedModelId?: string
  settings: SessionSettings
  targetMessageId?: string
  attachments?: Attachment[]
  attachmentContext?: AttachmentContext[]
}

export interface ImageChatServiceRequest {
  action?: ChatAction
  conversationId?: string
  conversation?: Conversation
  messages?: Message[]
  mode: AIMode
  targetMode?: AIMode
  prompt?: string
  content?: string
  requestedModelId?: string
  settings: SessionSettings
  targetMessageId?: string
  attachments?: Attachment[]
  negativePrompt?: string | null
  size?: string | null
  aspectRatio?: string | null
  imageCount?: number
}

interface StreamChatServiceOptions {
  signal?: AbortSignal
  onEvent: (event: StreamEvent) => void
}

interface GenerateImageServiceOptions {
  signal?: AbortSignal
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null

  return body?.error ?? fallback
}

function buildChatRequest(request: ChatServiceRequest): ChatRequest {
  return {
    action: request.action,
    conversationId: request.conversationId,
    conversation: request.conversation,
    mode: request.mode,
    targetMode: request.targetMode,
    content: request.content,
    requestedModelId: request.requestedModelId,
    settings: request.settings,
    targetMessageId: request.targetMessageId,
    attachments: request.attachments,
    attachmentContext: request.attachmentContext,
  }
}

function buildImageRequest(request: ImageChatServiceRequest): ImageGenerateRequest {
  return {
    action: request.action,
    conversationId: request.conversationId,
    conversation: request.conversation,
    mode: request.mode,
    targetMode: request.targetMode,
    prompt: request.prompt,
    content: request.content,
    requestedModelId: request.requestedModelId,
    settings: request.settings,
    targetMessageId: request.targetMessageId,
    attachments: request.attachments,
    negativePrompt: request.negativePrompt,
    size: request.size,
    aspectRatio: request.aspectRatio,
    imageCount: request.imageCount,
  }
}

export async function streamChatServiceResponse(
  request: ChatServiceRequest,
  options: StreamChatServiceOptions
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildChatRequest(request)),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new ChatServiceRequestError(
      await readErrorMessage(response, 'Unable to send chat request.'),
      response.status
    )
  }

  await readNdjsonStream<StreamEvent>(response, options.onEvent)
}

export async function generateImageServiceResponse(
  request: ImageChatServiceRequest,
  options: GenerateImageServiceOptions = {}
): Promise<ImageGenerateResponse> {
  const response = await fetch('/api/images/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildImageRequest(request)),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new ChatServiceRequestError(
      await readErrorMessage(response, 'Unable to generate image.'),
      response.status
    )
  }

  const data = (await response.json()) as ImageGenerateResponse

  if (!data?.conversation || !data?.message) {
    throw new Error('Image response was incomplete.')
  }

  return data
}
