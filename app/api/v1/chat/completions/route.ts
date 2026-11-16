import { NextRequest, NextResponse } from 'next/server'
import { requireApiTokenUser } from '@/lib/auth/api-token'
import { AgentLimitError, AgentMeter } from '@/lib/agent/metering'
import { isZqModelName, resolveZqModel, type ZqModelName } from '@/lib/agent/model-names'
import { stepUsageFromOpenRouter, type OpenRouterUsage } from '@/lib/agent/openrouter-usage'
import { getEffectiveSubscription } from '@/lib/billing/enforce'
import { AGENT_PLAN_LIMITS } from '@/lib/config'
import {
  neonAgentRunsRepository,
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
const CLIENT_ID_PATTERN = /^[\w.-]{1,80}$/
// Fields a client may set. Routing, plugins and model lists stay server-side.
const FORWARDED_FIELDS = [
  'messages',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'temperature',
  'top_p',
  'stop',
  'seed',
  'response_format',
] as const

function apiError(status: number, message: string, code: string) {
  return NextResponse.json({ error: { message, type: 'invalid_request_error', code } }, { status })
}

function readClientId(request: NextRequest, header: string): string | null {
  const value = request.headers.get(header)?.trim()
  return value && CLIENT_ID_PATTERN.test(value) ? value : null
}

/** Replaces raw OpenRouter model IDs with the Zenquanta name in a response chunk. */
function scrubChunk(chunk: Record<string, unknown>, name: ZqModelName) {
  chunk.model = name
  delete chunk.provider
  return chunk
}

export async function POST(request: NextRequest) {
  const auth = await requireApiTokenUser(request, 'cli')
  if (auth.response) return auth.response

  if (!(await hitRateLimit(`v1:${auth.tokenId}`, 120, 60))) {
    return apiError(429, 'Too many requests. Slow down and try again.', 'rate_limited')
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) return apiError(503, 'The AI gateway is not configured.', 'not_configured')

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return apiError(400, '`messages` must be a non-empty array.', 'invalid_messages')
  }
  const modelName: ZqModelName = isZqModelName(body.model) ? body.model : 'forge'
  const stream = body.stream === true

  const subscription = await neonSubscriptionsRepository.ensureForUser(auth.user)
  const override = await neonUsageLimitOverridesRepository.getByUserId(auth.user.id)
  const effective = getEffectiveSubscription(subscription, override)
  const limits = AGENT_PLAN_LIMITS[subscription.tier]
  if (!limits.cliAccess) {
    return apiError(403, 'zq is not included in your current plan.', 'plan_required')
  }
  const resolved = resolveZqModel(modelName, subscription.tier, override)
  if (!resolved) {
    return apiError(403, `${modelName} is not available on your current plan.`, 'plan_required')
  }

  const requestedMax = typeof body.max_tokens === 'number' ? body.max_tokens : limits.maxAgentOutputTokens
  const maxTokens = Math.max(1, Math.min(Math.floor(requestedMax), limits.maxAgentOutputTokens))
  const estimatedPromptTokens = Math.ceil(JSON.stringify([body.messages, body.tools ?? []]).length / 4)

  const clientRunId = readClientId(request, 'x-zq-run-id')
  const run = clientRunId
    ? await neonAgentRunsRepository.findOrCreateClientRun({
        userId: auth.user.id,
        clientRunId,
        clientSessionId: readClientId(request, 'x-zq-session-id'),
      })
    : await neonAgentRunsRepository.create({ userId: auth.user.id, surface: 'cli' })
  if (run.stepCount >= limits.maxStepsPerRun) {
    return apiError(429, 'This run reached its step limit for your current plan.', 'step_limit')
  }

  const meter = new AgentMeter({
    userId: auth.user.id,
    tier: subscription.tier,
    walletType: resolved.walletType,
    effectiveIncluded:
      resolved.walletType === 'tier_tokens'
        ? effective.tierTokensIncluded
        : effective.coreTokensIncluded,
    limits,
    maxSteps: 1,
    maxOutputTokens: maxTokens,
    surface: 'cli',
    runId: run.id,
    event: {
      conversationId: null,
      messageId: null,
      assistantFamily: 'forge',
      mode: 'code',
      model: resolved.model,
    },
  })

  try {
    await meter.reserveStep(estimatedPromptTokens)
  } catch (error) {
    if (error instanceof AgentLimitError) return apiError(429, error.message, 'usage_limit')
    throw error
  }

  const upstreamBody: Record<string, unknown> = {}
  for (const field of FORWARDED_FIELDS) {
    if (field in body) upstreamBody[field] = body[field]
  }
  Object.assign(upstreamBody, {
    model: resolved.model,
    max_tokens: maxTokens,
    stream,
    usage: { include: true },
    ...(Array.isArray(body.tools) && body.tools.length
      ? { provider: { require_parameters: true } }
      : {}),
  })

  let upstream: Response
  try {
    upstream = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Zenquanta zq',
      },
      body: JSON.stringify(upstreamBody),
      signal: request.signal,
    })
  } catch {
    await meter.releasePending()
    return apiError(502, 'The model request failed. Please try again.', 'upstream_error')
  }

  if (!upstream.ok || !upstream.body) {
    await meter.releasePending()
    const detail = (await upstream.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    return apiError(
      upstream.status >= 500 ? 502 : upstream.status,
      detail?.error?.message ?? 'The model request failed.',
      'upstream_error'
    )
  }

  if (!stream) {
    const json = (await upstream.json()) as Record<string, unknown> & { usage?: OpenRouterUsage }
    if (json.usage) await meter.finalizeStep(stepUsageFromOpenRouter(json.usage))
    else await meter.releasePending()
    return NextResponse.json(scrubChunk(json, modelName))
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const reader = upstream.body.getReader()
  const output = new TransformStream<Uint8Array, Uint8Array>()
  const writer = output.writable.getWriter()

  void (async () => {
    let buffer = ''
    let usage: OpenRouterUsage | null = null
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let newline = buffer.indexOf('\n')
        while (newline >= 0) {
          const line = buffer.slice(0, newline)
          buffer = buffer.slice(newline + 1)
          newline = buffer.indexOf('\n')

          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            const chunk = JSON.parse(line.slice(6)) as Record<string, unknown> & {
              usage?: OpenRouterUsage
            }
            if (chunk.usage) usage = chunk.usage
            await writer.write(encoder.encode(`data: ${JSON.stringify(scrubChunk(chunk, modelName))}\n`))
          } else {
            await writer.write(encoder.encode(`${line}\n`))
          }
        }
      }
      if (usage) await meter.finalizeStep(stepUsageFromOpenRouter(usage))
    } catch (error) {
      console.error('Model API stream failed.', error)
    } finally {
      await meter.releasePending()
      await writer.close().catch(() => undefined)
    }
  })()

  return new Response(output.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
