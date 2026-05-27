'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Brain,
  Check,
  Clipboard,
  FolderOpen,
  Loader2,
  MessageSquare,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import {
  MemoryVaultConversationSummary,
  MemoryVaultResponse,
} from '@/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not yet'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function extractPreferenceLines(memories: MemoryVaultConversationSummary[]) {
  const lines = memories.flatMap((memory) => {
    const summary = memory.memorySummary ?? ''
    const match = summary.match(/Known preferences:\n([\s\S]*?)(?:\n\n[A-Z][^\n]+:|$)/)
    if (!match?.[1]) return []

    return match[1]
      .split('\n')
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter(Boolean)
      .map((line) => ({
        line,
        conversationTitle: memory.title,
      }))
  })
  const seen = new Set<string>()

  return lines.filter((item) => {
    const key = item.line.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function Stat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/45 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function MemorySummaryCard({
  conversation,
  copied,
  isWorking,
  onCopy,
  onOpen,
  onClear,
  onToggle,
}: {
  conversation: MemoryVaultConversationSummary
  copied: boolean
  isWorking: boolean
  onCopy: () => void
  onOpen: () => void
  onClear: () => void
  onToggle: (enabled: boolean) => void
}) {
  const hasSummary = Boolean(conversation.memorySummary?.trim())

  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {conversation.title}
            </h3>
            <Badge variant={hasSummary ? 'secondary' : 'outline'} className="rounded-full">
              {hasSummary ? 'Saved summary' : 'No summary'}
            </Badge>
            <Badge variant={conversation.memoryEnabled ? 'outline' : 'secondary'} className="rounded-full">
              {conversation.memoryEnabled ? 'Memory on' : 'Memory off'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {conversation.projectName} / {conversation.messageCount} messages / Updated{' '}
            {formatDate(conversation.memoryUpdatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isWorking ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : null}
          <Switch
            checked={conversation.memoryEnabled}
            disabled={isWorking}
            onCheckedChange={onToggle}
          />
        </div>
      </div>

      {hasSummary ? (
        <pre className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-card/45 p-3 text-xs leading-5 text-foreground/85">
          {conversation.memorySummary}
        </pre>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border/60 bg-card/25 px-3 py-4 text-sm text-muted-foreground">
          This conversation has no saved memory summary yet.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={onOpen}
        >
          <MessageSquare className="mr-2 size-4" />
          Open chat
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          disabled={!hasSummary}
          onClick={onCopy}
        >
          {copied ? <Check className="mr-2 size-4" /> : <Clipboard className="mr-2 size-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl text-destructive hover:text-destructive"
          disabled={!hasSummary || isWorking}
          onClick={onClear}
        >
          <Trash2 className="mr-2 size-4" />
          Clear summary
        </Button>
      </div>
    </div>
  )
}

export function MemoryVault() {
  const {
    workspaceToolRequest,
    clearWorkspaceToolRequest,
    listMemoryVault,
    saveAppSettings,
    openConversation,
    setConversationMemoryEnabled,
    clearConversationMemory,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [vault, setVault] = useState<MemoryVaultResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedConversationId, setCopiedConversationId] = useState<string | null>(null)
  const [workingConversationId, setWorkingConversationId] = useState<string | null>(null)
  const [pendingClear, setPendingClear] =
    useState<MemoryVaultConversationSummary | null>(null)
  const [isSavingGlobal, setIsSavingGlobal] = useState(false)

  const preferences = useMemo(
    () => extractPreferenceLines(vault?.recentMemories ?? []),
    [vault?.recentMemories]
  )

  const loadVault = useCallback(async () => {
    if (!open) return

    setIsLoading(true)
    setError(null)

    try {
      setVault(await listMemoryVault())
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load Memory Vault.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [listMemoryVault, open])

  useEffect(() => {
    if (workspaceToolRequest?.tool !== 'memory-vault') return

    setOpen(true)
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [clearWorkspaceToolRequest, workspaceToolRequest])

  useEffect(() => {
    if (!open) return
    void loadVault()
  }, [loadVault, open])

  const handleGlobalToggle = async (checked: boolean) => {
    setIsSavingGlobal(true)
    setError(null)

    try {
      await saveAppSettings({
        sessionDefaults: {
          memory: checked,
        },
      })
      setVault((previous) =>
        previous ? { ...previous, globalMemoryEnabled: checked } : previous
      )
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update memory setting.'
      )
    } finally {
      setIsSavingGlobal(false)
    }
  }

  const refreshAfterConversationChange = async () => {
    setVault(await listMemoryVault())
  }

  const handleConversationToggle = async (
    conversation: MemoryVaultConversationSummary,
    checked: boolean
  ) => {
    setWorkingConversationId(conversation.id)
    setError(null)

    try {
      await setConversationMemoryEnabled(conversation.id, checked)
      await refreshAfterConversationChange()
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : 'Unable to update conversation memory.'
      )
    } finally {
      setWorkingConversationId(null)
    }
  }

  const handleClearMemory = async () => {
    if (!pendingClear) return

    setWorkingConversationId(pendingClear.id)
    setError(null)

    try {
      await clearConversationMemory(pendingClear.id)
      setPendingClear(null)
      await refreshAfterConversationChange()
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : 'Unable to clear memory summary.'
      )
    } finally {
      setWorkingConversationId(null)
    }
  }

  const handleCopy = async (conversation: MemoryVaultConversationSummary) => {
    if (!conversation.memorySummary?.trim()) return

    await navigator.clipboard.writeText(conversation.memorySummary)
    setCopiedConversationId(conversation.id)
    window.setTimeout(() => setCopiedConversationId(null), 1600)
  }

  const handleOpenConversation = async (conversationId: string) => {
    await openConversation(conversationId)
    setOpen(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] w-[calc(100vw-1rem)] max-w-6xl flex-col rounded-[28px] border border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40">
          <DialogHeader className="border-b border-border/70 px-5 py-5 text-left sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Brain className="size-5" />
                  Memory Vault
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-2xl">
                  Review and control the conversation memory Zenquanta can reuse.
                  Project memory is grouped from conversation summaries.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={isLoading}
                onClick={() => void loadVault()}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-2 size-4" />
                )}
                Refresh
              </Button>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
            {error ? (
              <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {isLoading && !vault ? (
              <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading memory...
              </div>
            ) : vault ? (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Projects" value={vault.totals.projectCount} />
                  <Stat label="Conversations" value={vault.totals.conversationCount} />
                  <Stat label="Saved memories" value={vault.totals.memoryConversationCount} />
                  <Stat
                    label="Memory enabled"
                    value={vault.totals.memoryEnabledConversationCount}
                  />
                </div>

                <section className="rounded-2xl border border-border/60 bg-card/45 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ShieldCheck className="size-4 text-muted-foreground" />
                        Global memory default
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        This controls whether new chats start with conversation memory
                        enabled. Existing conversations keep their own setting.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSavingGlobal ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : null}
                      <Switch
                        checked={vault.globalMemoryEnabled}
                        disabled={isSavingGlobal}
                        onCheckedChange={(checked) => void handleGlobalToggle(checked)}
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border/60 bg-card/45 p-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    Saved preferences
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Zenquanta does not currently store a separate global preference
                    profile. Preference-like notes are visible inside conversation
                    summaries and can be cleared with those summaries.
                  </p>
                  {preferences.length > 0 ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {preferences.slice(0, 6).map((preference) => (
                        <div
                          key={`${preference.conversationTitle}-${preference.line}`}
                          className="rounded-xl border border-border/60 bg-background/40 px-3 py-2"
                        >
                          <p className="text-sm text-foreground">{preference.line}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            From {preference.conversationTitle}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl border border-dashed border-border/60 bg-background/30 px-3 py-4 text-sm text-muted-foreground">
                      No preference-style memory notes are currently saved.
                    </p>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Recent Memory Summaries
                    </h3>
                    <Badge variant="outline" className="rounded-full">
                      Latest {formatDate(vault.totals.latestMemoryUpdatedAt)}
                    </Badge>
                  </div>
                  {vault.recentMemories.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {vault.recentMemories.map((conversation) => (
                        <MemorySummaryCard
                          key={conversation.id}
                          conversation={conversation}
                          copied={copiedConversationId === conversation.id}
                          isWorking={workingConversationId === conversation.id}
                          onCopy={() => void handleCopy(conversation)}
                          onOpen={() => void handleOpenConversation(conversation.id)}
                          onClear={() => setPendingClear(conversation)}
                          onToggle={(checked) =>
                            void handleConversationToggle(conversation, checked)
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-card/25 px-4 py-8 text-center text-sm text-muted-foreground">
                      No conversation memory summaries have been saved yet.
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Project Memory
                  </h3>
                  <div className="space-y-3">
                    {vault.projects.map((group) => (
                      <div
                        key={group.project.id}
                        className="rounded-2xl border border-border/60 bg-card/45 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <FolderOpen className="size-4 text-muted-foreground" />
                              {group.project.name}
                            </h4>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {group.memoryConversationCount}/{group.conversationCount}{' '}
                              conversations have saved memory / Latest{' '}
                              {formatDate(group.latestMemoryUpdatedAt)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              group.memoryConversationCount > 0 ? 'secondary' : 'outline'
                            }
                            className="w-fit rounded-full"
                          >
                            {group.memoryConversationCount > 0 ? 'Active' : 'Empty'}
                          </Badge>
                        </div>

                        {group.conversations.length > 0 ? (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {group.conversations.slice(0, 4).map((conversation) => (
                              <button
                                key={conversation.id}
                                type="button"
                                className={cn(
                                  'rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-left transition-colors hover:bg-background/60',
                                  !conversation.memorySummary && 'opacity-75'
                                )}
                                onClick={() => void handleOpenConversation(conversation.id)}
                              >
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {conversation.title}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {conversation.memorySummary
                                    ? `Memory updated ${formatDate(conversation.memoryUpdatedAt)}`
                                    : 'No saved summary'}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 rounded-xl border border-dashed border-border/60 bg-background/30 px-3 py-4 text-sm text-muted-foreground">
                            This project does not have conversations yet.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingClear)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingClear(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this memory summary?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved summary for &quot;{pendingClear?.title}&quot;. It does
              not delete the conversation or its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(workingConversationId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(workingConversationId)}
              onClick={(event) => {
                event.preventDefault()
                void handleClearMemory()
              }}
            >
              {workingConversationId ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Clear summary
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
