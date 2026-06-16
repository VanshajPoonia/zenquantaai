import {
  WorkspaceHomeSuggestedAction,
  WorkspaceHomeUsageSnapshot,
} from '@/types'

export interface WorkspaceHomeSuggestionContext {
  projectCount: number
  conversationCount: number
  artifactCount: number
  playbookRunCount: number
  fileCount: number
  imageCount: number
  hasPlaybooks: boolean
  defaultProjectId?: string | null
  usageSnapshot: WorkspaceHomeUsageSnapshot
}

const NEAR_LIMIT_RATIO = 0.8

function action(
  input: Omit<WorkspaceHomeSuggestedAction, 'priority'> & { priority?: number }
): WorkspaceHomeSuggestedAction {
  return {
    priority: input.priority ?? 50,
    ...input,
  }
}

function isNearLimit(value: { limit: number; ratio: number }) {
  return value.limit > 0 && value.ratio >= NEAR_LIMIT_RATIO
}

export function buildWorkspaceHomeSuggestions(
  context: WorkspaceHomeSuggestionContext
): WorkspaceHomeSuggestedAction[] {
  const suggestions: WorkspaceHomeSuggestedAction[] = []
  const projectId = context.defaultProjectId ?? null

  if (context.conversationCount > 0) {
    suggestions.push(
      action({
        id: 'continue-latest-conversation',
        type: 'continue_conversation',
        title: 'Continue your latest thread',
        description: 'Pick up the most recent conversation without searching.',
        projectId,
        priority: 95,
      })
    )
  } else {
    suggestions.push(
      action({
        id: 'start-first-chat',
        type: 'new_chat',
        title: 'Start a new chat',
        description: 'Open a fresh workspace thread with Nova or another assistant.',
        projectId,
        priority: 100,
      })
    )
  }

  if (context.projectCount === 0) {
    suggestions.push(
      action({
        id: 'create-first-project',
        type: 'new_project',
        title: 'Create your first project',
        description: 'Group chats, files, artifacts, images, and playbooks by goal.',
        priority: 90,
      })
    )
  }

  if (context.fileCount === 0) {
    suggestions.push(
      action({
        id: 'upload-first-file',
        type: 'upload_file',
        title: 'Upload a file',
        description: 'Add project knowledge for Ask Files and file-context chat.',
        projectId,
        priority: 85,
      })
    )
  }

  if (context.hasPlaybooks) {
    suggestions.push(
      action({
        id: 'run-recent-playbook',
        type: 'run_playbook',
        title: 'Run a playbook',
        description: 'Use a reusable workflow for repeatable work.',
        projectId,
        priority: 70,
      })
    )
  } else if (context.conversationCount > 0) {
    suggestions.push(
      action({
        id: 'search-workspace',
        type: 'search_workspace',
        title: 'Search your workspace',
        description: 'Find chats, artifacts, files, images, and playbooks quickly.',
        priority: 65,
      })
    )
  }

  if (context.imageCount > 0) {
    suggestions.push(
      action({
        id: 'review-prism-images',
        type: 'generate_image',
        title: 'Open Prism work',
        description: 'Reuse or remix a recent image prompt.',
        projectId,
        priority: 60,
      })
    )
  } else {
    suggestions.push(
      action({
        id: 'generate-first-image',
        type: 'generate_image',
        title: 'Generate an image',
        description: 'Start a Prism prompt from the workspace home.',
        projectId,
        priority: 55,
      })
    )
  }

  if (context.usageSnapshot.pendingPlanRequest) {
    suggestions.push(
      action({
        id: 'review-plan-request',
        type: 'open_pricing',
        title: 'Review your plan request',
        description: 'Check the latest manual upgrade request status.',
        priority: 92,
      })
    )
  } else if (
    isNearLimit(context.usageSnapshot.dailyMessages) ||
    isNearLimit(context.usageSnapshot.dailyImages) ||
    isNearLimit(context.usageSnapshot.displayedCredits)
  ) {
    suggestions.push(
      action({
        id: 'review-usage-dashboard',
        type: 'open_dashboard',
        title: 'Review usage limits',
        description: 'You are close to a workspace usage limit.',
        priority: 88,
      })
    )
  }

  return suggestions
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 6)
}
