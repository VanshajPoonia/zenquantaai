import { describe, expect, it, vi } from 'vitest'
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from '@earendil-works/pi-ai'
import { obj, str } from '@earendil-works/pi-schema'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { AgentRunEvent, StepUsage, ToolDetails } from '@/lib/agent/types'
import { runAgentTurn, toStepUsage } from '@/lib/agent/runtime'
import { AgentLimitError, billableTokens, buildStepUsageEstimate } from '@/lib/agent/metering'

vi.mock('server-only', () => ({}))

class FakeMeter {
  stepCount = 0
  reserved = 0
  finalized: StepUsage[] = []
  released = 0
  charges: Array<{ walletTokens: number; rawCostUsd: number }> = []
  constructor(private readonly maxSteps: number, private readonly failAt?: number) {}
  get reachedStepCap() {
    return this.stepCount >= this.maxSteps
  }
  async reserveStep() {
    if (this.failAt && this.stepCount + 1 >= this.failAt) {
      throw new AgentLimitError('You have reached your usage limit for this plan.')
    }
    this.stepCount += 1
    this.reserved += 1
  }
  async finalizeStep(usage: StepUsage) {
    this.finalized.push(usage)
    return null
  }
  addCharge(charge: { walletTokens: number; rawCostUsd: number }) {
    this.charges.push(charge)
  }
  async releasePending() {
    if (this.reserved > this.finalized.length + this.released) this.released += 1
  }
}

const echoParameters = obj({ text: str() })
function echoTool(): AgentTool<typeof echoParameters, ToolDetails> {
  return {
    name: 'echo',
    label: 'Echoed',
    description: 'Echo text back.',
    parameters: echoParameters,
    execute: async (_id, params) => ({
      content: [{ type: 'text', text: `echo: ${params.text}` }],
      details: { summary: `Echoed ${params.text}` },
    }),
  }
}

function setup(responses: ReturnType<typeof fauxAssistantMessage>[]) {
  const faux = fauxProvider()
  const models = createModels()
  models.setProvider(faux.provider)
  faux.setResponses(responses)
  return { faux, runtime: { models, model: faux.getModel() } }
}

async function drain(generator: AsyncGenerator<AgentRunEvent, { text: string }>) {
  const events: AgentRunEvent[] = []
  while (true) {
    const next = await generator.next()
    if (next.done) return { events, result: next.value }
    events.push(next.value)
  }
}

function baseInput(meter: FakeMeter, runtime: ReturnType<typeof setup>['runtime']) {
  return {
    systemPrompt: 'You are a test assistant.',
    history: [],
    userContent: 'Say hello after echoing.',
    modelId: 'faux',
    maxOutputTokens: 500,
    maxSteps: 4,
    tools: [echoTool()],
    sessionId: 'test-session',
    meter,
    signal: new AbortController().signal,
    runtime,
  }
}

describe('agent runtime', () => {
  it('streams a tool call, its result and the final text, metering each step', async () => {
    const { runtime } = setup([
      fauxAssistantMessage([fauxToolCall('echo', { text: 'hi' })], { stopReason: 'toolUse' }),
      fauxAssistantMessage([fauxText('Hello there.')]),
    ])
    const meter = new FakeMeter(4)
    const { events, result } = await drain(runAgentTurn(baseInput(meter, runtime)))

    const types = events.map((event) => event.type)
    expect(types).toContain('tool_call')
    expect(types).toContain('tool_result')
    expect(types.filter((type) => type === 'step')).toHaveLength(2)
    const toolResult = events.find((event) => event.type === 'tool_result')
    expect(toolResult).toMatchObject({ name: 'echo', ok: true, summary: 'Echoed hi' })
    expect(result.text).toBe('Hello there.')
    expect(meter.finalized).toHaveLength(2)
    expect(meter.released).toBe(0)
  })

  it('blocks the same tool call after it repeats', async () => {
    const repeat = () =>
      fauxAssistantMessage([fauxToolCall('echo', { text: 'again' })], { stopReason: 'toolUse' })
    const { runtime } = setup([repeat(), repeat(), repeat(), fauxAssistantMessage([fauxText('Done.')])])
    const meter = new FakeMeter(6)
    const { events } = await drain(runAgentTurn({ ...baseInput(meter, runtime), maxSteps: 6 }))
    const results = events.filter((event) => event.type === 'tool_result')
    expect(results.at(-1)).toMatchObject({ ok: false })
  })

  it('stops at the step cap', async () => {
    const call = () => fauxAssistantMessage([fauxToolCall('echo', { text: `${Math.random()}` })], { stopReason: 'toolUse' })
    const { runtime } = setup([call(), call(), call(), call(), call()])
    const meter = new FakeMeter(2)
    await drain(runAgentTurn({ ...baseInput(meter, runtime), maxSteps: 2 }))
    expect(meter.stepCount).toBe(2)
  })

  it('surfaces plan limit errors', async () => {
    const { runtime } = setup([fauxAssistantMessage([fauxText('Hi.')])])
    const meter = new FakeMeter(4, 1)
    await expect(drain(runAgentTurn(baseInput(meter, runtime)))).rejects.toBeInstanceOf(AgentLimitError)
  })
})

describe('agent metering', () => {
  it('counts cache reads at a tenth', () => {
    const usage = { inputTokens: 100, outputTokens: 50, cacheReadTokens: 1_000, cacheWriteTokens: 10, rawCostUsd: 0.01, costFromProvider: true }
    expect(billableTokens(usage)).toBe(260)
    const estimate = buildStepUsageEstimate({ tier: 'pro', walletType: 'tier_tokens', usage })
    expect(estimate.totalTokens).toBe(260)
    expect(estimate.displayedCostUsd).toBeCloseTo(0.015)
    expect(estimate.creditsConsumed).toBe(2)
  })

  it('reads pi usage safely', () => {
    expect(toStepUsage(undefined).inputTokens).toBe(0)
  })
})
