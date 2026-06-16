'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Copy,
  FileText,
  Heart,
  ImageIcon,
  Loader2,
  Megaphone,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import {
  PrismStudioImage,
  PrismStudioQuickAction,
} from '@/types'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FeedbackButtons } from './feedback-buttons'

const PROJECT_FILTER_ALL = 'all'

interface ActionDraft {
  type: PrismStudioQuickAction | 'remix'
  title: string
  description: string
  content: string
  route: 'image' | 'text' | 'draft'
  image: PrismStudioImage
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function imageTitle(image: PrismStudioImage) {
  const title = image.prompt.replace(/\s+/g, ' ').trim()
  return title.length > 84 ? `${title.slice(0, 81).trimEnd()}...` : title
}

function projectName(projects: ReturnType<typeof useChatContext>['projects'], projectId?: string | null) {
  if (!projectId) return 'No project'
  return projects.find((project) => project.id === projectId)?.name ?? projectId
}

function buildActionDraft(
  type: PrismStudioQuickAction | 'remix',
  image: PrismStudioImage
): ActionDraft {
  switch (type) {
    case 'generate_more':
      return {
        type,
        title: 'Generate 4 more like this',
        description:
          'This will queue four normal Prism image generations and may consume image credits for each one.',
        route: 'image',
        image,
        content: `Create a polished new variation of this Prism prompt. Keep the core subject and style, but vary composition, lighting, palette, and camera angle.\n\nOriginal prompt:\n${image.prompt}`,
      }
    case 'ad_concept':
      return {
        type,
        title: 'Turn into an ad concept',
        description: 'Send a Velora prompt through normal text chat.',
        route: 'text',
        image,
        content: `Turn this image prompt into a concise advertising concept. Include the campaign angle, target audience, headline, supporting copy, and recommended channel.\n\nImage prompt:\n${image.prompt}`,
      }
    case 'matching_caption':
      return {
        type,
        title: 'Generate matching caption',
        description: 'Use Velora to write caption options through normal text chat.',
        route: 'text',
        image,
        content: `Write five polished captions that would match this Prism image concept. Vary tone across premium, playful, direct, social-first, and editorial.\n\nImage prompt:\n${image.prompt}`,
      }
    case 'campaign_idea':
      return {
        type,
        title: 'Create campaign idea',
        description: 'Use Velora to turn the image prompt into a campaign direction.',
        route: 'text',
        image,
        content: `Build a compact campaign idea from this image prompt. Include concept name, visual system, three content pieces, and one next-step checklist.\n\nImage prompt:\n${image.prompt}`,
      }
    case 'remix':
      return {
        type,
        title: 'Remix prompt',
        description: 'Edit the prompt, then place it into the Prism composer without sending.',
        route: 'draft',
        image,
        content: `Remix this concept with a fresh composition while keeping the original intent:\n\n${image.prompt}`,
      }
  }
}

export function PrismStudio() {
  const {
    projects,
    selectedProjectId,
    workspaceToolRequest,
    clearWorkspaceToolRequest,
    listPrismImages,
    updatePrismImage,
    prepareComposerDraft,
    sendMessage,
    saveArtifact,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<PrismStudioImage[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>(PROJECT_FILTER_ALL)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null)
  const [isRunningAction, setIsRunningAction] = useState(false)

  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedImageId) ?? images[0] ?? null,
    [images, selectedImageId]
  )

  const loadImages = useCallback(async () => {
    if (!open) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await listPrismImages({
        q: query.trim() || undefined,
        projectId:
          projectFilter === PROJECT_FILTER_ALL ? null : projectFilter,
        favorite: favoritesOnly ? true : null,
        from: fromDate || null,
        to: toDate || null,
      })
      setImages(response.items)
      setSelectedImageId((current) =>
        current && response.items.some((image) => image.id === current)
          ? current
          : response.items[0]?.id ?? null
      )
    } catch (loadError) {
      setImages([])
      setSelectedImageId(null)
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load Prism Studio.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [
    favoritesOnly,
    fromDate,
    listPrismImages,
    open,
    projectFilter,
    query,
    toDate,
  ])

  useEffect(() => {
    if (workspaceToolRequest?.tool !== 'prism-studio') return

    setOpen(true)
    setSelectedImageId(workspaceToolRequest.imageId ?? null)
    setProjectFilter(
      workspaceToolRequest.projectId ??
        (selectedProjectId === 'all' ? PROJECT_FILTER_ALL : selectedProjectId)
    )
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [
    clearWorkspaceToolRequest,
    selectedProjectId,
    workspaceToolRequest,
  ])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => {
      void loadImages()
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [loadImages, open])

  const updateImageInList = (image: PrismStudioImage) => {
    setImages((previous) =>
      previous.map((item) => (item.id === image.id ? image : item))
    )
    setSelectedImageId(image.id)
  }

  const toggleFavorite = async (image: PrismStudioImage) => {
    const updated = await updatePrismImage(image.id, {
      isFavorite: !image.isFavorite,
    })
    if (updated) {
      updateImageInList(updated)
    }
  }

  const copyPrompt = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt)
    setNotice('Prompt copied.')
  }

