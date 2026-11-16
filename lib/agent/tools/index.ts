import type { AgentTool } from '@earendil-works/pi-agent-core'
import { isMemoryExtractionEnabled } from '@/lib/context/flags'
import { hasEmbeddingConfig } from '@/lib/rag/embeddings'
import { hasWebExtractConfig } from '@/lib/search/web-extract'
import { hasWebSearchConfig } from '@/lib/search/web-search'
import type { AIMode } from '@/types'
import type { ToolContext, ToolDetails } from '../types'
import { createFetchUrlTool } from './fetch-url'
import { createFilesSearchTool } from './files-search'
import { createMakeImageTool } from './make-image'
import { createMemorySearchTool } from './memory-search'
import { createSaveArtifactTool } from './save-artifact'
import { createWebSearchTool } from './web-search'

export type ServerToolName =
  | 'web_search'
  | 'fetch_url'
  | 'files_search'
  | 'memory_search'
  | 'save_artifact'
  | 'make_image'

const COMMON_TOOLS: ServerToolName[] = [
  'web_search',
  'fetch_url',
  'files_search',
  'memory_search',
  'save_artifact',
]

/** Which tools each assistant mode may use. Prism has none. */
export const TOOL_POLICY: Record<AIMode, ServerToolName[]> = {
  general: [...COMMON_TOOLS, 'make_image'],
  creative: [...COMMON_TOOLS, 'make_image'],
  logic: COMMON_TOOLS,
  code: COMMON_TOOLS,
  live: COMMON_TOOLS,
  image: [],
}

function isToolConfigured(name: ServerToolName): boolean {
  switch (name) {
    case 'web_search':
      return hasWebSearchConfig()
    case 'fetch_url':
      return hasWebExtractConfig()
    case 'files_search':
      return hasEmbeddingConfig()
    case 'memory_search':
      return isMemoryExtractionEnabled() && hasEmbeddingConfig()
    default:
      return true
  }
}

export function getToolNamesForMode(mode: AIMode): ServerToolName[] {
  return TOOL_POLICY[mode].filter(isToolConfigured)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyServerTool = AgentTool<any, ToolDetails>

export function createServerTools(ctx: ToolContext): AnyServerTool[] {
  const factories: Record<ServerToolName, () => AnyServerTool> = {
    web_search: () => createWebSearchTool(ctx),
    fetch_url: () => createFetchUrlTool(ctx),
    files_search: () => createFilesSearchTool(ctx),
    memory_search: () => createMemorySearchTool(ctx),
    save_artifact: () => createSaveArtifactTool(ctx),
    make_image: createMakeImageTool,
  }
  return getToolNamesForMode(ctx.mode).map((name) => factories[name]())
}
