import { MessageRole } from '@/types'
import { OPENROUTER_DEFAULT_BASE_URL } from '@/lib/config'

const OPENROUTER_REQUEST_TIMEOUT_MS = 45_000
const OPENROUTER_STREAM_IDLE_TIMEOUT_MS = 30_000
const OPENROUTER_TIMEOUT_MESSAGE = 'The model request timed out. Please try again.'

type OpenRouterMessage = {
  role: MessageRole
  content: string
}

type OpenRouterCreateChatCompletionParams = {
  model: string
  messages: OpenRouterMessage[]
  temperature?: number
  max_tokens?: number
  top_p?: number
  stream?: boolean
}

type OpenRouterCreateChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string
            text?: string
          }>
      images?: Array<{
        type?: string
        image_url?: {
          url?: string
        }
      }>
    }
  }>
  error?: {
    message?: string
  }
}

type OpenRouterStreamChunk = {
  choices?: Array<{
    delta?: {
      content?:
        | string
        | Array<{
            type?: string
            text?: string
          }>
    }
  }>
}

type OpenRouterContent =
  | string
  | Array<{
      type?: string
      text?: string
    }>
  | undefined

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '')
}

function extractContent(content: OpenRouterContent): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part: { text?: string }) =>
        typeof part?.text === 'string' ? part.text : ''
      )
      .join('')
      .trim()
  }

  return ''
}

function debugOpenRouter(stage: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return
  console.debug(`[zenquanta/openrouter] ${stage}`, details ?? {})
}

function toTimeoutError(stage: string): Error {
  return new Error(`${OPENROUTER_TIMEOUT_MESSAGE} (${stage})`)
}

function createTimeoutSignal(timeoutMs: number, stage: string) {
  const controller = new AbortController()
  let timeoutId = setTimeout(() => {
    controller.abort(toTimeoutError(stage))
  }, timeoutMs)

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId),
    reset: (nextTimeoutMs = timeoutMs, nextStage = stage) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        controller.abort(toTimeoutError(nextStage))
      }, nextTimeoutMs)
    },
  }
}

function normalizeAbortError(error: unknown): never {
  if (error instanceof Error) {
    const name = (error as Error & { name?: string }).name
    if (name === 'AbortError' || error.message.includes(OPENROUTER_TIMEOUT_MESSAGE)) {
      throw new Error(OPENROUTER_TIMEOUT_MESSAGE)
    }
  }

  throw error
}

export function getOpenRouterRuntimeConfig() {
  return {
    apiKey: process.env.OPENROUTER_API_KEY?.trim() ?? '',
    baseUrl: normalizeBaseUrl(
      process.env.OPENROUTER_BASE_URL?.trim() || OPENROUTER_DEFAULT_BASE_URL
    ),
  }
}

export function hasOpenRouterConfig(): boolean {
  return Boolean(getOpenRouterRuntimeConfig().apiKey)
}

