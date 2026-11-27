import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { ChatRequest, Conversation } from '@/types'

const mocks = vi.hoisted(() => ({
  agentLoop: { on: false },
  generate: vi.fn(),
  buildAgentPromptParts: vi.fn(),
  runAgentTurn: vi.fn(),
  getProject: vi.fn(),
  getConversation: vi.fn(),
}))

const usage = {
  promptTokens: 10,
  completionTokens: 5,
  totalTokens: 15,
  rawCostUsd: 0,
  displayedCostUsd: 0,
  estimatedCostUsd: 0,
  displayMultiplier: 2,
  marginUsd: 0,
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  appendAuthCookies: vi.fn(),
  requireAuthenticatedUser: vi.fn(async () => ({
    user: { id: 'user-a', role: 'user' },
    session: { refreshed: false },
  })),
}))
vi.mock('@/lib/db/repositories', async () => {
  const { createSessionSettings } = await import('@/lib/config')
  return {
    neonProfilesRepository: { ensureFromAuthUser: vi.fn() },
    neonCustomAssistantsRepository: { get: vi.fn(async () => null) },
    neonSettingsRepository: {
      get: vi.fn(async () => ({
        sessionDefaults: createSessionSettings('general'),
        aboutYou: 'SERVER ABOUT YOU',
        responseInstructions: '',
        useCustomInstructions: true,
      })),
    },
    neonSubscriptionsRepository: {
      ensureForUser: vi.fn(async () => ({ tier: 'free' })),
      reserveTextUsage: vi.fn(async () => ({ id: 'sub-1' })),
      finalizeTextUsage: vi.fn(async () => ({ id: 'sub-1' })),
      releaseTextUsage: vi.fn(),
    },
    neonUsageLimitOverridesRepository: { getByUserId: vi.fn(async () => null) },
    neonProjectsRepository: { get: mocks.getProject },
    neonAgentRunsRepository: {
      create: vi.fn(async () => ({ id: 'run-1' })),
      finish: vi.fn(),
    },
    neonConversationRepository: {
      get: mocks.getConversation,
      saveTurnStart: vi.fn(async (_userId: string, input: { conversation: Conversation }) => input.conversation),
      saveAssistantCompletion: vi.fn(async (_userId: string, conversation: Conversation) => conversation),
      markAssistantMessageError: vi.fn(),
    },
  }
})
vi.mock('@/lib/security/ownership', () => ({
  resolveOwnedProjectScope: vi.fn(async () => ({ ok: true, projectId: null })),
}))
vi.mock('@/lib/ai/chat', () => ({
  buildAgentPromptParts: mocks.buildAgentPromptParts,
  buildPromptTextForUsage: () => 'prompt text',
  clampSessionSettingsMaxTokens: (settings: unknown) => settings,
  completeConversationWithAssistant: vi.fn(async (conversation: Conversation) => conversation),
  generateAssistantStream: mocks.generate,
  prepareConversationForChat: vi.fn(async (payload: ChatRequest) => {
    const userMessage = { id: 'msg-user', role: 'user', content: payload.content, mode: 'general', createdAt: '2026-11-28T00:00:00.000Z' }
    const placeholder = { id: 'msg-reply', role: 'assistant', content: '', mode: 'general', createdAt: '2026-11-28T00:00:01.000Z' }
    const conversation = { ...payload.conversation!, messages: [userMessage] }
    return {
      conversation,
      generationConversation: conversation,
      userMessage,
      assistantPlaceholder: placeholder,
      responseSettings: payload.settings,
      assistantMode: payload.mode,
    }
  }),
  resolveSessionSettings: (_mode: unknown, provided: object, fallback: object) => ({ ...fallback, ...provided }),
}))
vi.mock('@/lib/ai/memory-summary', () => ({ maybeUpdateRollingSummary: vi.fn() }))
vi.mock('@/lib/ai/memory-extraction', () => ({ maybeExtractDurableMemories: vi.fn() }))
vi.mock('@/lib/ai/memory-retrieval', () => ({ retrieveDurableMemoryContext: vi.fn() }))
vi.mock('@/lib/ai/cross-chat-recall', () => ({ retrieveCrossChatContext: vi.fn() }))
vi.mock('@/lib/billing/costs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/billing/costs')>()),
  calculateTextUsageEstimate: () => usage,
}))
vi.mock('@/lib/billing/enforce', () => ({
  enforceTextUsage: vi.fn(),
  getEffectiveSubscription: () => ({
    coreTokensIncluded: 100_000,
    tierTokensIncluded: 0,
    dailyMessageLimit: 50,
    maxOutputTokensPerRequest: 800,
  }),
}))
vi.mock('@/lib/billing/log-usage', () => ({ recordTextUsageEvent: vi.fn() }))
vi.mock('@/lib/search/web-search', () => ({
  buildWebSearchQuery: (value: string) => value,
  searchWebForContext: vi.fn(),
  shouldUseWebSearch: () => false,
}))
vi.mock('@/lib/rag/retrieval', () => ({
  linkAttachmentKnowledgeScope: vi.fn(async () => []),
  retrieveFileKnowledgeContext: vi.fn(),
}))
vi.mock('@/lib/ai/openrouter', () => ({ hasOpenRouterConfig: () => true }))
vi.mock('@/lib/agent/flags', () => ({ isAgentLoopEnabledFor: () => mocks.agentLoop.on }))
vi.mock('@/lib/agent/metering', () => ({
  addUsageEstimates: (value: unknown) => value,
  AgentMeter: class {
    totalUsage = null
    addCharge() {}
  },
  buildChargeEstimate: () => usage,
  buildStepUsageEstimate: () => usage,
  webSearchCharge: () => null,
}))
vi.mock('@/lib/agent/runtime', () => ({ runAgentTurn: mocks.runAgentTurn }))
vi.mock('@/lib/agent/tools', () => ({
  createServerTools: () => [],
  getToolNamesForMode: () => ['web_search'],
}))
vi.mock('@/lib/agent/tools/urls', () => ({
  collectReadableUrls: () => new Set<string>(),
  collectUrls: vi.fn(),
}))

