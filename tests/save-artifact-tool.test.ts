import { describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '@/lib/agent/types'

const mocks = vi.hoisted(() => ({
  createArtifact: vi.fn(async (userId: string, input: { title: string }) => ({
    id: 'artifact-1',
    userId,
    title: input.title,
  })),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/repositories', () => ({
  neonArtifactsRepository: { create: mocks.createArtifact },
}))

import { createSaveArtifactTool } from '@/lib/agent/tools/save-artifact'

const context: ToolContext = {
  userId: 'user-a',
  conversationId: 'conv-1',
  messageId: 'msg-1',
  projectId: 'proj-a',
  mode: 'general',
  nextSourceId: () => '1',
  readableUrls: new Set(),
}

describe('save_artifact result', () => {
  it('returns the artifact id the card links to', async () => {
    const tool = createSaveArtifactTool(context)

    const result = await tool.execute('call-1', {
      title: 'Launch notes',
      artifactType: 'document',
      content: '# Notes',
    })

    expect(mocks.createArtifact).toHaveBeenCalledWith(
      'user-a',
      expect.objectContaining({ conversationId: 'conv-1', projectId: 'proj-a' })
    )
    expect(result.details?.data).toEqual({ artifactId: 'artifact-1', artifactTitle: 'Launch notes' })
  })
})
