'use client'

import { useCallback, useState, useRef, useEffect, useMemo } from 'react'
import { BookOpen, FileText, Images, ImagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, Attachment, MODE_CONFIGS, PendingAttachment } from '@/lib/types'
import { usePromptPrecheck } from '@/hooks/usePromptPrecheck'
import { createPendingAttachment } from '@/lib/utils/files'
import { getModeAccentClass, getModeGlow } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SendIcon, StopIcon, PaperclipIcon, XIcon } from '@/components/icons'
import { AssistantRecommendationDialog } from './assistant-recommendation-dialog'
import { AssistantRecommendationChip } from './assistant-recommendation-chip'
import { CustomAssistantButton } from './custom-assistant-button'
import { ModelComparisonButton } from './model-comparison-button'
import { ModeSwitcherCompact } from './mode-switcher'
import { PromptLibraryButton } from './prompt-library-button'
import { UsageTransparencyHint } from './usage-transparency-hint'
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
    isStreaming,
    queuedPromptCount,
    stopStreaming,
    openWorkspaceTool,
    sessionSettings,
    composerDraftRequest,
    clearComposerDraftRequest,
  } = useChatContext()
  const [value, setValue] = useState(initialValue)
  const [composerKind, setComposerKind] = useState<'chat' | 'image'>('chat')
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<Attachment | PendingAttachment>
  >([])
  const [pendingDraftClear, setPendingDraftClear] = useState<{
    value: string
    normalizedContent: string
    attachmentIds: string[]
    composerKind: 'chat' | 'image'
  } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clearDraft = useCallback(() => {
    setValue('')
    setPendingAttachments([])
    setComposerKind('chat')
    setPendingDraftClear(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [])
  const promptDraft = useMemo(
    () => ({
      content: value,
      attachments: pendingAttachments,
      kind: composerKind,
    }),
    [composerKind, pendingAttachments, value]
  )
  const {
    draftRecommendation,
    pendingRecommendation,
    recommendationOpen,
    suppressForMessage,
    setSuppressForMessage,
    precheckAndSend,
    handleUseDraftRecommendation,
    handleIgnoreDraftRecommendation,
    handleSwitchAndContinue,
    handleContinueAnyway,
    handleCancel,
  } = usePromptPrecheck({
    draft: promptDraft,
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

  useEffect(() => {
    if (!composerDraftRequest) return

    setValue(composerDraftRequest.content)
    setComposerKind(composerDraftRequest.kind)
    setPendingAttachments(composerDraftRequest.attachments ?? [])
    setPendingDraftClear(null)
    clearComposerDraftRequest(composerDraftRequest.requestId)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [clearComposerDraftRequest, composerDraftRequest])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`
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

  const handleUseRecommendation = async () => {
    const recommendedMode = await handleUseDraftRecommendation()
    if (!recommendedMode) return

    setComposerKind(recommendedMode === 'image' ? 'image' : 'chat')
    requestAnimationFrame(() => textareaRef.current?.focus())
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

  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-gradient-to-t from-background via-background/95 to-background/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-4 sm:pb-4 sm:pt-5">
      <div className="mx-auto max-w-4xl">
        {draftRecommendation ? (
          <AssistantRecommendationChip
            recommendation={draftRecommendation}
            disabled={disabled}
            onUseRecommendation={() => void handleUseRecommendation()}
            onIgnore={() => void handleIgnoreDraftRecommendation()}
          />
        ) : null}
        <UsageTransparencyHint
          mode={currentMode}
          kind={composerKind}
          content={value}
          attachments={pendingAttachments}
          settings={sessionSettings}
          disabled={disabled}
        />
        <div
          className={cn(
            'rounded-2xl border bg-card/80 backdrop-blur-sm transition-all duration-300',
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
            <div className="flex flex-wrap gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
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
              'w-full resize-none bg-transparent px-3 pb-3 pt-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground sm:px-4 sm:pt-4 sm:text-base',
              'focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[76px] max-h-[168px]'
            )}
          />

          <div className="flex flex-col gap-2 border-t border-border/60 px-2 pb-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:pb-0">
              <ModeSwitcherCompact />
              <CustomAssistantButton />
              <PromptLibraryButton
                value={value}
                currentMode={currentMode}
                disabled={disabled}
                onUsePrompt={(content) => {
                  setValue(content)
                  requestAnimationFrame(() => textareaRef.current?.focus())
                }}
              />
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={disabled}
                      onClick={() => openWorkspaceTool('playbooks')}
                    >
                      <BookOpen className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>AI Playbooks</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={disabled}
                      onClick={() => openWorkspaceTool('artifacts')}
                    >
                      <FileText className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Artifact Studio</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <ModelComparisonButton
                value={value}
                disabled={disabled || composerKind === 'image'}
                onSaved={clearDraft}
              />
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={disabled}
                      onClick={() => openWorkspaceTool('prism-studio')}
                    >
                      <Images className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Prism Studio</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

            <div className="flex shrink-0 items-center justify-end gap-2">
              {isStreaming ? (
                <>
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={(!value.trim() && pendingAttachments.length === 0) || disabled}
                    className={cn(
                      'h-9 rounded-xl px-3 text-white transition-all duration-300 disabled:opacity-50 sm:px-4',
                      getModeAccentClass(currentMode, 'bg'),
                      'hover:opacity-90',
                      getModeGlow(currentMode)
                    )}
                  >
                    <SendIcon className="size-4 sm:mr-2" />
                    <span className="hidden sm:inline">
                      Queue{queuedPromptCount > 0 ? ` (${queuedPromptCount + 1})` : ''}
                    </span>
                  </Button>
                  <Button
                    onClick={handleStop}
                    className="h-9 rounded-xl bg-destructive px-3 text-destructive-foreground hover:bg-destructive/90 sm:px-4"
                  >
                    <StopIcon className="size-4 sm:mr-2" />
                    <span className="hidden sm:inline">Stop</span>
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={(!value.trim() && pendingAttachments.length === 0) || disabled}
                  className={cn(
                    'h-9 rounded-xl px-3 text-white transition-all duration-300 disabled:opacity-50 sm:min-w-24 sm:px-4',
                    getModeAccentClass(currentMode, 'bg'),
                    `hover:opacity-90`,
                    getModeGlow(currentMode)
                  )}
                >
                  <SendIcon className="size-4 sm:mr-2" />
                  <span className="hidden sm:inline">
                    {composerKind === 'image' ? 'Create' : 'Send'}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
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
