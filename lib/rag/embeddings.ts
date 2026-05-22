import 'server-only'

export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

type EmbeddingResponse = {
  data?: Array<{
    embedding?: unknown
    index?: number
  }>
}

function getEmbeddingApiKey(): string | null {
  const key =
    process.env.EMBEDDINGS_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    ''

  return key || null
}

function getEmbeddingBaseUrl(): string {
  return (
    process.env.EMBEDDINGS_BASE_URL?.trim().replace(/\/$/, '') ||
    'https://api.openai.com/v1'
  )
}

export function getEmbeddingModel(): string {
  return process.env.EMBEDDINGS_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL
}

export function hasEmbeddingConfig(): boolean {
  return Boolean(getEmbeddingApiKey())
}

function assertEmbedding(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new Error('Embedding provider returned an invalid vector.')
  }

  const embedding = value.map((item) => Number(item))
  if (
    embedding.length !== EMBEDDING_DIMENSIONS ||
    embedding.some((item) => !Number.isFinite(item))
  ) {
    throw new Error(
      `Embedding provider returned a vector that is not ${EMBEDDING_DIMENSIONS} dimensions.`
    )
  }

  return embedding
}

export async function createEmbeddings(input: string[]): Promise<number[][]> {
  const texts = input.map((value) => value.trim()).filter(Boolean)
  if (texts.length === 0) return []

  const apiKey = getEmbeddingApiKey()
  if (!apiKey) {
    throw new Error('Embedding provider is not configured.')
  }

  const response = await fetch(`${getEmbeddingBaseUrl()}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getEmbeddingModel(),
      input: texts,
      encoding_format: 'float',
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(
      message || `Embedding provider failed with status ${response.status}.`
    )
  }

  const body = (await response.json().catch(() => null)) as EmbeddingResponse | null
  const items = [...(body?.data ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  )

  if (items.length !== texts.length) {
    throw new Error('Embedding provider returned an unexpected result count.')
  }

  return items.map((item) => assertEmbedding(item.embedding))
}
