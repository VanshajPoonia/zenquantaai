import 'server-only'

import { neonAgentRunsRepository, neonSubscriptionsRepository } from '@/lib/db/repositories'
import { recordTextUsageEvent } from '@/lib/billing/log-usage'
import { resolveDisplayMultiplier } from '@/lib/billing/costs'
import { usdToDisplayedCredits, WEB_SEARCH_WALLET_TOKENS } from '@/lib/config/pricing'
import type {
  AgentPlanLimits,
  AIMode,
  AssistantFamily,
  ConversationSurface,
  SubscriptionTier,
  UsageEstimate,
  WebSearchContext,
} from '@/types'
import type { ExtraCharge, StepUsage } from './types'

export class AgentLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentLimitError'
  }
}

type TokenWallet = 'core_tokens' | 'tier_tokens'

/**
 * Tokens a step draws from the wallet. Cache reads cost about a tenth of
 * normal input upstream, so they count at a tenth until Gate B decides.
 */
export function billableTokens(usage: StepUsage): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheWriteTokens +
    Math.ceil(usage.cacheReadTokens / 10)
  )
}

export function buildStepUsageEstimate(input: {
  tier: SubscriptionTier
  walletType: TokenWallet
  usage: StepUsage
}): UsageEstimate {
  const displayMultiplier = resolveDisplayMultiplier(input.tier)
  const rawCostUsd = Math.max(input.usage.rawCostUsd, 0)
  const displayedCostUsd = rawCostUsd * displayMultiplier
  return {
    promptTokens:
      input.usage.inputTokens + input.usage.cacheReadTokens + input.usage.cacheWriteTokens,
    completionTokens: input.usage.outputTokens,
    totalTokens: billableTokens(input.usage),
    rawCostUsd,
    displayedCostUsd,
    estimatedCostUsd: displayedCostUsd,
    displayMultiplier,
    marginUsd: displayedCostUsd - rawCostUsd,
    walletType: input.walletType,
    creditsConsumed: usdToDisplayedCredits(displayedCostUsd),
  }
}

/** Per-million-token prices, as pi reports them for a model. */
export interface TokenPrices {
  input: number
  output: number
}

/**
 * Usage for a step that reached the model but ended before the provider
 * reported usage, such as a stop or a dropped stream: the prompt plus the output so far.
 */
export function estimateCutStepUsage(input: {
  promptTokens: number
  outputChars: number
  prices?: TokenPrices
}): StepUsage {
  const outputTokens = Math.ceil(Math.max(input.outputChars, 0) / 4)
  const prices = input.prices
  return {
    inputTokens: input.promptTokens,
    outputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    rawCostUsd: prices
      ? (input.promptTokens * prices.input + outputTokens * prices.output) / 1_000_000
      : 0,
    costFromProvider: false,
  }
}

/** What a web search draws from the wallet, or null when no search ran. */
export function webSearchCharge(context: WebSearchContext | undefined): ExtraCharge | null {
  if (!context?.sources.length) return null
  return { walletTokens: WEB_SEARCH_WALLET_TOKENS, rawCostUsd: context.costUsd ?? 0 }
}

export function buildChargeEstimate(input: {
  tier: SubscriptionTier
  walletType: TokenWallet
  charge: ExtraCharge
}): UsageEstimate {
  const displayMultiplier = resolveDisplayMultiplier(input.tier)
  const displayedCostUsd = input.charge.rawCostUsd * displayMultiplier
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: input.charge.walletTokens,
    rawCostUsd: input.charge.rawCostUsd,
    displayedCostUsd,
    estimatedCostUsd: displayedCostUsd,
    displayMultiplier,
    marginUsd: displayedCostUsd - input.charge.rawCostUsd,
    walletType: input.walletType,
    creditsConsumed: usdToDisplayedCredits(displayedCostUsd),
  }
}

export function addUsageEstimates(a: UsageEstimate, b: UsageEstimate): UsageEstimate {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    rawCostUsd: a.rawCostUsd + b.rawCostUsd,
    displayedCostUsd: a.displayedCostUsd + b.displayedCostUsd,
    estimatedCostUsd: a.estimatedCostUsd + b.estimatedCostUsd,
    displayMultiplier: b.displayMultiplier,
    marginUsd: a.marginUsd + b.marginUsd,
    walletType: b.walletType ?? a.walletType,
    creditsConsumed: (a.creditsConsumed ?? 0) + (b.creditsConsumed ?? 0),
  }
}

