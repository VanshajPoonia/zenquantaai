'use client'

import { ReactNode, useCallback, useState, useRef, useEffect, useMemo } from 'react'
import { ArrowUp, Globe, ImagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, Attachment, MODE_CONFIGS, PendingAttachment } from '@/lib/types'
import { getModelOverrideForUsageOptimization } from '@/lib/config'
import { usePromptPrecheck } from '@/hooks/usePromptPrecheck'
import { createPendingAttachment } from '@/lib/utils/files'
import { getModeAccentClass } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import { StopIcon, XIcon } from '@/components/icons'
import { AssistantRecommendationDialog } from './assistant-recommendation-dialog'
import { AssistantRecommendationChip } from './assistant-recommendation-chip'
import { AssistantPicker, ComposerToolsMenu } from './composer-controls'
import { ComposerUsageNotice, IntelligencePicker, useComposerPlan } from './composer-usage'
import { CustomAssistantButton } from './custom-assistant-button'
import { ModelComparisonButton } from './model-comparison-button'
import { PromptLibraryButton } from './prompt-library-button'

interface ComposerProps {
  onSend: (input: {
    content: string
    attachments?: Array<Attachment | PendingAttachment>
    kind?: 'chat' | 'image'
    modeOverride?: AIMode
  }) => Promise<void>
  disabled?: boolean
  initialValue?: string
  onOpenAssistantHelp?: () => void
}

function ActiveToolChip({
  icon,
  label,
  removeLabel,
  onRemove,
}: {
  icon: ReactNode
  label: string
  removeLabel: string
  onRemove: () => void
}) {
  return (
    <span className="animate-arrive inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/[0.06] pl-2.5 pr-1 text-[12px] font-medium text-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.06)]">
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <button
        type="button"
        aria-label={removeLabel}
        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
        onClick={onRemove}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  )
}

