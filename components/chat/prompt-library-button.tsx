'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BookText,
  BookmarkPlus,
  Check,
  Link2,
  Loader2,
  Pencil,
  Play,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { ASSISTANT_FAMILY_COPY } from '@/lib/config/assistants'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import {
  AIMode,
  PromptWorkflow,
  TemplateShareCreated,
  TemplateShareInfo,
  TemplateShareType,
  TemplateShareVisibility,
} from '@/types'
import { Button } from '@/components/ui/button'
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
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PromptLibraryButtonProps {
  value: string
  currentMode: AIMode
  disabled?: boolean
  onUsePrompt: (content: string) => void
  // The composer opens this from its + menu and only needs an anchor.
  hideTrigger?: boolean
}

export function PromptLibraryButton({
  value,
  currentMode,
  disabled,
  onUsePrompt,
  hideTrigger = false,
}: PromptLibraryButtonProps) {
  const {
    promptLibrary,
    savePrompt,
    deletePrompt,
    promptWorkflows,
    deletePromptWorkflow,
    runPromptWorkflow,
    workspaceToolRequest,
    clearWorkspaceToolRequest,
    openWorkspaceTool,
  } = useChatContext()
  const [promptTitle, setPromptTitle] = useState('')
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [runWorkflow, setRunWorkflow] = useState<PromptWorkflow | null>(null)
  const [runValues, setRunValues] = useState<Record<string, string>>({})
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false)

  // Share state
  const [shareTarget, setShareTarget] = useState<{
    type: TemplateShareType
    id: string
    title: string
  } | null>(null)
  const [shares, setShares] = useState<TemplateShareInfo[]>([])
  const [isLoadingShares, setIsLoadingShares] = useState(false)
  const [isCreatingShare, setIsCreatingShare] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [newShareVisibility, setNewShareVisibility] = useState<TemplateShareVisibility>('public_link')
  const [newShareExpiresAt, setNewShareExpiresAt] = useState('')
  const [justCreatedShare, setJustCreatedShare] = useState<TemplateShareCreated | null>(null)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)

  const visiblePrompts = promptLibrary.filter(
    (prompt) => prompt.mode === 'any' || prompt.mode === currentMode
  )

  useEffect(() => {
    if (workspaceToolRequest?.tool !== 'prompt-library') return

    setIsPopoverOpen(true)
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [clearWorkspaceToolRequest, workspaceToolRequest])

  const prepareWorkflowRun = (workflow: PromptWorkflow) => {
    const values = Object.fromEntries(
      workflow.variables.map((variable) => [
        variable.name,
        variable.defaultValue ?? '',
      ])
    )
    setRunValues(values)
    setRunWorkflow(workflow)
  }

  const executeWorkflowRun = async () => {
    if (!runWorkflow) return

    setIsRunningWorkflow(true)
    try {
      await runPromptWorkflow(runWorkflow.id, runValues)
      setRunWorkflow(null)
      setIsPopoverOpen(false)
    } catch (error) {
      console.error('Failed to run workflow.', error)
    } finally {
      setIsRunningWorkflow(false)
    }
  }

  const openShares = useCallback(
    async (type: TemplateShareType, id: string, title: string) => {
      setShareTarget({ type, id, title })
      setJustCreatedShare(null)
      setShareError(null)
      setNewShareVisibility('public_link')
      setNewShareExpiresAt('')
      setIsLoadingShares(true)
      setShares([])
      try {
        const endpoint =
          type === 'prompt'
            ? `/api/prompts/${id}/shares`
            : `/api/prompt-workflows/${id}/shares`
        const res = await fetch(endpoint)
        if (res.ok) {
          const data = (await res.json()) as TemplateShareInfo[]
          setShares(data)
        }
      } finally {
        setIsLoadingShares(false)
      }
    },
    []
  )

  const createShareLink = async () => {
    if (!shareTarget) return
    setIsCreatingShare(true)
    setShareError(null)
    try {
      const endpoint =
        shareTarget.type === 'prompt'
          ? `/api/prompts/${shareTarget.id}/shares`
          : `/api/prompt-workflows/${shareTarget.id}/shares`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: newShareVisibility,
          expiresAt: newShareExpiresAt || null,
        }),
      })
      if (res.ok) {
        const created = (await res.json()) as TemplateShareCreated
        setJustCreatedShare(created)
        const shareInfo: TemplateShareInfo = {
          id: created.id,
          templateType: created.templateType,
          templateId: created.templateId,
          visibility: created.visibility,
          expiresAt: created.expiresAt,
          revokedAt: created.revokedAt,
          createdAt: created.createdAt,
        }
        setShares((previous) => [shareInfo, ...previous])
      } else {
        setShareError('Failed to create share link.')
      }
    } catch {
      setShareError('Failed to create share link.')
    } finally {
      setIsCreatingShare(false)
    }
  }

  const revokeShareLink = async (shareId: string) => {
    if (!shareTarget) return
    const endpoint =
      shareTarget.type === 'prompt'
        ? `/api/prompts/${shareTarget.id}/shares/${shareId}`
        : `/api/prompt-workflows/${shareTarget.id}/shares/${shareId}`
    const res = await fetch(endpoint, { method: 'DELETE' })
    if (res.ok) {
      setShares((previous) => previous.filter((s) => s.id !== shareId))
      if (justCreatedShare?.id === shareId) setJustCreatedShare(null)
    }
  }

  const copyShareLink = async (token: string) => {
    const url = `${window.location.origin}/share/templates/${token}`
    await navigator.clipboard.writeText(url).catch(() => null)
    setShareLinkCopied(true)
    setTimeout(() => setShareLinkCopied(false), 2000)
  }

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        {hideTrigger ? (
          <PopoverAnchor asChild>
            <span aria-hidden className="pointer-events-none absolute inset-0" />
          </PopoverAnchor>
        ) : (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Prompt library"
                    disabled={disabled}
                  >
                    <BookText className="size-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Prompts & playbooks</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <PopoverContent
          align="start"
          side={hideTrigger ? 'top' : undefined}
          className="w-[380px] rounded-2xl border-border/70 bg-background/95 p-4"
        >
          <Tabs defaultValue="prompts" className="space-y-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Prompts & playbooks
                </h3>
                <p className="text-xs text-muted-foreground">
                  Reuse a saved prompt or run a playbook.
                </p>
              </div>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="prompts">Prompts</TabsTrigger>
                <TabsTrigger value="workflows">Playbooks</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="prompts" className="space-y-4">
              <div className="space-y-2 rounded-2xl border border-border/60 bg-card/50 p-3">
                <Input
                  value={promptTitle}
                  onChange={(event) => setPromptTitle(event.target.value)}
                  placeholder="Prompt title"
                  className="h-9"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={!promptTitle.trim() || !value.trim()}
                  onClick={async () => {
                    const prompt = await savePrompt({
                      title: promptTitle,
                      content: value,
                      mode: currentMode,
                    })
                    if (!prompt) return
                    setPromptTitle('')
                  }}
                >
                  <BookmarkPlus className="mr-2 size-4" />
                  Save current draft
                </Button>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {visiblePrompts.length > 0 ? (
                  visiblePrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="rounded-2xl border border-border/60 bg-card/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {prompt.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {prompt.content}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-7"
                            onClick={() => void openShares('prompt', prompt.id, prompt.title)}
                          >
                            <Share2 className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-7"
                            onClick={() => deletePrompt(prompt.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full rounded-xl"
                        onClick={() => {
                          onUsePrompt(prompt.content)
                          setIsPopoverOpen(false)
                        }}
                      >
                        Use prompt
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-3 py-6 text-center text-sm text-muted-foreground">
                    No saved prompts for this mode yet.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="workflows" className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full rounded-xl"
                onClick={() => {
                  setIsPopoverOpen(false)
                  openWorkspaceTool({ tool: 'playbooks', playbookAction: 'create' })
                }}
              >
                <Plus className="mr-2 size-4" />
                New AI Playbook
              </Button>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {promptWorkflows.length > 0 ? (
                  promptWorkflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="rounded-2xl border border-border/60 bg-card/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {workflow.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {workflow.steps.length} step
                            {workflow.steps.length === 1 ? '' : 's'}
                            {workflow.variables.length > 0
                              ? ` • ${workflow.variables.length} variable${
                                  workflow.variables.length === 1 ? '' : 's'
                                }`
                              : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-7"
                            aria-label={`Edit ${workflow.title}`}
                            onClick={() => {
                              setIsPopoverOpen(false)
                              openWorkspaceTool({
                                tool: 'playbooks',
                                workflowId: workflow.id,
                                playbookAction: 'edit',
                              })
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-7"
                            onClick={() => void openShares('playbook', workflow.id, workflow.title)}
                          >
                            <Share2 className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-7"
                            onClick={() => deletePromptWorkflow(workflow.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 w-full rounded-xl"
                        onClick={() => prepareWorkflowRun(workflow)}
                      >
                        <Play className="mr-2 size-4" />
                        Run AI Playbook
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-3 py-6 text-center text-sm text-muted-foreground">
                    No AI Playbooks saved yet.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* Share Dialog */}
      <Dialog
        open={Boolean(shareTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setShareTarget(null)
            setJustCreatedShare(null)
            setShareError(null)
            setShares([])
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl border-border/70 bg-background/95">
          <DialogHeader>
            <DialogTitle>Share Template</DialogTitle>
            <DialogDescription>
              {shareTarget?.type === 'prompt'
                ? 'Create a link to share this prompt. Anyone with the link can preview and copy it.'
                : 'Create a link to share this AI Playbook. Anyone with the link can preview and copy it.'}
            </DialogDescription>
          </DialogHeader>

          {shareTarget ? (
            <div className="space-y-4">
              {/* Just-created link */}
              {justCreatedShare ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="mb-2 text-xs font-medium text-emerald-400">
                    Share link created — copy it now. It won&apos;t be shown again.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-background/60 px-2 py-1 text-xs text-foreground">
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/share/templates/${justCreatedShare.token}`
                        : `/share/templates/${justCreatedShare.token}`}
                    </code>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="size-7 shrink-0"
                      onClick={() => void copyShareLink(justCreatedShare.token)}
                    >
                      {shareLinkCopied ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Link2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Create new share */}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Create new share link
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={newShareVisibility}
                    onValueChange={(v) => setNewShareVisibility(v as TemplateShareVisibility)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public_link">Public link</SelectItem>
                      <SelectItem value="private_link">Private link</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={newShareExpiresAt}
                    onChange={(e) => setNewShareExpiresAt(e.target.value)}
                    placeholder="Expiry (optional)"
                    className="h-8 text-xs"
                  />
                </div>
                {shareError ? (
                  <p className="text-xs text-destructive">{shareError}</p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="w-full rounded-xl"
                  disabled={isCreatingShare}
                  onClick={() => void createShareLink()}
                >
                  {isCreatingShare ? (
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                  ) : (
                    <Share2 className="mr-2 size-3.5" />
                  )}
                  Create share link
                </Button>
              </div>

              {/* Active shares */}
              {isLoadingShares ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : shares.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Active links
                  </p>
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {share.visibility === 'public_link' ? 'Public' : 'Private'}
                          {share.expiresAt
                            ? ` · Expires ${new Date(share.expiresAt).toLocaleDateString()}`
                            : ''}
                          {' · '}Created{' '}
                          {new Date(share.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => void revokeShareLink(share.id)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShareTarget(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(runWorkflow)} onOpenChange={(open) => !open && setRunWorkflow(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-2xl border-border/70 bg-background/95">
          <DialogHeader>
            <DialogTitle>Run AI Playbook</DialogTitle>
            <DialogDescription>
              Fill the variables, then each AI Playbook step will be queued into the
              current chat.
            </DialogDescription>
          </DialogHeader>
          {runWorkflow ? (
            <div className="space-y-3">
              {runWorkflow.variables.length > 0 ? (
                runWorkflow.variables.map((variable) => (
                  <div key={variable.name} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {variable.label || variable.name}
                    </label>
                    <Input
                      value={runValues[variable.name] ?? ''}
                      onChange={(event) =>
                        setRunValues((previous) => ({
                          ...previous,
                          [variable.name]: event.target.value,
                        }))
                      }
                      placeholder={variable.name}
                    />
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border/60 bg-card/40 px-3 py-4 text-sm text-muted-foreground">
                  This AI Playbook has no variables.
                </div>
              )}
              <div className="space-y-1 rounded-2xl border border-border/60 bg-card/40 p-3">
                {runWorkflow.steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="truncate text-muted-foreground">
                      {step.order}. {step.title || ASSISTANT_FAMILY_COPY[step.assistantFamily].shortName}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border border-border/60 px-2 py-0.5',
                        'text-muted-foreground'
                      )}
                    >
                      {ASSISTANT_FAMILY_COPY[step.assistantFamily].shortName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRunWorkflow(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isRunningWorkflow}
              onClick={() => void executeWorkflowRun()}
            >
              Run AI Playbook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
