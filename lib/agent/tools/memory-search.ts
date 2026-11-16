import type { AgentTool } from '@earendil-works/pi-agent-core'
import { obj, str } from '@earendil-works/pi-schema'
import { retrieveDurableMemoryContext } from '@/lib/ai/memory-retrieval'
import type { ToolContext, ToolDetails } from '../types'
import { toolResult } from './shared'

const parameters = obj({
  query: str({ description: 'What to recall about the user, their work or past decisions.', maxLength: 300 }),
})

export function createMemorySearchTool(ctx: ToolContext): AgentTool<typeof parameters, ToolDetails> {
  return {
    name: 'memory_search',
    label: 'Checked memory',
    description:
      'Look up things the user told Zenquanta in earlier chats: preferences, facts, decisions and open tasks.',
    parameters,
    execute: async (_callId, params) => {
      const context = await retrieveDurableMemoryContext({
        userId: ctx.userId,
        query: params.query,
        projectId: ctx.projectId,
      })
      if (!context || context.items.length === 0) {
        throw new Error('Nothing relevant was found in memory.')
      }
      const text = context.items.map((item) => `- (${item.kind}) ${item.content}`).join('\n')
      return toolResult(text, {
        summary: `Recalled ${context.items.length} memory item${context.items.length === 1 ? '' : 's'}`,
      })
    },
  }
}
