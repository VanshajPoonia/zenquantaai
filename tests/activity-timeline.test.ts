import { describe, expect, it } from 'vitest'
import {
  isWorkspaceActivityType,
  normalizeActivityCursor,
  normalizeActivityLimit,
  shouldEmitUpdatedActivity,
  sortAndPageActivities,
  workspaceActivityHref,
} from '@/lib/activity/timeline'
import { WorkspaceActivityItem } from '@/types'

function item(input: Partial<WorkspaceActivityItem> & Pick<WorkspaceActivityItem, 'id' | 'type' | 'occurredAt'>): WorkspaceActivityItem {
  return {
    sourceType: 'project',
    sourceId: input.id,
    title: `Activity ${input.id}`,
    description: 'Safe activity description.',
    href: '/',
    target: { type: 'open_project', projectId: 'project_a' },
    projectId: 'project_a',
    projectName: 'Project A',
    ...input,
  }
}

describe('workspace activity timeline helpers', () => {
  it('normalizes limits, cursors, and activity types', () => {
    expect(normalizeActivityLimit(undefined)).toBe(40)
    expect(normalizeActivityLimit('20')).toBe(20)
    expect(normalizeActivityLimit('0')).toBeNull()
    expect(normalizeActivityLimit('101')).toBeNull()
    expect(normalizeActivityCursor('2026-06-16T12:00:00.000Z')).toBe(
      '2026-06-16T12:00:00.000Z'
    )
    expect(normalizeActivityCursor('not-a-date')).toBeNull()
    expect(isWorkspaceActivityType('message_sent')).toBe(true)
    expect(isWorkspaceActivityType('admin_audit_log_created')).toBe(false)
  })

  it('merges and sorts mixed source events newest-first with stable title ties', () => {
    const page = sortAndPageActivities([
      item({
        id: 'older',
        type: 'project_created',
        occurredAt: '2026-06-14T12:00:00.000Z',
      }),
      item({
        id: 'tie_b',
        title: 'Beta',
        type: 'message_sent',
        occurredAt: '2026-06-16T12:00:00.000Z',
      }),
      item({
        id: 'tie_a',
        title: 'Alpha',
        type: 'artifact_updated',
        occurredAt: '2026-06-16T12:00:00.000Z',
      }),
    ])

    expect(page.items.map((activity) => activity.id)).toEqual([
      'tie_a',
      'tie_b',
      'older',
    ])
    expect(page.nextCursor).toBeNull()
  })

  it('applies type, project, limit, and before filters', () => {
    const page = sortAndPageActivities(
      [
        item({
          id: 'wrong_project',
          type: 'message_sent',
          projectId: 'project_b',
          occurredAt: '2026-06-16T12:00:00.000Z',
        }),
        item({
          id: 'wrong_type',
          type: 'artifact_updated',
          occurredAt: '2026-06-15T12:00:00.000Z',
        }),
        item({
          id: 'match_new',
          type: 'message_sent',
          occurredAt: '2026-06-14T12:00:00.000Z',
        }),
        item({
          id: 'match_old',
          type: 'message_sent',
          occurredAt: '2026-06-13T12:00:00.000Z',
        }),
      ],
      {
        type: 'message_sent',
        projectId: 'project_a',
        before: '2026-06-15T00:00:00.000Z',
        limit: 1,
      }
    )

    expect(page.items.map((activity) => activity.id)).toEqual(['match_new'])
    expect(page.nextCursor).toBe('2026-06-14T12:00:00.000Z')
  })

  it('suppresses duplicate updated events when timestamps are effectively equal', () => {
    expect(
      shouldEmitUpdatedActivity(
        '2026-06-16T12:00:00.000Z',
        '2026-06-16T12:00:00.500Z'
      )
    ).toBe(false)
    expect(
      shouldEmitUpdatedActivity(
        '2026-06-16T12:00:00.000Z',
        '2026-06-16T12:00:02.000Z'
      )
    ).toBe(true)
  })

  it('builds workspace links without private object paths or raw cost fields', () => {
    expect(
      workspaceActivityHref({
        type: 'open_artifact',
        artifactId: 'artifact_1',
        projectId: 'project_1',
      })
    ).toBe('/?tool=artifacts&artifactId=artifact_1&projectId=project_1')
    expect(
      workspaceActivityHref({
        type: 'open_prism_history',
        imageId: 'image_1',
        projectId: 'project_1',
      })
    ).toBe('/?tool=prism-studio&imageId=image_1&projectId=project_1')
    expect(workspaceActivityHref({ type: 'open_url', url: '/pricing' })).toBe(
      '/pricing'
    )
  })
})
