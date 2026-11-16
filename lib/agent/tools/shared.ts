import type { AgentToolResult } from '@earendil-works/pi-agent-core'
import type { ToolDetails } from '../types'

export const MAX_TOOL_OUTPUT_CHARS = 8_000

export function clip(text: string, max = MAX_TOOL_OUTPUT_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}\n[truncated]` : text
}

export function toolResult(text: string, details: ToolDetails): AgentToolResult<ToolDetails> {
  return { content: [{ type: 'text', text: clip(text) }], details }
}