export const openRouterClient = {
  chat: {
    completions: {
      async create(
        params: OpenRouterCreateChatCompletionParams
      ): Promise<OpenRouterCreateChatCompletionResponse> {
        const runtimeConfig = getOpenRouterRuntimeConfig()

        if (!runtimeConfig.apiKey) {
          throw new Error('OPENROUTER_API_KEY is not configured.')
        }

        const timeout = createTimeoutSignal(
          OPENROUTER_REQUEST_TIMEOUT_MS,
          'chat-completion'
        )

        try {
          debugOpenRouter('request-start', {
            route: 'chat/completions',
            model: params.model,
            stream: params.stream ?? false,
          })

          const response = await fetch(
            `${runtimeConfig.baseUrl}/chat/completions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${runtimeConfig.apiKey}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Zenquanta AI',
              },
              body: JSON.stringify(params),
              signal: timeout.signal,
            }
          )

          const data = (await response.json().catch(() => null)) as
            | OpenRouterCreateChatCompletionResponse
            | null

          if (!response.ok) {
            throw new Error(
              data?.error?.message ??
                `OpenRouter request failed with status ${response.status}.`
            )
          }

          debugOpenRouter('request-success', {
            route: 'chat/completions',
            model: params.model,
            stream: params.stream ?? false,
          })

          return data ?? {}
        } catch (error) {
          if (
            error instanceof Error &&
            (error.name === 'AbortError' ||
              error.message.includes(OPENROUTER_TIMEOUT_MESSAGE))
          ) {
            debugOpenRouter('request-timeout', {
              route: 'chat/completions',
              model: params.model,
              stream: params.stream ?? false,
            })
          }

          normalizeAbortError(error)
        } finally {
          timeout.cancel()
        }
      },
    },
  },
}

async function* parseSseLines(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const extractSsePayload = (rawEvent: string): string | null => {
    if (!rawEvent.trim()) return null

    const dataLines = rawEvent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith(':'))
      .flatMap((line) => {
        if (!line.startsWith('data:')) return []
        return [line.slice(5).trimStart()]
      })

    if (dataLines.length === 0) return null

    const payload = dataLines.join('\n').trim()
    return payload.length > 0 ? payload : null
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      buffer += decoder.decode()
      break
    }

    buffer += decoder
      .decode(value, { stream: true })
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    let boundaryIndex = buffer.indexOf('\n\n')

    while (boundaryIndex !== -1) {
      const rawEvent = buffer.slice(0, boundaryIndex)
      buffer = buffer.slice(boundaryIndex + 2)

      const payload = extractSsePayload(rawEvent)
      if (payload === '[DONE]') {
        return
      }

      if (payload) {
        yield payload
      }

      boundaryIndex = buffer.indexOf('\n\n')
    }
  }

  const trailingPayload = extractSsePayload(buffer)
  if (trailingPayload && trailingPayload !== '[DONE]') {
    yield trailingPayload
  }
}

export async function createOpenRouterTextResponse(input: {
  model: string
  messages: OpenRouterMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
}): Promise<string> {
  const response = await openRouterClient.chat.completions.create({
    model: input.model,
    messages: input.messages,
    ...(typeof input.temperature === 'number'
      ? { temperature: input.temperature }
      : {}),
    ...(typeof input.maxTokens === 'number'
      ? { max_tokens: input.maxTokens }
      : {}),
    ...(typeof input.topP === 'number'
      ? { top_p: input.topP }
      : {}),
    stream: false,
  })

  const content = extractContent(response.choices?.[0]?.message?.content)

  if (!content) {
    throw new Error('OpenRouter returned an empty assistant response.')
  }

  return content
}

export async function* streamOpenRouterTextResponse(input: {
  model: string
  messages: OpenRouterMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
}): AsyncIterable<string> {
  const runtimeConfig = getOpenRouterRuntimeConfig()

  if (!runtimeConfig.apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.')
  }

  const timeout = createTimeoutSignal(
    OPENROUTER_REQUEST_TIMEOUT_MS,
    'streaming-request'
  )

  try {
    debugOpenRouter('stream-start', {
      route: 'chat/completions',
      model: input.model,
    })

    const response = await fetch(`${runtimeConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runtimeConfig.apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Zenquanta AI',
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        ...(typeof input.temperature === 'number'
          ? { temperature: input.temperature }
          : {}),
        ...(typeof input.maxTokens === 'number'
          ? { max_tokens: input.maxTokens }
          : {}),
        ...(typeof input.topP === 'number'
          ? { top_p: input.topP }
          : {}),
        stream: true,
      }),
      signal: timeout.signal,
    })

    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => null)) as
        | OpenRouterCreateChatCompletionResponse
        | null

      throw new Error(
        data?.error?.message ??
          `OpenRouter streaming request failed with status ${response.status}.`
      )
    }

    let receivedChunkCount = 0

    try {
      for await (const payload of parseSseLines(response.body)) {
        timeout.reset(OPENROUTER_STREAM_IDLE_TIMEOUT_MS, 'stream-idle')
        let parsed: OpenRouterStreamChunk

        try {
          parsed = JSON.parse(payload) as OpenRouterStreamChunk
        } catch (error) {
          debugOpenRouter('stream-parse-failure', {
            route: 'chat/completions',
            model: input.model,
            payload,
            error: error instanceof Error ? error.message : 'Unknown parse error',
          })
          throw new Error('The model stream returned an unreadable response.')
        }

        const content = extractContent(parsed.choices?.[0]?.delta?.content)
        if (content) {
          receivedChunkCount += 1
          if (receivedChunkCount === 1) {
            debugOpenRouter('stream-first-chunk', {
              route: 'chat/completions',
              model: input.model,
            })
          }
          yield content
        }
      }
    } finally {
      timeout.cancel()
    }

    debugOpenRouter('stream-success', {
      route: 'chat/completions',
      model: input.model,
      receivedChunks: receivedChunkCount,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.includes(OPENROUTER_TIMEOUT_MESSAGE) ||
        error.message.includes('stream-idle'))
    ) {
      debugOpenRouter('stream-timeout', {
        route: 'chat/completions',
        model: input.model,
      })
      throw new Error(OPENROUTER_TIMEOUT_MESSAGE)
    }

    throw error
  } finally {
    timeout.cancel()
  }
}

export async function createOpenRouterImage(input: {
  model: string
  prompt: string
  systemPrompt?: string
  modalities?: Array<'image' | 'text'>
}): Promise<{
  content: string
  imageUrl: string
}> {
  const runtimeConfig = getOpenRouterRuntimeConfig()

  if (!runtimeConfig.apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.')
  }

  const messages: OpenRouterMessage[] = [
    ...(input.systemPrompt
      ? [{ role: 'system' as const, content: input.systemPrompt }]
      : []),
    { role: 'user', content: input.prompt },
  ]

  const timeout = createTimeoutSignal(
    OPENROUTER_REQUEST_TIMEOUT_MS,
    'image-generation'
  )

  try {
    debugOpenRouter('image-start', {
      route: 'chat/completions',
      model: input.model,
    })

    const response = await fetch(`${runtimeConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runtimeConfig.apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Zenquanta AI',
      },
      body: JSON.stringify({
        model: input.model,
        messages,
        modalities: input.modalities ?? ['image'],
      }),
      signal: timeout.signal,
    })

    const data = (await response.json().catch(() => null)) as
      | OpenRouterCreateChatCompletionResponse
      | null

    if (!response.ok) {
      throw new Error(
        data?.error?.message ??
          `OpenRouter image request failed with status ${response.status}.`
      )
    }

    const message = data?.choices?.[0]?.message
    const imageUrl = message?.images?.[0]?.image_url?.url?.trim()

    if (!imageUrl) {
      throw new Error('No image was returned from the image generation request.')
    }

    debugOpenRouter('image-success', {
      route: 'chat/completions',
      model: input.model,
    })

    return {
      content:
        extractContent(message?.content) ||
        "I've generated an image based on your prompt.",
      imageUrl,
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.includes(OPENROUTER_TIMEOUT_MESSAGE))
    ) {
      debugOpenRouter('image-timeout', {
        route: 'chat/completions',
        model: input.model,
      })
      throw new Error(OPENROUTER_TIMEOUT_MESSAGE)
    }

    throw error
  } finally {
    timeout.cancel()
  }
}
