'use client'

import { ReactNode, useCallback, useId, useState, useRef, useEffect, useMemo } from 'react'
import { ArrowUp, Globe, ImagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext, type QueuedPrompt } from '@/lib/chat-context'
import { AIMode, Attachment, MODE_CONFIGS, PendingAttachment } from '@/lib/types'
import { getModelOverrideForUsageOptimization } from '@/lib/config'
import { usePromptPrecheck } from '@/hooks/usePromptPrecheck'
import { useComposerDraft } from '@/hooks/useComposerDraft'
import { createPendingAttachment } from '@/lib/utils/files'
import { getModeAccentClass } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import { StopIcon, XIcon } from '@/components/icons'
import { AssistantRecommendationDialog } from './assistant-recommendation-dialog'
import { AssistantRecommendationChip } from './assistant-recommendation-chip'
import { AssistantPicker, ComposerToolsMenu } from './composer-controls'
import { ComposerCommandMenu, MentionChip, useComposerCommands } from './composer-command-menu'
import { ComposerQueue } from './composer-queue'
import { ComposerUsageNotice, IntelligencePicker, useComposerPlan } from './composer-usage'
import { ContextMeter } from './context-meter'
import { CustomAssistantButton } from './custom-assistant-button'
import { ModelComparisonButton } from './model-comparison-button'
import { PromptLibraryButton } from './prompt-library-button'
import { useDictation, VoiceInputButton } from './voice-input-button'

interface ComposerProps {
  onSend: (input: {
    content: string
    attachments?: Array<Attachment | PendingAttachment>
    kind?: 'chat' | 'image'
    modeOverride?: AIMode
    customAssistantId?: string | null
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
  const commands = useComposerCommands({ value, setValue, setComposerKind, textareaRef })
  const draft = useComposerDraft({ conversationId: currentChat?.id, value, setValue, textareaRef })
  const dictation = useDictation(setValue, currentChat?.id)
  const hintId = useId()
  const clearDraft = useCallback(() => {
    setValue('')
    setPendingAttachments([])
    setComposerKind('chat')
    setPendingDraftClear(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [])
  const suppressRecommendation = commands.hasTrigger || Boolean(commands.mention)
  const promptDraft = useMemo(
    () => ({
      content: suppressRecommendation ? '' : value,
      attachments: pendingAttachments,
      kind: composerKind,
    }),
    [composerKind, pendingAttachments, suppressRecommendation, value]
  )
  const markSubmitted = (normalizedContent: string) => {
    draft.discard()
    // A queued message shows in the queue, so the composer is free right away.
    if (isStreaming) {
      clearDraft()
      return
    }
    setPendingDraftClear({
      value,
      normalizedContent,
      attachmentIds: pendingAttachments.map((attachment) => attachment.id),
      composerKind,
    })
  }
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
    onSubmitted: (submission) => markSubmitted(submission.content),
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
    dictation.cancel()
    const filesPrompt = `Review these files and help me with them: ${pendingAttachments
      .map((attachment) => attachment.name)
      .join(', ')}.`
    const normalizedContent = value.trim() || filesPrompt

    setPendingDraftClear(null)

    // "/compare", "/image" and "@assistant" sends skip the assistant suggestion.
    const routed = commands.routeSubmission(pendingAttachments.length > 0)
    if (routed?.type === 'handled') return
    if (routed) {
      const content = routed.content.trim() || filesPrompt
      await onSend({
        content,
        attachments: pendingAttachments,
        kind: routed.kind,
        modeOverride: routed.modeOverride,
        customAssistantId: routed.customAssistantId,
      })
      markSubmitted(content)
      return
    }

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
    if (commands.handleKeyDown(e)) return

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

  const restoreQueuedPrompt = (prompt: QueuedPrompt) => {
    if (prompt.input.kind === 'image') setComposerKind('image')
    setPendingAttachments((previous) => [...previous, ...(prompt.input.attachments ?? [])])
    setValue(
      value.trim()
        ? `${value.trimEnd()}\n\n${prompt.input.content}`
        : commands.queuedText({ ...prompt.input, mode: prompt.mode })
    )
    requestAnimationFrame(() => textareaRef.current?.focus())
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
        <ComposerQueue onEdit={restoreQueuedPrompt} />
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
          <ComposerCommandMenu commands={commands} />
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

          {commands.mention ? (
            <MentionChip target={commands.mention.target} onRemove={commands.removeMention} />
          ) : null}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => commands.handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={commands.handleFocus}
            onBlur={commands.handleBlur}
            aria-controls={commands.isOpen ? commands.menuId : undefined}
            aria-activedescendant={commands.activeOptionId}
            aria-autocomplete="list"
            aria-describedby={hintId}
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
                <ContextMeter plan={plan} draft={value} attachments={pendingAttachments} />
              ) : null}
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
              <VoiceInputButton dictation={dictation} draft={value} disabled={disabled} />
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

        <p id={hintId} className="mt-1.5 hidden px-1 text-[11px] text-muted-foreground/70 sm:block">
          Type / for commands and @ for assistants
        </p>

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
