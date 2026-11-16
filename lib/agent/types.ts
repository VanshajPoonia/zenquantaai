import type { AIMode, MessageSource, ToolResultData } from '@/types'

/** Cost of work a tool did outside the model call, such as a web search. */
export interface ExtraCharge {
  walletTokens: number
  rawCostUsd: number
}

/** Server-side facts every tool gets. Never taken from model arguments. */
export interface ToolContext {
  userId: string
  conversationId: string
  messageId: string
  projectId: string | null
  mode: AIMode
  /** Hands out citation ids that stay unique across every source in the turn. */
  nextSourceId: () => string
}

/** What a tool reports to the UI next to the text it returns to the model. */
export interface ToolDetails {
  summary: string
  sources?: MessageSource[]
  data?: ToolResultData
  charge?: ExtraCharge
}

export type AgentRunEvent =
  | { type: 'text'; delta: string }
  | { type: 'step'; step: number; maxSteps: number }
  | { type: 'tool_call'; callId: string; name: string; label: string; args: unknown }
  | {
      type: 'tool_result'
      callId: string
      name: string
      ok: boolean
      summary: string
      output: string
      sources?: MessageSource[]
      data?: ToolResultData
    }

export interface StepUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  rawCostUsd: number
  costFromProvider: boolean
}
