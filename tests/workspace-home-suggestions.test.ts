import { describe, expect, it } from 'vitest'
import { buildWorkspaceHomeSuggestions } from '@/lib/workspace-home/suggestions'
import { WorkspaceHomeUsageSnapshot } from '@/types'

function usage(
  overrides: Partial<WorkspaceHomeUsageSnapshot> = {}
): WorkspaceHomeUsageSnapshot {
  return {
    planTier: 'free',
    subscriptionStatus: 'active',
    displayedCreditsTotal: 1000,
    displayedCreditsUsed: 100,
    displayedCreditsRemaining: 900,
    dailyMessages: { used: 1, limit: 20, remaining: 19, ratio: 0.05 },
    dailyImages: { used: 0, limit: 5, remaining: 5, ratio: 0 },
    imageCredits: { used: 0, limit: 10, remaining: 10, ratio: 0 },
    displayedCredits: { used: 100, limit: 1000, remaining: 900, ratio: 0.1 },
    pendingPlanRequest: null,
    ...overrides,
  }
}

describe('workspace home suggestion rules', () => {
  it('suggests foundational actions for an empty workspace', () => {
    const suggestions = buildWorkspaceHomeSuggestions({
      projectCount: 0,
      conversationCount: 0,
      artifactCount: 0,
      playbookRunCount: 0,
      fileCount: 0,
      imageCount: 0,
      hasPlaybooks: false,
      usageSnapshot: usage(),
    })

    expect(suggestions.map((item) => item.type)).toEqual(
      expect.arrayContaining(['new_chat', 'new_project', 'upload_file'])
    )
  })

  it('suggests continuing work and search when recent activity exists', () => {
    const suggestions = buildWorkspaceHomeSuggestions({
      projectCount: 2,
      conversationCount: 3,
      artifactCount: 1,
      playbookRunCount: 0,
      fileCount: 2,
      imageCount: 0,
      hasPlaybooks: false,
      defaultProjectId: 'project_1',
      usageSnapshot: usage(),
    })

    expect(suggestions[0]?.type).toBe('continue_conversation')
    expect(suggestions.some((item) => item.type === 'search_workspace')).toBe(true)
    expect(suggestions.every((item) => !item.description.includes('$'))).toBe(true)
  })

  it('suggests dashboard review when usage is near a limit without exposing raw cost', () => {
    const suggestions = buildWorkspaceHomeSuggestions({
      projectCount: 1,
      conversationCount: 1,
      artifactCount: 0,
      playbookRunCount: 0,
      fileCount: 1,
      imageCount: 0,
      hasPlaybooks: true,
      usageSnapshot: usage({
        dailyMessages: { used: 18, limit: 20, remaining: 2, ratio: 0.9 },
      }),
    })

    expect(suggestions.some((item) => item.type === 'open_dashboard')).toBe(true)
    expect(JSON.stringify(suggestions)).not.toContain('rawCost')
  })

  it('prioritizes pending plan request review over generic usage review', () => {
    const suggestions = buildWorkspaceHomeSuggestions({
      projectCount: 1,
      conversationCount: 2,
      artifactCount: 0,
      playbookRunCount: 0,
      fileCount: 1,
      imageCount: 1,
      hasPlaybooks: true,
      usageSnapshot: usage({
        displayedCredits: { used: 900, limit: 1000, remaining: 100, ratio: 0.9 },
        pendingPlanRequest: {
          id: 'request_1',
          requestedTier: 'pro',
          status: 'pending',
          createdAt: '2026-06-16T00:00:00.000Z',
          updatedAt: '2026-06-16T00:00:00.000Z',
        },
      }),
    })

    expect(suggestions.some((item) => item.type === 'open_pricing')).toBe(true)
    expect(suggestions.some((item) => item.type === 'open_dashboard')).toBe(false)
  })
})