  const reusePrompt = (image: PrismStudioImage) => {
    prepareComposerDraft({
      content: image.prompt,
      kind: 'image',
      mode: 'image',
      projectId: image.projectId,
    })
    setOpen(false)
  }

  const savePromptAsArtifact = async (image: PrismStudioImage) => {
    const artifact = await saveArtifact({
      title: `Prism prompt - ${formatDate(image.createdAt)}`,
      content: image.prompt,
      artifactType: 'image_prompt',
      sourceType: 'prism_prompt',
      projectId: image.projectId,
      conversationId: image.conversationId,
      sourceMessageId: image.messageId,
      metadata: {
        source: 'prism_studio',
        imageId: image.id,
        model: image.model,
        status: image.status,
        isFavorite: image.isFavorite,
      },
    })

    if (artifact) {
      setNotice('Saved as an Artifact.')
    }
  }

  const runActionDraft = async () => {
    if (!actionDraft) return
    setIsRunningAction(true)

    try {
      if (actionDraft.route === 'draft') {
        prepareComposerDraft({
          content: actionDraft.content,
          kind: 'image',
          mode: 'image',
          projectId: actionDraft.image.projectId,
        })
        setActionDraft(null)
        setOpen(false)
        return
      }

      if (actionDraft.route === 'image') {
        for (let index = 0; index < 4; index += 1) {
          await sendMessage({
            content: `${actionDraft.content}\n\nVariation ${index + 1} of 4.`,
            kind: 'image',
            modeOverride: 'image',
            customAssistantId: null,
          })
        }
        setNotice('Queued four Prism generations.')
      } else {
        await sendMessage({
          content: actionDraft.content,
          kind: 'chat',
          modeOverride: 'creative',
          customAssistantId: null,
        })
        setNotice('Sent to Velora.')
      }

      setActionDraft(null)
      setOpen(false)
    } finally {
      setIsRunningAction(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[86vh] max-w-6xl flex-col overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/70 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <ImageIcon className="size-5 text-primary" />
                  Prism Studio
                </DialogTitle>
                <DialogDescription>
                  Browse generated images, favorite strong concepts, and reuse prompts without leaving the workspace.
                </DialogDescription>
              </div>
              <Badge variant="secondary" className="w-fit rounded-xl">
                {images.length} image{images.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-h-0 flex-col border-r border-border/60">
              <div className="grid gap-3 border-b border-border/60 p-4 md:grid-cols-[minmax(0,1fr)_180px_132px_132px_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search prompts or models..."
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
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  aria-label="From date"
                />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  aria-label="To date"
                />
                <label className="flex items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-xs text-muted-foreground">
                  <Switch
                    checked={favoritesOnly}
                    onCheckedChange={setFavoritesOnly}
                  />
                  Favorites
                </label>
              </div>

              {notice ? (
                <div className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
                  {notice}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setNotice(null)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : null}

              <ScrollArea className="min-h-0 flex-1">
                <div className="p-4">
                  {isLoading ? (
                    <div className="flex min-h-64 items-center justify-center rounded-2xl border border-border/60 bg-card/30 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Loading Prism images...
                    </div>
                  ) : error ? (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
                      {error}
                    </div>
                  ) : images.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/25 p-6 text-center">
                      <Sparkles className="mb-3 size-8 text-muted-foreground" />
                      <p className="text-sm font-medium">No Prism images found.</p>
                      <p className="mt-1 max-w-md text-xs text-muted-foreground">
                        Generate images with Prism, then use Studio to favorite, reuse, remix, and save prompt directions.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {images.map((image) => (
                        <button
                          key={image.id}
                          type="button"
                          className={cn(
                            'group overflow-hidden rounded-2xl border bg-card/35 text-left transition hover:border-primary/50',
                            selectedImage?.id === image.id
                              ? 'border-primary/70 shadow-lg shadow-primary/10'
                              : 'border-border/60'
                          )}
                          onClick={() => setSelectedImageId(image.id)}
                        >
                          <div
                            className="aspect-square bg-muted/50 bg-cover bg-center"
                            style={{
                              backgroundImage: image.url
                                ? `url("${image.url}")`
                                : undefined,
                            }}
                          >
                            {!image.url ? (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                Preview unavailable
                              </div>
                            ) : null}
                          </div>
                          <div className="space-y-2 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-medium">
                                {imageTitle(image)}
                              </p>
                              <Heart
                                className={cn(
                                  'mt-0.5 size-4 shrink-0',
                                  image.isFavorite
                                    ? 'fill-primary text-primary'
                                    : 'text-muted-foreground'
                                )}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {projectName(projects, image.projectId)} · {formatDate(image.createdAt)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <aside className="flex min-h-0 flex-col bg-card/25">
              {selectedImage ? (
                <>
                  <div className="space-y-4 border-b border-border/60 p-4">
                    <div
                      className="aspect-square rounded-2xl border border-border/60 bg-muted/50 bg-cover bg-center"
                      style={{
                        backgroundImage: selectedImage.url
                          ? `url("${selectedImage.url}")`
                          : undefined,
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{selectedImage.status}</Badge>
                        <Badge variant="secondary">
                          {projectName(projects, selectedImage.projectId)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {selectedImage.model} · {formatDate(selectedImage.createdAt)}
                      </p>
                    </div>
                  </div>

                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-4 p-4">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Prompt
                        </p>
                        <p className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm leading-relaxed">
                          {selectedImage.prompt}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Button
                          type="button"
                          variant={selectedImage.isFavorite ? 'secondary' : 'outline'}
                          onClick={() => void toggleFavorite(selectedImage)}
                        >
                          <Heart
                            className={cn(
                              'mr-2 size-4',
                              selectedImage.isFavorite && 'fill-current'
                            )}
                          />
                          {selectedImage.isFavorite ? 'Favorited' : 'Favorite'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void copyPrompt(selectedImage.prompt)}
                        >
                          <Copy className="mr-2 size-4" />
                          Copy prompt
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => reusePrompt(selectedImage)}
                        >
                          <Send className="mr-2 size-4" />
                          Reuse in Prism
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setActionDraft(buildActionDraft('remix', selectedImage))
                          }
                        >
                          <Wand2 className="mr-2 size-4" />
                          Remix prompt
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void savePromptAsArtifact(selectedImage)}
                        >
                          <FileText className="mr-2 size-4" />
                          Save prompt as Artifact
                        </Button>
                      </div>

                      <FeedbackButtons
                        entityType="image_generation"
                        entityId={selectedImage.id}
                        metadata={{
                          model: selectedImage.model,
                          status: selectedImage.status,
                          projectId: selectedImage.projectId,
                          conversationId: selectedImage.conversationId,
                        }}
                        allowNeutral
                      />

                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Creative actions
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full justify-start"
                          onClick={() =>
                            setActionDraft(
                              buildActionDraft('generate_more', selectedImage)
                            )
                          }
                        >
                          <RefreshCcw className="mr-2 size-4" />
                          Generate 4 more like this
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() =>
                            setActionDraft(buildActionDraft('ad_concept', selectedImage))
                          }
                        >
                          <Megaphone className="mr-2 size-4" />
                          Turn into an ad concept
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() =>
                            setActionDraft(
                              buildActionDraft('matching_caption', selectedImage)
                            )
                          }
                        >
                          <Sparkles className="mr-2 size-4" />
                          Generate matching caption
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() =>
                            setActionDraft(
                              buildActionDraft('campaign_idea', selectedImage)
                            )
                          }
                        >
                          <Megaphone className="mr-2 size-4" />
                          Create campaign idea
                        </Button>
                      </div>
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="flex min-h-64 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  Select a Prism image to inspect its prompt and actions.
                </div>
              )}
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(actionDraft)} onOpenChange={(nextOpen) => !nextOpen && setActionDraft(null)}>
        <DialogContent className="max-w-2xl border-border/70 bg-background/95">
          {actionDraft ? (
            <>
              <DialogHeader>
                <DialogTitle>{actionDraft.title}</DialogTitle>
                <DialogDescription>{actionDraft.description}</DialogDescription>
              </DialogHeader>
              <Textarea
                value={actionDraft.content}
                onChange={(event) =>
                  setActionDraft({
                    ...actionDraft,
                    content: event.target.value,
                  })
                }
                rows={10}
                className="resize-none"
              />
              <div className="rounded-xl border border-border/60 bg-card/45 px-3 py-2 text-xs text-muted-foreground">
                {actionDraft.route === 'image'
                  ? 'Prism image generations use image credits and the existing image route.'
                  : actionDraft.route === 'text'
                    ? 'Velora text actions use the existing chat route and may consume text usage.'
                    : 'This only prepares the Prism composer draft and does not call AI.'}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionDraft(null)}
                  disabled={isRunningAction}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void runActionDraft()}
                  disabled={isRunningAction || !actionDraft.content.trim()}
                >
                  {isRunningAction ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 size-4" />
                  )}
                  {actionDraft.route === 'draft'
                    ? 'Use in Prism'
                    : actionDraft.route === 'image'
                      ? 'Generate'
                      : 'Send to Velora'}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