export interface AgentMeterOptions {
  userId: string
  tier: SubscriptionTier
  walletType: TokenWallet
  effectiveIncluded: number
  limits: AgentPlanLimits
  maxSteps: number
  maxOutputTokens: number
  surface: ConversationSurface
  runId: string
  /** Web turns count one daily message on their first step. */
  dailyMessageLimit?: number
  event: {
    conversationId: string | null
    messageId: string | null
    assistantFamily: AssistantFamily
    mode: AIMode
    model: string
  }
}

/** Reserves before each model request and settles after it, one step at a time. */
export class AgentMeter {
  private steps = 0
  private pending: {
    reservedTokens: number
    promptTokens: number
    countedMessage: boolean
  } | null = null
  private subscriptionId: string | null = null
  private total: UsageEstimate | null = null
  private charges: ExtraCharge[] = []

  constructor(private readonly options: AgentMeterOptions) {}

  get stepCount(): number {
    return this.steps
  }

  get reachedStepCap(): boolean {
    return this.steps >= this.options.maxSteps
  }

  get totalUsage(): UsageEstimate | null {
    return this.total
  }

  /** Adds tool costs, such as web searches, to the next step that settles. */
  addCharge(charge: ExtraCharge): void {
    this.charges.push(charge)
  }

  async reserveStep(estimatedPromptTokens: number): Promise<void> {
    if (this.pending) throw new Error('An agent step is already reserved.')
    if (this.reachedStepCap) {
      throw new AgentLimitError('This run reached its step limit for your current plan.')
    }
    if (estimatedPromptTokens > this.options.limits.maxAgentInputTokens) {
      throw new AgentLimitError(
        'This conversation is too long for one agent step on your current plan. Start a new chat or shorten the request.'
      )
    }

    const countsMessage = this.steps === 0 && typeof this.options.dailyMessageLimit === 'number'
    const reservedTokens = estimatedPromptTokens + this.options.maxOutputTokens
    const subscription = await neonSubscriptionsRepository.reserveAgentStep({
      userId: this.options.userId,
      walletType: this.options.walletType,
      estimatedTokens: reservedTokens,
      effectiveIncluded: this.options.effectiveIncluded,
      agentStepsPerDay: this.options.limits.agentStepsPerDay,
      dailyMessageLimit: countsMessage ? this.options.dailyMessageLimit : undefined,
    })

    if (!subscription) {
      throw new AgentLimitError(
        'You have reached your usage limit for this plan. Agent steps, the daily message limit or the wallet is exhausted.'
      )
    }

    this.subscriptionId = subscription.id
    this.pending = { reservedTokens, promptTokens: estimatedPromptTokens, countedMessage: countsMessage }
    this.steps += 1
  }

  async finalizeStep(usage: StepUsage): Promise<UsageEstimate | null> {
    const pending = this.pending
    if (!pending || !this.subscriptionId) return null
    this.pending = null

    let estimate = buildStepUsageEstimate({
      tier: this.options.tier,
      walletType: this.options.walletType,
      usage,
    })
    for (const charge of this.charges.splice(0)) {
      estimate = addUsageEstimates(
        estimate,
        buildChargeEstimate({ tier: this.options.tier, walletType: this.options.walletType, charge })
      )
    }

    await neonSubscriptionsRepository.finalizeTextUsage({
      userId: this.options.userId,
      walletType: this.options.walletType,
      reservedTokens: pending.reservedTokens,
      actualTokens: estimate.totalTokens,
    })
    await recordTextUsageEvent({
      subscriptionId: this.subscriptionId,
      event: {
        userId: this.options.userId,
        ...this.options.event,
        walletType: this.options.walletType,
        usage: estimate,
        surface: this.options.surface,
        agentRunId: this.options.runId,
      },
    })
    await neonAgentRunsRepository.recordStep({
      userId: this.options.userId,
      runId: this.options.runId,
      promptTokens: estimate.promptTokens,
      completionTokens: estimate.completionTokens,
    })

    this.total = this.total ? addUsageEstimates(this.total, estimate) : estimate
    return estimate
  }

  /** Charges a step the model received but that ended before usage arrived. */
  async settleCutStep(outputChars: number, prices?: TokenPrices): Promise<UsageEstimate | null> {
    if (!this.pending) return null
    return this.finalizeStep(
      estimateCutStepUsage({ promptTokens: this.pending.promptTokens, outputChars, prices })
    )
  }

  /** Refunds a step that never produced a response. */
  async releasePending(): Promise<void> {
    const pending = this.pending
    if (!pending) return
    this.pending = null
    this.steps = Math.max(this.steps - 1, 0)
    await neonSubscriptionsRepository.releaseAgentStep({
      userId: this.options.userId,
      walletType: this.options.walletType,
      reservedTokens: pending.reservedTokens,
      countedMessage: pending.countedMessage,
    })
  }
}
