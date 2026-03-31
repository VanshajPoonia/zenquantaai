import { MessageRole } from '@/types'
import { OPENROUTER_DEFAULT_BASE_URL } from '@/lib/config'

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

        return data ?? {}
      },
    },
  },
}

async function* parseSseLines(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const dataLines = chunk
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data: '))

      for (const line of dataLines) {
        const payload = line.slice(6).trim()
        if (!payload || payload === '[DONE]') continue
        yield payload
      }
    }
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

  for await (const payload of parseSseLines(response.body)) {
    const parsed = JSON.parse(payload) as OpenRouterStreamChunk
    const content = extractContent(parsed.choices?.[0]?.delta?.content)
    if (content) {
      yield content
    }
  }
}
