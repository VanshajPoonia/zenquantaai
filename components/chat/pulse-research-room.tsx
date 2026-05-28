'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BookOpen,
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Save,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import {
  PulseResearchActionType,
  PulseResearchRoomResponse,
  PulseResearchSourceItem,
} from '@/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

const PROJECT_FILTER_ALL = 'all'

interface ResearchActionDraft {
  type: PulseResearchActionType
  title: string
  description: string
  content: string
  projectId?: string | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not yet'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function sourceCitation(source: PulseResearchSourceItem) {
  return `${source.source.title} (${source.source.domain}) - ${source.source.url}`
}

function sourceBundle(sources: PulseResearchSourceItem[]) {
  return sources
    .map(
      (item, index) =>
        `[${index + 1}] ${item.source.title}\nURL: ${item.source.url}\nSnippet: ${item.source.snippet}`
    )
    .join('\n\n')
}

function buildActionDraft(
  type: PulseResearchActionType,
  sources: PulseResearchSourceItem[],
  projectId?: string | null
): ResearchActionDraft {
  const bundle = sourceBundle(sources)

  switch (type) {
    case 'summarize_sources':
      return {
        type,
        title: 'Summarize latest sources',
        description: 'Send a Pulse prompt through normal text chat.',
        projectId,
        content: `Summarize the latest source snippets below. Separate confirmed points, uncertainties, and practical next steps. Cite sources by number.\n\n${bundle}`,
      }
    case 'opposing_views':
      return {
        type,
        title: 'Find opposing views',
        description: 'Ask Pulse to challenge the current source set.',
        projectId,
        content: `Use the source snippets below as the starting point. Identify likely opposing views, missing stakeholder perspectives, and what I should search or verify next. Cite sources by number when grounding a point.\n\n${bundle}`,
      }
    case 'research_brief':
      return {
        type,
        title: 'Create research brief',
        description: 'Create a source-backed brief through normal Pulse chat.',
        projectId,
        content: `Create a concise research brief from these source snippets. Include: executive summary, key findings, source notes, risks/gaps, and recommended next actions. Cite sources by number.\n\n${bundle}`,
      }
    case 'compare_sources':
      return {
        type,
        title: 'Compare sources',
        description: 'Ask Pulse to compare agreement and gaps.',
        projectId,
        content: `Compare these sources. Show where they agree, where they conflict, which claims are strongest, which claims need verification, and what follow-up question I should ask next. Cite sources by number.\n\n${bundle}`,
      }
  }
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/25 px-4 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function PulseResearchRoom() {
  const {
    projects,
    selectedProjectId,
    workspaceToolRequest,
    clearWorkspaceToolRequest,
    listPulseResearchRoom,
    openConversation,
    prepareComposerDraft,
    sendMessage,
    saveArtifact,
    setSelectedProjectId,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [room, setRoom] = useState<PulseResearchRoomResponse | null>(null)
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>(PROJECT_FILTER_ALL)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionDraft, setActionDraft] = useState<ResearchActionDraft | null>(null)
  const [isSendingAction, setIsSendingAction] = useState(false)

  const scopedProjectId =
    projectFilter === PROJECT_FILTER_ALL ? null : projectFilter
  const actionSources = useMemo(
    () => (room?.recentSources ?? []).slice(0, 6),
    [room?.recentSources]
  )

  const loadRoom = useCallback(async () => {
    if (!open) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await listPulseResearchRoom({
        q: query.trim() || undefined,
        projectId: scopedProjectId,
      })
      setRoom(response)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load Pulse Research Room.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [listPulseResearchRoom, open, query, scopedProjectId])

  useEffect(() => {
    if (!workspaceToolRequest || workspaceToolRequest.tool !== 'pulse-research-room') {
      return
    }

    setOpen(true)
    if (workspaceToolRequest.projectId) {
      setProjectFilter(workspaceToolRequest.projectId)
    } else if (selectedProjectId !== 'all') {
      setProjectFilter(selectedProjectId)
    }
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [
    clearWorkspaceToolRequest,
    selectedProjectId,
    workspaceToolRequest,
  ])

  useEffect(() => {
    void loadRoom()
  }, [loadRoom])

  const copyText = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(null), 1600)
  }

  const saveSource = async (item: PulseResearchSourceItem) => {
    const artifact = await saveArtifact({
      projectId: item.projectId,
      conversationId: item.conversationId,
      sourceMessageId: item.messageId,
      sourceType: 'pulse_report',
      title: item.source.title,
      artifactType: 'research_report',
      content: [
        `# ${item.source.title}`,
        '',
        `URL: ${item.source.url}`,
        `Domain: ${item.source.domain}`,
        '',
        item.source.snippet,
        item.prompt ? `\nOriginal prompt:\n${item.prompt}` : '',
      ].join('\n'),
      metadata: {
        sourceKind: 'pulse_source',
        source: 'pulse_research_room',
        url: item.source.url,
        domain: item.source.domain,
        title: item.source.title,
        snippet: item.source.snippet,
        conversationId: item.conversationId,
        messageId: item.messageId,
      },
    })

    if (artifact) {
      setNotice('Source saved as a Pulse artifact.')
      await loadRoom()
    }
  }

  const handleUseSourceInFollowUp = (item: PulseResearchSourceItem) => {
    prepareComposerDraft({
      mode: 'live',
      kind: 'chat',
      projectId: item.projectId,
      content: `Use this source in a follow-up answer. Be explicit about what it does and does not support.\n\nSource: ${sourceCitation(item)}\nSnippet: ${item.source.snippet}\n\nMy follow-up question: `,
    })
    setNotice('Pulse follow-up draft is ready in the composer.')
  }

  const openResearchAction = (type: PulseResearchActionType) => {
    if (actionSources.length === 0) return
    setActionDraft(buildActionDraft(type, actionSources, scopedProjectId))
  }

  const runResearchAction = async () => {
    if (!actionDraft?.content.trim()) return

    setIsSendingAction(true)
    setError(null)

    try {
      if (actionDraft.projectId) {
        setSelectedProjectId(actionDraft.projectId)
      }
      await sendMessage({
        content: actionDraft.content,
        kind: 'chat',
        modeOverride: 'live',
        customAssistantId: null,
      })
      setActionDraft(null)
      setOpen(false)
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Unable to send Pulse research action.'
      )
    } finally {
      setIsSendingAction(false)
    }
  }

  const saveSourceBundle = async () => {
    if (actionSources.length === 0) return
    const artifact = await saveArtifact({
      projectId: scopedProjectId,
      sourceType: 'pulse_report',
      title: 'Pulse source bundle',
      artifactType: 'research_report',
      content: `# Pulse source bundle\n\n${sourceBundle(actionSources)}`,
      metadata: {
        sourceKind: 'pulse_source_bundle',
        source: 'pulse_research_room',
        sourceCount: actionSources.length,
      },
    })

    if (artifact) {
      setNotice('Source bundle saved as a Pulse artifact.')
      await loadRoom()
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] max-w-6xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Zap className="size-5 text-live" />
                  Pulse Research Room
                </DialogTitle>
                <DialogDescription>
                  Review source-backed Pulse work, reuse citations, and launch
                  focused research prompts.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => void loadRoom()}
                disabled={isLoading}
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

          <div className="grid gap-3 border-b border-border/60 px-6 py-4 lg:grid-cols-[1fr_240px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Pulse sources, prompts, and conversations"
                className="pl-9"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Project" />
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
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 p-6">
              {!room?.webSearchAvailable ? (
                <Alert>
                  <ShieldAlert className="size-4" />
                  <AlertTitle>Live web search is not configured</AlertTitle>
                  <AlertDescription>
                    Pulse can still use saved sources and conversation context,
                    but new answers should not be presented as live verification
                    unless Tavily is configured server-side.
                  </AlertDescription>
                </Alert>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <ShieldAlert className="size-4" />
                  <AlertTitle>Research Room unavailable</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {notice ? (
                <div className="rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-sm text-live">
                  {notice}
                </div>
              ) : null}

              <section className="grid gap-3 md:grid-cols-4">
                {[
                  ['Pulse chats', room?.conversations.length ?? 0],
                  ['Sources', room?.recentSources.length ?? 0],
                  ['Saved', room?.savedSources.length ?? 0],
                  ['Searches', room?.recentSearches.length ?? 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-border/60 bg-card/45 p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{value}</p>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-border/60 bg-card/35 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Research actions</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Actions use the latest shown sources and send only after
                      confirmation. Each Pulse send may consume usage.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={actionSources.length === 0}
                    onClick={() => void saveSourceBundle()}
                  >
                    <Save className="mr-2 size-4" />
                    Save sources
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['summarize_sources', 'Summarize latest sources'],
                    ['opposing_views', 'Find opposing views'],
                    ['research_brief', 'Create research brief'],
                    ['compare_sources', 'Compare sources'],
                  ].map(([type, label]) => (
                    <Button
                      key={type}
                      type="button"
                      variant="secondary"
                      className="justify-start rounded-xl"
                      disabled={actionSources.length === 0}
                      onClick={() => openResearchAction(type as PulseResearchActionType)}
                    >
                      <Sparkles className="mr-2 size-4" />
                      {label}
                    </Button>
                  ))}
                </div>
              </section>

              <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Recent sources</h3>
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                  {room?.recentSources.length ? (
                    <div className="space-y-3">
                      {room.recentSources.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-2xl border border-border/60 bg-background/45 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold">
                                  {item.source.title}
                                </h4>
                                <Badge variant="outline" className="rounded-full">
                                  {item.source.domain}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.conversationTitle} / {item.projectName} /{' '}
                                {formatDate(item.createdAt)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 shrink-0 rounded-xl"
                              onClick={() => window.open(item.source.url, '_blank', 'noreferrer')}
                            >
                              <ExternalLink className="size-4" />
                            </Button>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-foreground/85">
                            {item.source.snippet}
                          </p>
                          {item.prompt ? (
                            <p className="mt-3 rounded-xl border border-border/60 bg-card/35 px-3 py-2 text-xs text-muted-foreground">
                              Prompt: {item.prompt}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => void copyText(item.id, sourceCitation(item))}
                            >
                              {copiedId === item.id ? (
                                <Check className="mr-2 size-4" />
                              ) : (
                                <Clipboard className="mr-2 size-4" />
                              )}
                              {copiedId === item.id ? 'Copied' : 'Copy citation'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => handleUseSourceInFollowUp(item)}
                            >
                              <Send className="mr-2 size-4" />
                              Use in follow-up
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => void saveSource(item)}
                            >
                              <Save className="mr-2 size-4" />
                              Save source
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => void openConversation(item.conversationId)}
                            >
                              <MessageSquare className="mr-2 size-4" />
                              Open chat
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyPanel>
                      No web sources match this view yet. Send a Pulse prompt or
                      enable web search on a chat to collect source-backed
                      messages.
                    </EmptyPanel>
                  )}
                </section>

                <div className="space-y-5">
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Recent Pulse chats</h3>
                    {room?.conversations.length ? (
                      <div className="space-y-2">
                        {room.conversations.map((conversation) => (
                          <button
                            key={conversation.id}
                            type="button"
                            className={cn(
                              'w-full rounded-2xl border border-border/60 bg-card/35 p-3 text-left transition-colors',
                              'hover:border-live/50 hover:bg-live/10'
                            )}
                            onClick={() => void openConversation(conversation.id)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-sm font-semibold">
                                {conversation.title}
                              </span>
                              <Badge variant="secondary" className="rounded-full">
                                {conversation.sourceCount} sources
                              </Badge>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {conversation.preview}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyPanel>No Pulse conversations found.</EmptyPanel>
                    )}
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Saved sources</h3>
                    {room?.savedSources.length ? (
                      <div className="space-y-2">
                        {room.savedSources.map((source) => (
                          <button
                            key={source.artifactId}
                            type="button"
                            className="w-full rounded-2xl border border-border/60 bg-card/35 p-3 text-left transition-colors hover:border-live/50"
                            onClick={() =>
                              window.open(source.url ?? '#', '_blank', 'noreferrer')
                            }
                            disabled={!source.url}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="size-4 text-live" />
                              <span className="truncate text-sm font-semibold">
                                {source.title}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {source.snippet}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyPanel>Saved Pulse sources will appear here.</EmptyPanel>
                    )}
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">Search history</h3>
                    {room?.recentSearches.length ? (
                      <div className="space-y-2">
                        {room.recentSearches.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full rounded-2xl border border-border/60 bg-card/35 p-3 text-left transition-colors hover:border-live/50"
                            onClick={() => void openConversation(item.conversationId)}
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="size-4 text-live" />
                              <span className="line-clamp-2 text-sm">
                                {item.prompt}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.sourceCount} sources / {formatDate(item.createdAt)}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyPanel>
                        Search prompts are derived from source-backed messages
                        when available.
                      </EmptyPanel>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(actionDraft)} onOpenChange={(next) => !next && setActionDraft(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{actionDraft?.title}</DialogTitle>
            <DialogDescription>
              {actionDraft?.description} Each step may consume usage; edit the
              prompt before sending.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={actionDraft?.content ?? ''}
            onChange={(event) =>
              setActionDraft((current) =>
                current ? { ...current, content: event.target.value } : current
              )
            }
            className="min-h-72"
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActionDraft(null)}
              disabled={isSendingAction}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void runResearchAction()}
              disabled={isSendingAction || !actionDraft?.content.trim()}
            >
              {isSendingAction ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Send with Pulse
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
