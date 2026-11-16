import 'server-only'

import { createModels, type Models } from '@earendil-works/pi-ai/models'
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter'
import type { Api, Model } from '@earendil-works/pi-ai'
import type { ClientIdentity } from '@earendil-works/pi-ai'

let cachedModels: Models | null = null

export function getAgentModels(): Models {
  if (!cachedModels) {
    const models = createModels()
    models.setProvider(openrouterProvider())
    cachedModels = models
  }
  return cachedModels
}

const FALLBACK_MODEL_ID = 'openai/gpt-5-mini'

/** Looks up an OpenRouter model in pi's catalog, or shapes an unknown ID like a chat-completions model. */
export function resolveAgentModel(modelId: string): Model<Api> {
  const models = getAgentModels()
  const known = models.getModel('openrouter', modelId)
  if (known) return known

  const template = models.getModel('openrouter', FALLBACK_MODEL_ID)
  if (!template) throw new Error(`Model ${modelId} is not available.`)
  return { ...template, id: modelId, name: modelId }
}

export function getOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  if (!key) throw new Error('The AI gateway is not configured.')
  return key
}

export function getAgentIdentity(): ClientIdentity {
  return {
    userAgent: { custom: 'zenquanta' },
    attribution: {
      name: 'Zenquanta AI',
      url: process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://zqai.vercel.app',
    },
  }
}
