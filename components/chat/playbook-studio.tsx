'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import { PLAYBOOK_TEMPLATES } from '@/lib/config/playbook-templates'
import { ASSISTANT_FAMILY_COPY } from '@/lib/config/assistants'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import { downloadTextFile } from '@/lib/utils/export'
import {
  buildWorkflowStepPrompt,
  extractWorkflowVariableNames,
  getWorkflowUsageLevel,
  mergeWorkflowVariables,
  normalizePromptWorkflowMetadata,
  normalizePromptWorkflowStepMetadata,
  PLAYBOOK_CATEGORIES,
  PLAYBOOK_OUTPUT_TYPES,
  PLAYBOOK_STEP_TYPES,
  WORKFLOW_FAMILY_TO_MODE,
} from '@/lib/utils/prompt-workflows'
import {
  AssistantFamily,
  PlaybookTemplate,
  PromptWorkflow,
  PromptWorkflowMetadata,
  PromptWorkflowInput,
  PromptWorkflowRunHistoryItem,
  PromptWorkflowStepInput,
  PromptWorkflowStepMetadata,
  PromptWorkflowVariable,
} from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const ASSISTANT_FAMILIES = Object.keys(WORKFLOW_FAMILY_TO_MODE) as AssistantFamily[]
const PROJECT_FILTER_ALL = '__all__'

interface PlaybookDraft {
  id?: string
  title: string
  description: string
  projectId: string | null
  metadata: PromptWorkflowMetadata
  variables: PromptWorkflowVariable[]
  steps: PromptWorkflowStepInput[]
}

function createBlankStep(order: number): PromptWorkflowStepInput {
  const assistantFamily = 'nova'
  return {
    assistantFamily,
    mode: WORKFLOW_FAMILY_TO_MODE[assistantFamily],
    order,
    title: '',
    template: '',
    variableNames: [],
    metadata: normalizePromptWorkflowStepMetadata(undefined, assistantFamily),
  }
}

function variablesFromSteps(
  steps: PromptWorkflowStepInput[],
  existing: PromptWorkflowVariable[] = []
) {
  return mergeWorkflowVariables(
    existing,
    steps.flatMap((step) => extractWorkflowVariableNames(step.template))
  )
}

function workflowToDraft(workflow: PromptWorkflow): PlaybookDraft {
  return {
    id: workflow.id,
    title: workflow.title,
    description: workflow.description ?? '',
    projectId: workflow.projectId ?? null,
    metadata: normalizePromptWorkflowMetadata(workflow.metadata),
    variables: workflow.variables,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      title: step.title ?? '',
      order: step.order,
      assistantFamily: step.assistantFamily,
      mode: step.mode,
      template: step.template,
      variableNames: step.variableNames,
      metadata: normalizePromptWorkflowStepMetadata(
        step.metadata,
        step.assistantFamily
      ),
    })),
  }
}

function templateToDraft(template: PlaybookTemplate, projectId: string | null): PlaybookDraft {
  return {
    title: template.input.title,
    description: template.input.description ?? '',
    projectId,
    metadata: normalizePromptWorkflowMetadata(template.input.metadata),
    variables: template.input.variables ?? [],
    steps: template.input.steps.map((step, index) => ({
      ...step,
      mode: WORKFLOW_FAMILY_TO_MODE[step.assistantFamily],
      order: index + 1,
      variableNames:
        step.variableNames ?? extractWorkflowVariableNames(step.template),
      metadata: normalizePromptWorkflowStepMetadata(
        step.metadata,
        step.assistantFamily
      ),
    })),
  }
}

function draftToInput(draft: PlaybookDraft): PromptWorkflowInput {
  const steps = draft.steps
    .map((step, index) => ({
      ...step,
      order: index + 1,
      title: step.title?.trim() || null,
      template: step.template.trim(),
      variableNames: extractWorkflowVariableNames(step.template),
      metadata: normalizePromptWorkflowStepMetadata(
        step.metadata,
        step.assistantFamily
      ),
    }))
    .filter((step) => step.template)

  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    projectId: draft.projectId,
    metadata: normalizePromptWorkflowMetadata(draft.metadata),
    variables: variablesFromSteps(steps, draft.variables),
    steps,
  }
}

