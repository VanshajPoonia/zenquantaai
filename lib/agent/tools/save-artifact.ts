import type { AgentTool } from '@earendil-works/pi-agent-core'
import { obj, oneOf, str } from '@earendil-works/pi-schema'
import { DEFAULT_PROJECT_ID } from '@/lib/config'
import { neonArtifactsRepository } from '@/lib/db/repositories'
import type { ToolContext, ToolDetails } from '../types'
import { toolResult } from './shared'

const parameters = obj({
  title: str({ description: 'A short title for the artifact.', minLength: 1, maxLength: 120 }),
  artifactType: oneOf(['document', 'code', 'table', 'checklist', 'research_report'], {
    description: 'The kind of artifact.',
  }),
  content: str({ description: 'The full markdown content to save.', minLength: 1, maxLength: 60_000 }),
})

export function createSaveArtifactTool(ctx: ToolContext): AgentTool<typeof parameters, ToolDetails> {
  return {
    name: 'save_artifact',
    label: 'Saved an artifact',
    description:
      'Save a finished document, plan, table, checklist or code file as an artifact the user can edit and share later. Only call it when the user explicitly asks to save, keep or create a document. Never use it to store an answer you could not find.',
    parameters,
    execute: async (_callId, params) => {
      const artifact = await neonArtifactsRepository.create(ctx.userId, {
        projectId: ctx.projectId && ctx.projectId !== DEFAULT_PROJECT_ID ? ctx.projectId : null,
        conversationId: ctx.conversationId,
        sourceMessageId: ctx.messageId,
        sourceType: 'chat_message',
        title: params.title,
        artifactType: params.artifactType,
        content: params.content,
        metadata: { createdBy: 'agent_tool' },
      })
      return toolResult(`Saved artifact "${artifact.title}" (id ${artifact.id}).`, {
        summary: `Saved artifact: ${artifact.title}`,
        data: { artifactId: artifact.id, artifactTitle: artifact.title },
      })
    },
  }
}
