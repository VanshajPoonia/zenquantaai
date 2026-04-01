'use client'

import { useState, useRef, useEffect } from 'react'
import { BookText, BookmarkPlus, ImagePlus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, Attachment, MODE_CONFIGS, PendingAttachment } from '@/lib/types'
import { usePromptPrecheck } from '@/hooks/usePromptPrecheck'
import { createPendingAttachment } from '@/lib/utils/files'
import { getModeAccentClass, getModeGlow } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SendIcon, StopIcon, PaperclipIcon, XIcon } from '@/components/icons'
import { AssistantRecommendationDialog } from './assistant-recommendation-dialog'
import { ModeSwitcherCompact } from './mode-switcher'
interface ComposerProps {
  onSend: (input: {
    content: string
    attachments?: Array<Attachment | PendingAttachment>
    kind?: 'chat' | 'image'
    modeOverride?: AIMode
  }) => Promise<void>
  disabled?: boolean
  initialValue?: string
}

export function Composer({ onSend, disabled, initialValue = '' }: ComposerProps) {
  const {
    currentMode,
    currentChat,
    promptLibrary,
    savePrompt,
    deletePrompt,
    isStreaming,
    queuedPromptCount,
    stopStreaming,
  } = useChatContext()
  const [value, setValue] = useState(initialValue)
  const [composerKind, setComposerKind] = useState<'chat' | 'image'>('chat')
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [pendingDraftClear, setPendingDraftClear] = useState<{
    value: string
    normalizedContent: string
    attachmentIds: string[]
    composerKind: 'chat' | 'image'
  } | null>(null)
  const [promptTitle, setPromptTitle] = useState('')
  const [isPromptPopoverOpen, setIsPromptPopoverOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clearDraft = () => {
    setValue('')
    setPendingAttachments([])
    setComposerKind('chat')
    setPendingDraftClear(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }
  const {
    pendingRecommendation,
    recommendationOpen,
    suppressForMessage,
    setSuppressForMessage,
    precheckAndSend,
    handleSwitchAndContinue,
    handleContinueAnyway,
    handleCancel,
  } = usePromptPrecheck({
    onContinue: onSend,
    onSubmitted: (submission) => {
      setPendingDraftClear({
        value,
        normalizedContent: submission.content,
        attachmentIds: pendingAttachments.map((attachment) => attachment.id),
        composerKind,
      })
    },
  })

  const modeConfig = MODE_CONFIGS[currentMode]

  // Update value when initialValue changes (e.g., from suggested prompt)
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue)
      textareaRef.current?.focus()
    }
  }, [initialValue])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [value])

  useEffect(() => {
    if (!pendingDraftClear) return

    const matchingUserMessage = [...(currentChat?.messages ?? [])]
      .reverse()
      .find(
        (message) =>
          message.role === 'user' &&
          message.content.trim() === pendingDraftClear.normalizedContent.trim()
      )

    if (!matchingUserMessage) {
      return
    }

    const attachmentIdsMatch =
      pendingAttachments.length === pendingDraftClear.attachmentIds.length &&
      pendingAttachments.every(
        (attachment, index) => attachment.id === pendingDraftClear.attachmentIds[index]
      )

    const draftStillMatches =
      value === pendingDraftClear.value &&
      composerKind === pendingDraftClear.composerKind &&
      attachmentIdsMatch

    if (!draftStillMatches) {
      setPendingDraftClear(null)
      return
    }

    clearDraft()
  }, [clearDraft, composerKind, currentChat?.messages, pendingAttachments, pendingDraftClear, value])

  const handleSubmit = async () => {
    if ((!value.trim() && pendingAttachments.length === 0) || disabled) return
    const normalizedContent =
      value.trim() ||
      `Review these files and help me with them: ${pendingAttachments
        .map((attachment) => attachment.name)
        .join(', ')}.`

    setPendingDraftClear(null)

    await precheckAndSend({
      content: normalizedContent,
      attachments: pendingAttachments,
      kind: composerKind,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSubmit()
      return
    }

    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const handleStop = () => {
    stopStreaming()
  }

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    const nextAttachments = await Promise.all(files.map(createPendingAttachment))
    setPendingAttachments((previous) => [...previous, ...nextAttachments])
    event.target.value = ''
  }

  const visiblePrompts = promptLibrary.filter(
    (prompt) => prompt.mode === 'any' || prompt.mode === currentMode
  )

  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-gradient-to-t from-background via-background/95 to-background/70 backdrop-blur-xl px-4 pb-4 pt-6">
      <div className="max-w-4xl mx-auto">
        <div
          className={cn(
            'relative rounded-2xl border bg-card/80 backdrop-blur-sm transition-all duration-300',
            'focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-background',
            'focus-within:border-opacity-50',
            getModeAccentClass(currentMode, 'ring').replace('ring-', 'focus-within:ring-') + '/50',
            getModeAccentClass(currentMode, 'border').replace('border-', 'focus-within:border-') + '/50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.mdx,.json,.csv,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.css,.scss,.html,.py,.go,.java,.rb,.rs,.sql"
            className="hidden"
            onChange={handleFilesSelected}
          />

          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-4">
              {pendingAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {attachment.kind}
                      {attachment.isExtracted ? ' • text ready' : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 shrink-0"
                    onClick={() =>
                      setPendingAttachments((previous) =>
                        previous.filter((item) => item.id !== attachment.id)
                      )
                    }
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              composerKind === 'image'
                ? 'Describe the image you want to create...'
                : modeConfig.placeholder
            }
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-4 pt-4 pb-14 text-foreground placeholder:text-muted-foreground',
              'focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[60px] max-h-[200px]'
            )}
          />

          {/* Bottom Bar */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            {/* Left Actions */}
            <div className="flex items-center gap-2">
              <ModeSwitcherCompact />
              <Popover
                open={isPromptPopoverOpen}
                onOpenChange={setIsPromptPopoverOpen}
              >
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground"
                          disabled={disabled}
                        >
                          <BookText className="size-4" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Prompt Library</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <PopoverContent
                  align="start"
                  className="w-[360px] rounded-2xl border-border/70 bg-background/95 p-4"
                >
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Prompt Library
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Save reusable prompts and inject them into this chat.
                      </p>
                    </div>

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
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-7 shrink-0"
                                onClick={() => deletePrompt(prompt.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3 w-full rounded-xl"
                              onClick={() => {
                                setValue(prompt.content)
                                setIsPromptPopoverOpen(false)
                                requestAnimationFrame(() => textareaRef.current?.focus())
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
                  </div>
                </PopoverContent>
              </Popover>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={disabled}
                      onClick={handleOpenFilePicker}
                    >
                      <PaperclipIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach files, PDFs, or images</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={composerKind === 'image' ? 'secondary' : 'ghost'}
                      size="icon-sm"
                      className={cn(
                        'text-muted-foreground hover:text-foreground',
                        composerKind === 'image' &&
                          `${getModeAccentClass(currentMode, 'text')} ${getModeGlow(currentMode)}`
                      )}
                      disabled={disabled}
                      onClick={() =>
                        setComposerKind((previous) =>
                          previous === 'image' ? 'chat' : 'image'
                        )
                      }
                    >
                      <ImagePlus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {composerKind === 'image'
                      ? 'Switch back to chat'
                      : 'Create an image from your prompt'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {isStreaming ? (
                <>
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={(!value.trim() && pendingAttachments.length === 0) || disabled}
                    className={cn(
                      'transition-all duration-300 text-white disabled:opacity-50',
                      getModeAccentClass(currentMode, 'bg'),
                      'hover:opacity-90',
                      getModeGlow(currentMode)
                    )}
                  >
                    <SendIcon className="size-4 mr-2" />
                    Queue
                    {queuedPromptCount > 0 ? ` (${queuedPromptCount + 1})` : ''}
                  </Button>
                  <Button
                    onClick={handleStop}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    <StopIcon className="size-4 mr-2" />
                    Stop
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={(!value.trim() && pendingAttachments.length === 0) || disabled}
                  className={cn(
                    'transition-all duration-300 text-white disabled:opacity-50',
                    getModeAccentClass(currentMode, 'bg'),
                    `hover:opacity-90`,
                    getModeGlow(currentMode)
                  )}
                >
                  <SendIcon className="size-4 mr-2" />
                  {composerKind === 'image' ? 'Create' : 'Send'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground text-center mt-3">
          {composerKind === 'image' ? (
            <>
              Image mode generates a richer, more production-ready visual from your prompt.
            </>
          ) : null}
          {composerKind === 'image' ? ' ' : null}
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Enter</kbd> to send,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Shift + Enter</kbd> for new line,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Ctrl/Cmd + Enter</kbd> to send from anywhere in the draft
          {queuedPromptCount > 0 ? ` • ${queuedPromptCount} queued` : ''}
        </p>
      </div>

      <AssistantRecommendationDialog
        open={recommendationOpen}
        recommendation={pendingRecommendation}
        suppressForMessage={suppressForMessage}
        onSuppressForMessageChange={setSuppressForMessage}
        onSwitchAndContinue={() => void handleSwitchAndContinue()}
        onContinueAnyway={() => void handleContinueAnyway()}
        onCancel={() => void handleCancel()}
        onOpenChange={(open) => {
          if (!open) {
            void handleCancel()
          }
        }}
      />
    </div>
  )
}
