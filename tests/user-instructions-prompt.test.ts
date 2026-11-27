import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  streamText: vi.fn(),
  getProject: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/ai/openrouter', () => ({
  hasOpenRouterConfig: () => true,
  streamOpenRouterTextResponse: mocks.streamText,
  createOpenRouterImage: vi.fn(),
}))
vi.mock('@/lib/db/repositories', () => ({
  neonProjectsRepository: { get: mocks.getProject },
}))

import { createSessionSettings } from '@/lib/config'
import {
  buildAgentPromptParts,
  buildPromptTextForUsage,
  generateAssistantStream,
} from '@/lib/ai/chat'
import { loadUserInstructionsBlock } from '@/lib/ai/load-user-instructions'
import { buildUserInstructionsBlock } from '@/lib/ai/user-instructions'
import { createConversation, createMessage } from '@/lib/utils/chat'

const block = buildUserInstructionsBlock({
  aboutYou: 'I run a small bakery.',
  projectName: 'Shop',
  projectInstructions: 'Keep answers short.',
})
const settings = createSessionSettings('general')
const conversation = createConversation({
  mode: 'general',
  sessionSettings: settings,
  messages: [createMessage({ role: 'user', content: 'Plan my week.', mode: 'general' })],
})
const customAssistant = {
  assistant: {
    id: 'ca-1',
    name: 'Baker',
    description: '',
    iconEmoji: 'B',
    color: 'general',
    baseMode: 'general' as const,
  },
  systemInstructions: 'CUSTOM ASSISTANT RULES',
}

describe('instructions in prompt assembly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.streamText.mockImplementation(async function* () {
      yield 'ok'
    })
  })

  it('sends the block on the plain path after the system prompt', async () => {
    const chunks: string[] = []
    for await (const chunk of generateAssistantStream({
      conversation,
      settings,
      mode: 'general',
      customAssistantContext: customAssistant,
      userInstructions: block,
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(['ok'])
    const messages = mocks.streamText.mock.calls[0][0].messages as Array<{
      role: string
      content: string
    }>
    const index = messages.findIndex((message) => message.content === block)
    expect(index).toBe(1)
    expect(messages[index].role).toBe('system')
    expect(messages[2].content).toContain('CUSTOM ASSISTANT RULES')
  })

  it('sends the block in the agent system prompt', () => {
    const parts = buildAgentPromptParts(
      conversation,
      settings,
      'general',
      undefined,
      undefined,
      customAssistant,
      undefined,
      undefined,
      undefined,
      block
    )

    expect(parts.systemPrompt).toContain(block)
    expect(parts.systemPrompt.indexOf(block)).toBeLessThan(
      parts.systemPrompt.indexOf('CUSTOM ASSISTANT RULES')
    )
    expect(parts.userContent).toBe('Plan my week.')
    expect(parts.userContent).not.toContain('bakery')
  })

  it('counts the block in the usage estimate and leaves it out when empty', () => {
    const withBlock = buildPromptTextForUsage(
      conversation,
      settings,
      'general',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      block
    )
    const without = buildPromptTextForUsage(conversation, settings, 'general')

    expect(withBlock).toContain('Keep answers short.')
    expect(without).not.toContain('[User instructions]')
    const blank = buildPromptTextForUsage(
      conversation,
      settings,
      'general',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '  '
    )
    expect(blank).toBe(without)
  })
})

describe('loadUserInstructionsBlock', () => {
  const personal = {
    aboutYou: 'I run a small bakery.',
    responseInstructions: '',
    useCustomInstructions: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the project for the signed-in user', async () => {
    mocks.getProject.mockResolvedValue({
      id: 'proj-a',
      name: 'Shop',
      color: 'general',
      instructions: 'Keep answers short.',
    })

    const result = await loadUserInstructionsBlock({
      userId: 'user-a',
      settings: personal,
      projectId: 'proj-a',
    })

    expect(mocks.getProject).toHaveBeenCalledWith('user-a', 'proj-a')
    expect(result).toBe(block)
  })

  it('skips a project the user does not own', async () => {
    mocks.getProject.mockResolvedValue(null)

    const result = await loadUserInstructionsBlock({
      userId: 'user-a',
      settings: personal,
      projectId: 'proj-b',
    })

    expect(result).toContain('I run a small bakery.')
    expect(result).not.toContain('Instructions for')
  })

  it('does not query without a project', async () => {
    const result = await loadUserInstructionsBlock({
      userId: 'user-a',
      settings: { ...personal, aboutYou: '' },
      projectId: null,
    })

    expect(mocks.getProject).not.toHaveBeenCalled()
    expect(result).toBe('')
  })
})
