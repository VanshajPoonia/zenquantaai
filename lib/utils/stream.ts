import { StreamEvent } from '@/types'

const encoder = new TextEncoder()

export function encodeStreamEvent(event: StreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`)
}

export async function readNdjsonStream<T>(
  response: Response,
  onEvent: (event: T) => void
): Promise<void> {
  if (!response.body) {
    throw new Error('Streaming response body is unavailable.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      onEvent(JSON.parse(trimmed) as T)
    }
  }

  const finalChunk = buffer.trim()
  if (finalChunk) {
    onEvent(JSON.parse(finalChunk) as T)
  }
}
