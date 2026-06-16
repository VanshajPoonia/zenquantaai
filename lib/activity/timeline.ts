import {
  SearchResultTarget,
  WorkspaceActivityItem,
  WorkspaceActivityType,
} from '@/types'

export const WORKSPACE_ACTIVITY_TYPES: readonly WorkspaceActivityType[] = [
  'conversation_created',
  'conversation_updated',
  'message_sent',
  'project_created',
  'project_updated',
  'file_uploaded',
  'file_indexed',
  'file_skipped',
  'file_unsupported',
  'file_failed',
  'artifact_created',
  'artifact_updated',
  'playbook_run_started',
  'playbook_run_completed',
  'playbook_run_failed',
  'image_generated',
  'model_duel_completed',
  'custom_assistant_created',
  'plan_request_submitted',
  'plan_request_updated',
]

export const DEFAULT_ACTIVITY_LIMIT = 40
export const MAX_ACTIVITY_LIMIT = 100

const ACTIVITY_TYPE_SET = new Set<string>(WORKSPACE_ACTIVITY_TYPES)
const UPDATED_EVENT_THRESHOLD_MS = 1000

export function isWorkspaceActivityType(
  value: string | null | undefined
): value is WorkspaceActivityType {
  return Boolean(value && ACTIVITY_TYPE_SET.has(value))
}

export function normalizeActivityLimit(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return DEFAULT_ACTIVITY_LIMIT
  }

  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN

  if (!Number.isFinite(numericValue)) return null

  const normalized = Math.floor(numericValue)
  if (normalized < 1 || normalized > MAX_ACTIVITY_LIMIT) return null

  return normalized
}

export function normalizeActivityCursor(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function shouldEmitUpdatedActivity(
  createdAt: string | Date | null | undefined,
  updatedAt: string | Date | null | undefined
): boolean {
  if (!createdAt || !updatedAt) return false
  const createdTime = new Date(createdAt).getTime()
  const updatedTime = new Date(updatedAt).getTime()

  if (Number.isNaN(createdTime) || Number.isNaN(updatedTime)) return false
  return updatedTime - createdTime > UPDATED_EVENT_THRESHOLD_MS
}

export function truncateActivityText(value: string, maxLength = 140): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

export function workspaceActivityHref(target: SearchResultTarget): string {
  const params = new URLSearchParams()

  switch (target.type) {
    case 'open_project':
      params.set('projectId', target.projectId)
      params.set('view', 'project')
      return `/?${params.toString()}`
    case 'open_conversation':
      params.set('conversationId', target.conversationId)
      if (target.messageId) params.set('messageId', target.messageId)
      return `/?${params.toString()}`
    case 'open_artifact':
      params.set('tool', 'artifacts')
      params.set('artifactId', target.artifactId)
      if (target.projectId) params.set('projectId', target.projectId)
      return `/?${params.toString()}`
    case 'open_prompt_library':
      params.set('tool', target.workflowId ? 'playbooks' : 'prompt-library')
      if (target.promptId) params.set('promptId', target.promptId)
      if (target.workflowId) params.set('workflowId', target.workflowId)
      return `/?${params.toString()}`
    case 'run_prompt_workflow':
      params.set('tool', 'playbooks')
      params.set('workflowId', target.workflowId)
      return `/?${params.toString()}`
    case 'switch_custom_assistant':
      params.set('tool', 'custom-assistants')
      params.set('assistantId', target.assistantId)
      return `/?${params.toString()}`
    case 'open_custom_assistants':
      params.set('tool', 'custom-assistants')
      if (target.assistantId) params.set('assistantId', target.assistantId)
      return `/?${params.toString()}`
    case 'open_model_comparison':
      if (target.conversationId) {
        params.set('conversationId', target.conversationId)
      } else {
        params.set('tool', 'model-comparison')
      }
      if (target.comparisonId) params.set('comparisonId', target.comparisonId)
      return `/?${params.toString()}`
    case 'open_prism_history':
      params.set('tool', 'prism-studio')
      if (target.imageId) params.set('imageId', target.imageId)
      if (target.conversationId) {
        params.set('conversationId', target.conversationId)
      }
      if (target.projectId) params.set('projectId', target.projectId)
      return `/?${params.toString()}`
    case 'open_url':
      return target.url
  }
}

export function sortAndPageActivities(
  items: WorkspaceActivityItem[],
  options: {
    limit?: number
    before?: string | null
    projectId?: string | null
    type?: WorkspaceActivityType | null
  } = {}
): { items: WorkspaceActivityItem[]; nextCursor: string | null } {
  const limit = Math.max(
    1,
    Math.min(MAX_ACTIVITY_LIMIT, options.limit ?? DEFAULT_ACTIVITY_LIMIT)
  )
  const beforeTime = options.before ? new Date(options.before).getTime() : null

  const filtered = items
    .filter((item) => {
      if (options.type && item.type !== options.type) return false
      if (options.projectId && item.projectId !== options.projectId) return false
      if (beforeTime !== null) {
        const occurredTime = new Date(item.occurredAt).getTime()
        if (Number.isNaN(occurredTime) || occurredTime >= beforeTime) {
          return false
        }
      }
      return true
    })
    .sort((left, right) => {
      const dateDelta =
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
      if (dateDelta !== 0) return dateDelta
      return left.title.localeCompare(right.title)
    })

  const page = filtered.slice(0, limit)
  return {
    items: page,
    nextCursor: filtered.length > limit ? page[page.length - 1]?.occurredAt ?? null : null,
  }
}
