import type { AgentTool } from '@earendil-works/pi-agent-core'
import { obj, str } from '@earendil-works/pi-schema'
import { retrieveFileKnowledgeContext } from '@/lib/rag/retrieval'
import type { ToolContext, ToolDetails } from '../types'
import { toolResult } from './shared'

const parameters = obj({
  query: str({ description: 'What to look for in the user\'s uploaded files.', maxLength: 500 }),
})

export function createFilesSearchTool(ctx: ToolContext): AgentTool<typeof parameters, ToolDetails> {
  return {
    name: 'files_search',
    label: 'Searched your files',
    description:
      'Search the files the user uploaded to this chat or its project. Use it when the answer may be in their documents or code. Quote what you use.',
    parameters,
    execute: async (_callId, params) => {
      const context = await retrieveFileKnowledgeContext({
        userId: ctx.userId,
        query: params.query,
        projectId: ctx.projectId,
        conversationId: ctx.conversationId,
      })
      if (!context || context.sources.length === 0) {
        throw new Error('No matching passages were found in the uploaded files.')
      }
      const sources = context.sources.map((source) => ({ ...source, id: ctx.nextSourceId() }))
      const text = sources
        .map((source) => `[${source.id}] ${source.title}\n${source.snippet}`)
        .join('\n\n')
      return toolResult(text, {
        summary: `Found ${sources.length} passage${sources.length === 1 ? '' : 's'} in your files`,
        sources,
      })
    },
  }
}