function statusLabel(status: PromptWorkflowRunHistoryItem['status']) {
  if (status === 'complete') return 'Completed'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusClass(status: PromptWorkflowRunHistoryItem['status']) {
  if (status === 'complete') return 'border-emerald-500/40 text-emerald-300'
  if (status === 'running') return 'border-blue-500/40 text-blue-300'
  if (status === 'failed') return 'border-destructive/50 text-destructive'
  return 'border-border/70 text-muted-foreground'
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function categoryLabel(value: PromptWorkflowMetadata['category']) {
  return PLAYBOOK_CATEGORIES.find((option) => option.value === value)?.label ?? 'Custom'
}

function outputTypeLabel(value: PromptWorkflowMetadata['expectedOutputType']) {
  return (
    PLAYBOOK_OUTPUT_TYPES.find((option) => option.value === value)?.label ??
    'Document'
  )
}

function stepTypeLabel(value: PromptWorkflowStepMetadata['stepType']) {
  return PLAYBOOK_STEP_TYPES.find((option) => option.value === value)?.label ?? 'Text'
}

function usageTone(level: 'low' | 'medium' | 'high') {
  if (level === 'high') return 'border-amber-500/45 text-amber-300'
  if (level === 'medium') return 'border-blue-500/40 text-blue-300'
  return 'border-emerald-500/40 text-emerald-300'
}

export function PlaybookStudio() {
  const {
    projects,
    selectedProjectId,
    promptWorkflows,
    savePromptWorkflow,
    deletePromptWorkflow,
    runPromptWorkflow,
    listPromptWorkflowRuns,
    openConversation,
    saveArtifact,
    workspaceToolRequest,
    clearWorkspaceToolRequest,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>(
    selectedProjectId === 'all' ? PROJECT_FILTER_ALL : selectedProjectId
  )
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PlaybookDraft | null>(null)
  const [runValues, setRunValues] = useState<Record<string, string>>({})
  const [runs, setRuns] = useState<PromptWorkflowRunHistoryItem[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isLoadingRuns, setIsLoadingRuns] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (workspaceToolRequest?.tool !== 'playbooks') return

    setOpen(true)
    if (workspaceToolRequest.projectId) {
      setProjectFilter(workspaceToolRequest.projectId)
    }
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [clearWorkspaceToolRequest, workspaceToolRequest])

  const visibleWorkflows = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return promptWorkflows.filter((workflow) => {
      if (
        projectFilter !== PROJECT_FILTER_ALL &&
        workflow.projectId !== projectFilter
      ) {
        return false
      }

      if (!normalized) return true

      return `${workflow.title} ${workflow.description ?? ''}`
        .toLowerCase()
        .includes(normalized)
    })
  }, [projectFilter, promptWorkflows, query])

  const selectedWorkflow = selectedWorkflowId
    ? promptWorkflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null
    : visibleWorkflows[0] ?? null

  const selectedRun =
    selectedRunId && runs.some((run) => run.id === selectedRunId)
      ? runs.find((run) => run.id === selectedRunId) ?? null
      : runs[0] ?? null

  useEffect(() => {
    if (!open) return
    if (selectedWorkflowId && promptWorkflows.some((item) => item.id === selectedWorkflowId)) {
      return
    }

    setSelectedWorkflowId(visibleWorkflows[0]?.id ?? null)
  }, [open, promptWorkflows, selectedWorkflowId, visibleWorkflows])

  useEffect(() => {
    if (!open || !selectedWorkflow) {
      setRuns([])
      return
    }

    let cancelled = false
    setIsLoadingRuns(true)
    setError(null)

    listPromptWorkflowRuns(selectedWorkflow.id)
      .then((items) => {
        if (cancelled) return
        setRuns(items)
        setSelectedRunId((previous) =>
          previous && items.some((item) => item.id === previous)
            ? previous
            : items[0]?.id ?? null
        )
      })
      .catch((runError) => {
        if (cancelled) return
        setRuns([])
        setError(
          runError instanceof Error ? runError.message : 'Unable to load run history.'
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRuns(false)
      })

    return () => {
      cancelled = true
    }
  }, [listPromptWorkflowRuns, open, selectedWorkflow])

  const startNewDraft = () => {
    setDraft({
      title: '',
      description: '',
      projectId: projectFilter === PROJECT_FILTER_ALL ? null : projectFilter,
      metadata: {
        category: 'custom',
        expectedOutputType: 'document',
        suggestedAssistant: 'nova',
        visibility: 'private',
      },
      variables: [],
      steps: [createBlankStep(1)],
    })
  }

  const updateDraftStep = (
    index: number,
    patch: Partial<PromptWorkflowStepInput>
  ) => {
    setDraft((previous) => {
      if (!previous) return previous
      const steps = previous.steps.map((step, stepIndex) => {
        if (stepIndex !== index) return step
        const assistantFamily = patch.assistantFamily ?? step.assistantFamily
        const metadataSource =
          patch.metadata ??
          (patch.assistantFamily
            ? {
                ...step.metadata,
                stepType: undefined,
              }
            : step.metadata)
        return {
          ...step,
          ...patch,
          assistantFamily,
          mode: WORKFLOW_FAMILY_TO_MODE[assistantFamily],
          metadata: normalizePromptWorkflowStepMetadata(
            metadataSource,
            assistantFamily
          ),
        }
      })
      return {
        ...previous,
        steps,
        variables: variablesFromSteps(steps, previous.variables),
      }
    })
  }

  const updateDraftVariable = (
    name: string,
    patch: Partial<PromptWorkflowVariable>
  ) => {
    setDraft((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        variables: previous.variables.map((variable) =>
          variable.name === name ? { ...variable, ...patch } : variable
        ),
      }
    })
  }

  const moveDraftStep = (index: number, direction: -1 | 1) => {
    setDraft((previous) => {
      if (!previous) return previous
      const target = index + direction
      if (target < 0 || target >= previous.steps.length) return previous
      const steps = [...previous.steps]
      const [step] = steps.splice(index, 1)
      steps.splice(target, 0, step)
      return {
        ...previous,
        steps: steps.map((item, stepIndex) => ({
          ...item,
          order: stepIndex + 1,
        })),
      }
    })
  }

  const saveDraft = async () => {
    if (!draft) return
    setIsSaving(true)
    setError(null)

    try {
      const saved = await savePromptWorkflow({
        id: draft.id,
        ...draftToInput(draft),
      })
      if (saved) {
        setDraft(null)
        setSelectedWorkflowId(saved.id)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const installTemplate = async (template: PlaybookTemplate, copy = false) => {
    const existing = promptWorkflows.find(
      (workflow) => workflow.title.trim() === template.title
    )

    if (existing && !copy) {
      setSelectedWorkflowId(existing.id)
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const baseProjectId =
        projectFilter === PROJECT_FILTER_ALL ? null : projectFilter
      const input = draftToInput(templateToDraft(template, baseProjectId))
      const saved = await savePromptWorkflow({
        ...input,
        title: copy ? `${input.title} Copy` : input.title,
      })
      if (saved) setSelectedWorkflowId(saved.id)
    } finally {
      setIsSaving(false)
    }
  }

  const runSelectedPlaybook = async () => {
    if (!selectedWorkflow) return
    if (missingRequiredVariables.length > 0) {
      setError(
        `Fill required variables before running: ${missingRequiredVariables
          .map((variable) => variable.label || variable.name)
          .join(', ')}.`
      )
      return
    }

    setIsRunning(true)
    setError(null)
    try {
      await runPromptWorkflow(selectedWorkflow.id, effectiveRunValues)
      const nextRuns = await listPromptWorkflowRuns(selectedWorkflow.id)
      setRuns(nextRuns)
      setSelectedRunId(nextRuns[0]?.id ?? null)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Unable to run AI Playbook.')
    } finally {
      setIsRunning(false)
    }
  }

  const saveRunAsArtifact = async (run: PromptWorkflowRunHistoryItem) => {
    if (!selectedWorkflow || !run.finalOutput) return

    const artifact = await saveArtifact({
      title: `${selectedWorkflow.title} output`,
      content: run.finalOutput.content,
      artifactType: 'workflow_output',
      sourceType: 'workflow_run',
      projectId: run.projectId ?? selectedWorkflow.projectId ?? null,
      conversationId: run.conversationId ?? run.finalOutput.conversationId,
      sourceMessageId: run.finalOutput.messageId,
      metadata: {
        workflowId: selectedWorkflow.id,
        runId: run.id,
        variableValues: run.variableValues,
        projectId: run.projectId ?? selectedWorkflow.projectId ?? null,
        conversationId: run.conversationId ?? run.finalOutput.conversationId,
        sourceMessageId: run.finalOutput.messageId,
      },
    })

    if (artifact) {
      setError(null)
    }
  }

  const selectedVariables = selectedWorkflow?.variables ?? []
  const draftVariables = draft ? variablesFromSteps(draft.steps, draft.variables) : []
  const selectedMetadata = normalizePromptWorkflowMetadata(selectedWorkflow?.metadata)
  const effectiveRunValues = Object.fromEntries(
    selectedVariables.map((variable) => [
      variable.name,
      runValues[variable.name] ?? variable.defaultValue ?? '',
    ])
  )
  const usageLevel = selectedWorkflow
    ? getWorkflowUsageLevel({
        steps: selectedWorkflow.steps,
        values: effectiveRunValues,
      })
    : 'low'
  const missingRequiredVariables = selectedVariables.filter(
    (variable) =>
      variable.required !== false &&
      !(effectiveRunValues[variable.name] ?? '').trim()
  )
  const expandedPrompts =
    selectedWorkflow?.steps.map((step) => ({
      step,
      prompt: buildWorkflowStepPrompt({
        step,
        values: effectiveRunValues,
        preview: true,
      }),
    })) ?? []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5" />
            AI Playbooks
          </DialogTitle>
          <DialogDescription>
            Build, run, and review reusable multi-step AI workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[340px_1fr]">
          <aside className="min-h-0 overflow-y-auto border-r border-border/60 p-4">
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Search AI Playbooks"
                />
              </div>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Project filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROJECT_FILTER_ALL}>All projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" className="w-full" onClick={startNewDraft}>
                <Plus className="mr-2 size-4" />
                New AI Playbook
              </Button>
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Saved</p>
              {visibleWorkflows.length > 0 ? (
                visibleWorkflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    type="button"
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selectedWorkflow?.id === workflow.id
                        ? 'border-primary/45 bg-primary/10'
                        : 'border-border/60 bg-card/40 hover:bg-card/70'
                    )}
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                  >
                    <span className="block truncate text-sm font-medium">
                      {workflow.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {workflow.steps.length} steps
                      {workflow.projectId
                        ? ` • ${
                            projects.find((project) => project.id === workflow.projectId)
                              ?.name ?? 'Project'
                          }`
                        : ' • Global'}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  No AI Playbooks match this view.
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Starter templates</p>
              {PLAYBOOK_TEMPLATES.map((template) => {
                const existing = promptWorkflows.find(
                  (workflow) => workflow.title.trim() === template.title
                )
                return (
                  <div
                    key={template.id}
                    className="rounded-lg border border-border/60 bg-card/35 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{template.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                      {existing ? (
                        <Badge variant="outline" className="shrink-0">
                          Installed
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isSaving}
                        onClick={() => void installTemplate(template)}
                      >
                        {existing ? 'Open existing' : 'Install'}
                      </Button>
                      {existing ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => void installTemplate(template, true)}
                        >
                          Install another copy
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-5">
            {error ? (
              <div className="mb-4 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {selectedWorkflow ? (
              <div className="space-y-5">
                <section className="rounded-xl border border-border/60 bg-card/35 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedWorkflow.title}</h2>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {selectedWorkflow.description || 'No description yet.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {selectedWorkflow.steps.length} steps
                        </Badge>
                        <Badge variant="outline">
                          {selectedVariables.length} variables
                        </Badge>
                        <Badge variant="outline">
                          {categoryLabel(selectedMetadata.category)}
                        </Badge>
                        <Badge variant="outline">
                          {outputTypeLabel(selectedMetadata.expectedOutputType)}
                        </Badge>
                        {selectedMetadata.suggestedAssistant ? (
                          <Badge variant="outline">
                            Suggested:{' '}
                            {
                              ASSISTANT_FAMILY_COPY[
                                selectedMetadata.suggestedAssistant
                              ].shortName
                            }
                          </Badge>
                        ) : null}
                        <Badge variant="outline">Private</Badge>
                        <Badge variant="outline">
                          {selectedWorkflow.projectId
                            ? projects.find(
                                (project) => project.id === selectedWorkflow.projectId
                              )?.name ?? 'Project'
                            : 'Global'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setDraft(workflowToDraft(selectedWorkflow))}
                      >
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          void deletePromptWorkflow(selectedWorkflow.id)
                          setSelectedWorkflowId(null)
                        }}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/60 bg-card/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium">Run launcher</h3>
                        <Button
                          type="button"
                          disabled={isRunning || missingRequiredVariables.length > 0}
                          onClick={() => void runSelectedPlaybook()}
                        >
                          {isRunning ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Play className="mr-2 size-4" />
                          )}
                          Run AI Playbook
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                        <Info className="size-3.5" />
                        <span>Each step may consume usage.</span>
                        <Badge variant="outline" className={usageTone(usageLevel)}>
                          {usageLevel} usage
                        </Badge>
                      </div>
                      {selectedVariables.length > 0 ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {selectedVariables.map((variable) => (
                            <label key={variable.name} className="space-y-1">
                              <span className="text-xs font-medium">
                                {variable.label || variable.name}
                              </span>
                              <Input
                                value={
                                  runValues[variable.name] ??
                                  variable.defaultValue ??
                                  ''
                                }
                                onChange={(event) =>
                                  setRunValues((previous) => ({
                                    ...previous,
                                    [variable.name]: event.target.value,
                                  }))
                                }
                                placeholder={variable.label ?? variable.name}
                              />
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          This AI Playbook has no variables.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-border/60 bg-card/35 p-4">
                      <h3 className="font-medium">Step preview</h3>
                      <div className="mt-3 space-y-3">
                        {expandedPrompts.map(({ step, prompt }) => (
                          <div
                            key={step.id}
                            className="rounded-lg border border-border/60 bg-background/45 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">
                                {step.order}. {step.title || 'Untitled step'}
                              </p>
                              <div className="flex flex-wrap justify-end gap-1.5">
                                <Badge variant="outline">
                                  {ASSISTANT_FAMILY_COPY[step.assistantFamily].shortName}
                                </Badge>
                                <Badge variant="outline">
                                  {stepTypeLabel(step.metadata.stepType)}
                                </Badge>
                                {step.metadata.includePreviousOutput ? (
                                  <Badge variant="outline">Uses previous output</Badge>
                                ) : null}
                              </div>
                            </div>
                            {step.metadata.outputLabel ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Output: {step.metadata.outputLabel}
                              </p>
                            ) : null}
                            <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                              {prompt}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/60 bg-card/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium">Run history</h3>
                        {isLoadingRuns ? <Loader2 className="size-4 animate-spin" /> : null}
                      </div>
                      <div className="mt-3 space-y-2">
                        {runs.length > 0 ? (
                          runs.map((run) => (
                            <button
                              key={run.id}
                              type="button"
                              className={cn(
                                'w-full rounded-lg border p-3 text-left',
                                selectedRun?.id === run.id
                                  ? 'border-primary/45 bg-primary/10'
                                  : 'border-border/60 bg-background/35'
                              )}
                              onClick={() => setSelectedRunId(run.id)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm">{formatDate(run.createdAt)}</span>
                                <Badge variant="outline" className={statusClass(run.status)}>
                                  {statusLabel(run.status)}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {run.stepRuns.length} steps
                                {run.error ? ` • ${run.error}` : ''}
                              </p>
                            </button>
                          ))
                        ) : (
                          <p className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                            No runs yet. Launch the AI Playbook to create history.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-card/35 p-4">
                      <h3 className="font-medium">Final output</h3>
                      {selectedRun?.finalOutput ? (
                        <div className="mt-3 space-y-3">
                          <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60 bg-background/55 p-3 text-sm leading-6 text-muted-foreground">
                            <pre className="whitespace-pre-wrap font-sans">
                              {selectedRun.finalOutput.content}
                            </pre>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                selectedRun.conversationId
                                  ? void openConversation(selectedRun.conversationId)
                                  : undefined
                              }
                              disabled={!selectedRun.conversationId}
                            >
                              <ExternalLink className="mr-2 size-4" />
                              Open conversation
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void saveRunAsArtifact(selectedRun)}
                            >
                              <FileText className="mr-2 size-4" />
                              Save as Artifact
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void navigator.clipboard?.writeText(
                                  selectedRun.finalOutput?.content ?? ''
                                )
                              }
                            >
                              <Copy className="mr-2 size-4" />
                              Copy
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                downloadTextFile(
                                  `${selectedWorkflow.title}-output.md`,
                                  selectedRun.finalOutput?.content ?? '',
                                  'text/markdown'
                                )
                              }
                            >
                              <Download className="mr-2 size-4" />
                              Export
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                          Output unavailable for this run. Older runs may not have stored
                          message links yet.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="flex min-h-[460px] items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center">
                <div className="max-w-md">
                  <CheckCircle2 className="mx-auto size-10 text-muted-foreground" />
                  <h2 className="mt-4 text-lg font-semibold">Create your first AI Playbook</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Install a starter template or build a reusable sequence for work you do often.
                  </p>
                  <Button type="button" className="mt-4" onClick={startNewDraft}>
                    <Plus className="mr-2 size-4" />
                    New AI Playbook
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </DialogContent>

      <Dialog open={Boolean(draft)} onOpenChange={(nextOpen) => !nextOpen && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit AI Playbook' : 'Create AI Playbook'}</DialogTitle>
            <DialogDescription>
              Steps run in order through the normal chat or Prism image path.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <Input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((previous) =>
                      previous ? { ...previous, title: event.target.value } : previous
                    )
                  }
                  placeholder="AI Playbook title"
                />
                <Select
                  value={draft.projectId ?? PROJECT_FILTER_ALL}
                  onValueChange={(value) =>
                    setDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            projectId: value === PROJECT_FILTER_ALL ? null : value,
                          }
                        : previous
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROJECT_FILTER_ALL}>Global</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Select
                  value={draft.metadata.category}
                  onValueChange={(value) =>
                    setDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            metadata: normalizePromptWorkflowMetadata({
                              ...previous.metadata,
                              category: value,
                            }),
                          }
                        : previous
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYBOOK_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={draft.metadata.expectedOutputType}
                  onValueChange={(value) =>
                    setDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            metadata: normalizePromptWorkflowMetadata({
                              ...previous.metadata,
                              expectedOutputType: value,
                            }),
                          }
                        : previous
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Expected output" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYBOOK_OUTPUT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={draft.metadata.suggestedAssistant ?? 'nova'}
                  onValueChange={(value) =>
                    setDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            metadata: normalizePromptWorkflowMetadata({
                              ...previous.metadata,
                              suggestedAssistant: value as AssistantFamily,
                            }),
                          }
                        : previous
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Suggested assistant" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSISTANT_FAMILIES.map((family) => (
                      <SelectItem key={family} value={family}>
                        {ASSISTANT_FAMILY_COPY[family].shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex h-9 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-sm text-muted-foreground">
                  Visibility: private
                </div>
              </div>
              <Textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((previous) =>
                    previous ? { ...previous, description: event.target.value } : previous
                  )
                }
                placeholder="What does this AI Playbook help with?"
              />
              <div className="space-y-3">
                {draft.steps.map((step, index) => (
                  <div key={step.id ?? index} className="rounded-xl border border-border/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">Step {index + 1}</span>
                      <Input
                        value={step.title ?? ''}
                        onChange={(event) =>
                          updateDraftStep(index, { title: event.target.value })
                        }
                        className="min-w-[180px] flex-1"
                        placeholder="Step title"
                      />
                      <Select
                        value={step.assistantFamily}
                        onValueChange={(value) =>
                          updateDraftStep(index, {
                            assistantFamily: value as AssistantFamily,
                          })
                        }
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSISTANT_FAMILIES.map((family) => (
                            <SelectItem key={family} value={family}>
                              {ASSISTANT_FAMILY_COPY[family].shortName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        onClick={() => moveDraftStep(index, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === draft.steps.length - 1}
                        onClick={() => moveDraftStep(index, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={draft.steps.length === 1}
                        onClick={() =>
                          setDraft((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  steps: previous.steps.filter((_, stepIndex) => stepIndex !== index),
                                  variables: variablesFromSteps(
                                    previous.steps.filter(
                                      (_, stepIndex) => stepIndex !== index
                                    ),
                                    previous.variables
                                  ),
                                }
                              : previous
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr_auto]">
                      <Select
                        value={
                          normalizePromptWorkflowStepMetadata(
                            step.metadata,
                            step.assistantFamily
                          ).stepType
                        }
                        onValueChange={(value) =>
                          updateDraftStep(index, {
                            metadata: {
                              ...step.metadata,
                              stepType: value as PromptWorkflowStepMetadata['stepType'],
                            },
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Step type" />
                        </SelectTrigger>
                        <SelectContent>
                          {PLAYBOOK_STEP_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={step.metadata?.outputLabel ?? ''}
                        onChange={(event) =>
                          updateDraftStep(index, {
                            metadata: {
                              ...step.metadata,
                              outputLabel: event.target.value,
                            },
                          })
                        }
                        placeholder="Output label, e.g. Research notes"
                      />
                      <label className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={step.metadata?.includePreviousOutput === true}
                          onCheckedChange={(checked) =>
                            updateDraftStep(index, {
                              metadata: {
                                ...step.metadata,
                                includePreviousOutput: checked === true,
                              },
                            })
                          }
                        />
                        Use previous output
                      </label>
                    </div>
                    <Textarea
                      value={step.template}
                      onChange={(event) =>
                        updateDraftStep(index, {
                          template: event.target.value,
                          variableNames: extractWorkflowVariableNames(event.target.value),
                        })
                      }
                      className="mt-3 min-h-[120px]"
                      placeholder="Prompt template. Use variables like {{topic}}."
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {draftVariables.length > 0 ? (
                    <div className="space-y-2 rounded-xl border border-border/60 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        User inputs detected from prompt variables
                      </p>
                      <div className="grid gap-2">
                        {draftVariables.map((variable) => (
                          <div
                            key={variable.name}
                            className="grid gap-2 md:grid-cols-[140px_1fr_1fr_auto]"
                          >
                            <Badge
                              variant="outline"
                              className="h-9 justify-center rounded-md"
                            >
                              {variable.name}
                            </Badge>
                            <Input
                              value={variable.label ?? variable.name}
                              onChange={(event) =>
                                updateDraftVariable(variable.name, {
                                  label: event.target.value,
                                })
                              }
                              placeholder="Label"
                            />
                            <Input
                              value={variable.defaultValue ?? ''}
                              onChange={(event) =>
                                updateDraftVariable(variable.name, {
                                  defaultValue: event.target.value,
                                })
                              }
                              placeholder="Default value"
                            />
                            <label className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                              <Checkbox
                                checked={variable.required !== false}
                                onCheckedChange={(checked) =>
                                  updateDraftVariable(variable.name, {
                                    required: checked === true,
                                  })
                                }
                              />
                              Required
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Add variables like {'{{business_name}}'} to prompt templates to collect user inputs.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            steps: [...previous.steps, createBlankStep(previous.steps.length + 1)],
                          }
                        : previous
                    )
                  }
                >
                  <Plus className="mr-2 size-4" />
                  Add step
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                isSaving ||
                !draft?.title.trim() ||
                !draft.steps.some((step) => step.template.trim())
              }
              onClick={() => void saveDraft()}
            >
              {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save AI Playbook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