import { createSessionSettings } from '@/lib/config'
import { POST } from '@/app/api/chat/route'

const storedConversation = {
  id: 'conv-1',
  title: 'Week plan',
  mode: 'general',
  projectId: 'proj-a',
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
  isPinned: false,
  preview: '',
  messageCount: 0,
  sessionSettings: createSessionSettings('general'),
  messages: [],
} as unknown as Conversation

async function sendChat(): Promise<void> {
  const response = await POST(
    new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        mode: 'general',
        conversationId: 'conv-1',
        conversation: { ...storedConversation, projectId: 'proj-b' },
        content: 'Plan my week.',
        settings: { aboutYou: 'CLIENT ABOUT YOU', instructions: 'CLIENT RULES' },
        userInstructions: 'CLIENT BLOCK',
      }),
    })
  )
  if (!response) throw new Error('Route did not return a response.')
  await response.text()
}

function expectServerBlock(block: unknown) {
  expect(typeof block).toBe('string')
  expect(block).toContain('SERVER ABOUT YOU')
  expect(block).toContain('SERVER PROJECT RULES')
  expect(block).not.toContain('CLIENT')
}

describe('chat route instructions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.agentLoop.on = false
    mocks.getConversation.mockResolvedValue(storedConversation)
    mocks.getProject.mockImplementation(async (userId: string, projectId: string) =>
      userId === 'user-a' && projectId === 'proj-a'
        ? { id: 'proj-a', name: 'Shop', color: 'general', instructions: 'SERVER PROJECT RULES' }
        : null
    )
    mocks.generate.mockImplementation(async function* () {
      yield 'Here is your week.'
    })
    mocks.buildAgentPromptParts.mockReturnValue({ systemPrompt: 'system', history: [], userContent: 'Plan my week.' })
    mocks.runAgentTurn.mockImplementation(async function* () {
      return { text: 'Here is your week.', parts: [] }
    })
  })

  it('loads the block from Neon on the plain path', async () => {
    await sendChat()

    expect(mocks.getProject).toHaveBeenCalledWith('user-a', 'proj-a')
    expect(mocks.generate).toHaveBeenCalledTimes(1)
    expectServerBlock(mocks.generate.mock.calls[0][0].userInstructions)
  })

  it('loads the block from Neon on the agent path', async () => {
    mocks.agentLoop.on = true

    await sendChat()

    expect(mocks.getProject).toHaveBeenCalledWith('user-a', 'proj-a')
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(mocks.runAgentTurn).toHaveBeenCalledTimes(1)
    expectServerBlock(mocks.buildAgentPromptParts.mock.calls[0][9])
  })
})
