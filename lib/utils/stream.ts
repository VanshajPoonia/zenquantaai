import { StreamEvent } from '@/types'

const encoder = new TextEncoder()

export function encodeStreamEvent(event: StreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`)
}

function parseNdjsonLine<T>(line: string): T | undefined {
  try {
    return JSON.parse(line) as T
  } catch (error) {
    console.error('Skipping malformed NDJSON line.', error)
    return undefined
  }
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
      const event = parseNdjsonLine<T>(trimmed)
      if (event !== undefined) onEvent(event)
    }
  }

  const finalChunk = buffer.trim()
  if (finalChunk) {
    const event = parseNdjsonLine<T>(finalChunk)
    if (event !== undefined) onEvent(event)
  }
}