export function Composer({
  onSend,
  disabled,
  initialValue = '',
  onOpenAssistantHelp,
}: ComposerProps) {
  const {
    currentMode,
    currentChat,
    isStreaming,
    queuedPromptCount,
    stopStreaming,
    openWorkspaceTool,
    sessionSettings,
    updateSessionSettings,
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
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const plan = useComposerPlan()
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

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return
    const nextAttachments = await Promise.all(files.map(createPendingAttachment))
    setPendingAttachments((previous) => [...previous, ...nextAttachments])
  }

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await addFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    void addFiles(files)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingFiles(false)
    if (disabled) return
    void addFiles(Array.from(event.dataTransfer.files))
  }

  const hasDraft = Boolean(value.trim()) || pendingAttachments.length > 0
  const canSend = hasDraft && !disabled
  const isImageDraft = composerKind === 'image'
  const showSearchChip =
    !isImageDraft && sessionSettings.webSearch && currentMode !== 'live' && currentMode !== 'image'

  return (
    <div className="sticky bottom-0 z-20 bg-gradient-to-t from-background via-background to-background/0 px-3 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
      <div className="mx-auto max-w-3xl">
        {draftRecommendation ? (
          <AssistantRecommendationChip
            recommendation={draftRecommendation}
            disabled={disabled}
            onUseRecommendation={() => void handleUseRecommendation()}
            onIgnore={() => void handleIgnoreDraftRecommendation()}
          />
        ) : null}
        <ComposerUsageNotice
          plan={plan}
          mode={currentMode}
          kind={composerKind}
          content={value}
          attachments={pendingAttachments}
          settings={sessionSettings}
        />
        <div
          data-busy={isStreaming ? '' : undefined}
          style={{ '--mode': `var(--${currentMode})` } as React.CSSProperties}
          className={cn(
            'composer-card relative rounded-2xl border border-white/[0.09] bg-card shadow-[0_1px_0_rgb(255_255_255_/_0.04)_inset,0_16px_40px_-20px_rgb(0_0_0_/_0.9)] transition-[border-color,box-shadow] duration-200',
            'focus-within:border-[color-mix(in_oklab,var(--mode)_45%,transparent)] focus-within:shadow-[0_1px_0_rgb(255_255_255_/_0.04)_inset,0_0_0_4px_color-mix(in_oklab,var(--mode)_10%,transparent),0_16px_40px_-20px_rgb(0_0_0_/_0.9)]',
            isDraggingFiles && 'border-dashed border-foreground/40 bg-card/80'
          )}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes('Files')) return
            event.preventDefault()
            setIsDraggingFiles(true)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            setIsDraggingFiles(false)
          }}
          onDrop={handleDrop}
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
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {pendingAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="animate-arrive flex max-w-full items-center gap-2 rounded-lg border border-border bg-white/[0.03] py-1.5 pr-1.5 pl-3 text-[13px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {attachment.kind}
                      {attachment.isExtracted ? ' · text ready' : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 shrink-0"
                    aria-label={`Remove ${attachment.name}`}
                    onClick={() =>
                      setPendingAttachments((previous) =>
                        previous.filter((item) => item.id !== attachment.id)
                      )
                    }
                  >
                    <XIcon className="size-3.5" />
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
            onPaste={handlePaste}
            aria-label={isImageDraft ? 'Describe the image' : 'Message'}
            enterKeyHint="send"
            placeholder={
              isImageDraft
                ? 'Describe the image you want to create'
                : modeConfig.placeholder
            }
            disabled={disabled}
            rows={1}
            className={cn(
              'block w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground/80',
              'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
              'min-h-[56px] max-h-[200px]'
            )}
          />

          <div className="flex items-center gap-1 px-2 pb-2">
            <div className="relative shrink-0">
              <ComposerToolsMenu
                disabled={disabled}
                hasDraftText={Boolean(value.trim())}
                isImageMode={isImageDraft}
                onAttachFiles={handleOpenFilePicker}
                onToggleImageMode={() =>
                  setComposerKind((previous) => (previous === 'image' ? 'chat' : 'image'))
                }
                onOpenPromptLibrary={() => openWorkspaceTool('prompt-library')}
              />
              <PromptLibraryButton
                hideTrigger
                value={value}
                currentMode={currentMode}
                disabled={disabled}
                onUsePrompt={(content) => {
                  setValue(content)
                  requestAnimationFrame(() => textareaRef.current?.focus())
                }}
              />
            </div>
            <AssistantPicker
              disabled={disabled}
              onOpenAssistantHelp={onOpenAssistantHelp}
            />
            {isImageDraft ? (
              <ActiveToolChip
                icon={<ImagePlus className="size-3.5" />}
                label="Image"
                removeLabel="Turn off image creation"
                onRemove={() => setComposerKind('chat')}
              />
            ) : null}
            {showSearchChip ? (
              <ActiveToolChip
                icon={<Globe className="size-3.5" />}
                label="Search"
                removeLabel="Turn off web search"
                onRemove={() => updateSessionSettings({ webSearch: false })}
              />
            ) : null}

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {!isImageDraft && currentMode !== 'image' ? (
                <IntelligencePicker
                  plan={plan}
                  mode={currentMode}
                  settings={sessionSettings}
                  disabled={disabled}
                  onChange={(intelligenceLevel) =>
                    updateSessionSettings({
                      modelOverride: getModelOverrideForUsageOptimization(intelligenceLevel),
                    })
                  }
                />
              ) : null}
              {isStreaming ? (
                <>
                  {hasDraft ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full px-3 text-[12.5px]"
                      disabled={!canSend}
                      onClick={() => void handleSubmit()}
                    >
                      Queue{queuedPromptCount > 0 ? ` (${queuedPromptCount + 1})` : ''}
                    </Button>
                  ) : queuedPromptCount > 0 ? (
                    <span className="px-2 text-xs text-muted-foreground">
                      {queuedPromptCount} queued
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    aria-label="Stop generating"
                    className="size-8 rounded-full bg-foreground text-background hover:bg-foreground/90"
                    onClick={handleStop}
                  >
                    <StopIcon className="size-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  aria-label={isImageDraft ? 'Create image' : 'Send message'}
                  disabled={!canSend}
                  onClick={() => void handleSubmit()}
                  className={cn(
                    'size-8 rounded-full text-black transition-[opacity,transform,background-color] duration-200 hover:opacity-90 active:scale-95 disabled:bg-white/[0.08] disabled:text-muted-foreground disabled:opacity-100',
                    getModeAccentClass(currentMode, 'bg')
                  )}
                >
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <ModelComparisonButton
          hideTrigger
          value={value}
          disabled={disabled || isImageDraft}
          onSaved={clearDraft}
        />
        <CustomAssistantButton hideTrigger />
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
