import type { AgentTool } from '@earendil-works/pi-agent-core'
import { obj, str } from '@earendil-works/pi-schema'
import { searchWebForContext } from '@/lib/search/web-search'
import { webSearchCharge } from '../metering'
import type { ToolContext, ToolDetails } from '../types'
import { toolResult } from './shared'

const parameters = obj({
  query: str({ description: 'What to search for, written as a search engine query.', maxLength: 300 }),
})

export function createWebSearchTool(ctx: ToolContext): AgentTool<typeof parameters, ToolDetails> {
  return {
    name: 'web_search',
    label: 'Searched the web',
    description:
      'Search the web for current information. Use it for news, prices, recent releases, or anything that may have changed after your training. Cite results inline with their [n] ids.',
    parameters,
    execute: async (_callId, params) => {
      const context = await searchWebForContext(params.query)
      if (context.sources.length === 0) {
        throw new Error(
          context.unavailableReason === 'not_configured'
            ? 'Web search is not configured.'
            : 'Web search returned no results.'
        )
      }
      const sources = context.sources.map((source) => ({ ...source, id: ctx.nextSourceId() }))
      const text = sources
        .map((source) =>
          [`[${source.id}] ${source.title}`, `URL: ${source.url}`, source.publishedAt ? `Published: ${source.publishedAt}` : '', source.snippet]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n')
      return toolResult(text, {
        summary: `Found ${sources.length} source${sources.length === 1 ? '' : 's'} for "${context.query}"`,
        sources,
        charge: webSearchCharge(context) ?? undefined,
      })
    },
  }
}
