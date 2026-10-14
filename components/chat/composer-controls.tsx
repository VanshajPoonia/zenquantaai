'use client'

import { ReactNode, useRef, useTransition } from 'react'
import {
  BookOpen,
  BookText,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  FileSearch,
  GitCompareArrows,
  Globe,
  ImagePlus,
  Images,
  Layers,
  Paperclip,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, MODE_CONFIGS, MODE_ORDER } from '@/lib/types'
import { ModeIcon, getModeAccentClass } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Short, plain-language roles for the picker. The longer helper text lives
// in the assistant guide.
export const ASSISTANT_ROLES: Record<AIMode, string> = {
  general: 'Everyday questions, plans and summaries',
  creative: 'Writing, voice and ideas',
  logic: 'Reasoning, comparisons and decisions',
  code: 'Code, debugging and architecture',
  live: 'Current events and web research',
  image: 'Image generation',
}

export function AssistantPicker({
  disabled,
  onOpenAssistantHelp,
}: {
  disabled?: boolean
  onOpenAssistantHelp?: () => void
}) {
  const {
    currentMode,
    setCurrentMode,
    customAssistants,
    currentCustomAssistantId,
    setCurrentCustomAssistant,
    openWorkspaceTool,
  } = useChatContext()
  const [, startTransition] = useTransition()
  const enabledCustomAssistants = customAssistants.filter((assistant) => assistant.isEnabled)
  const activeCustomAssistant =
    enabledCustomAssistants.find((assistant) => assistant.id === currentCustomAssistantId) ??
    null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={`Assistant: ${activeCustomAssistant?.name ?? MODE_CONFIGS[currentMode].name}`}
          className={cn(
            'h-9 min-w-0 gap-1.5 rounded-full px-2.5 text-sm font-medium',
            getModeAccentClass(currentMode, 'text')
          )}
        >
          {activeCustomAssistant ? (
            <span aria-hidden className="text-sm leading-none">
              {activeCustomAssistant.iconEmoji}
            </span>
          ) : (
            <ModeIcon mode={currentMode} size="sm" />
          )}
          <span className="max-w-[9rem] truncate text-foreground">
            {activeCustomAssistant?.name ?? MODE_CONFIGS[currentMode].name}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-80">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Assistant
        </DropdownMenuLabel>
        {MODE_ORDER.map((mode) => {
          const isSelected = !activeCustomAssistant && mode === currentMode

          return (
            <DropdownMenuItem
              key={mode}
              className="items-start gap-3 py-2"
              onSelect={() => startTransition(() => setCurrentMode(mode))}
            >
              <span className={cn('mt-0.5 inline-flex', getModeAccentClass(mode, 'text'))}>
                <ModeIcon mode={mode} size="sm" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{MODE_CONFIGS[mode].name}</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {ASSISTANT_ROLES[mode]}
                </span>
              </span>
              {isSelected ? <Check className="mt-0.5 size-4 shrink-0" /> : null}
            </DropdownMenuItem>
          )
        })}

        {enabledCustomAssistants.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Your assistants
            </DropdownMenuLabel>
            {enabledCustomAssistants.map((assistant) => (
              <DropdownMenuItem
                key={assistant.id}
                className="items-start gap-3 py-2"
                onSelect={() => setCurrentCustomAssistant(assistant.id)}
              >
                <span aria-hidden className="mt-0.5 w-4 text-center text-sm leading-5">
                  {assistant.iconEmoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{assistant.name}</span>
                  <span className="block text-xs leading-5 text-muted-foreground">
                    Built on {MODE_CONFIGS[assistant.baseMode].name}
                  </span>
                </span>
                {assistant.id === activeCustomAssistant?.id ? (
                  <Check className="mt-0.5 size-4 shrink-0" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openWorkspaceTool('custom-assistants')}>
          <Bot className="size-4" />
          {enabledCustomAssistants.length > 0
            ? 'Manage your assistants'
            : 'Create your own assistant'}
        </DropdownMenuItem>
        {onOpenAssistantHelp ? (
          <DropdownMenuItem onSelect={onOpenAssistantHelp}>
            <CircleHelp className="size-4" />
            Which assistant should I use?
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// A menu row that flips a setting and keeps the menu open, so several tools
// can be switched on in one visit.
function ToggleItem({
  icon,
  label,
  checked,
  disabled,
  note,
  onToggle,
}: {
  icon: ReactNode
  label: string
  checked: boolean
  disabled?: boolean
  note?: string
  onToggle: () => void
}) {
  return (
    <DropdownMenuItem
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onSelect={(event) => {
        event.preventDefault()
        onToggle()
      }}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {note ? <span className="text-[11px] text-muted-foreground">{note}</span> : null}
      {checked && !note ? <Check className="size-4" /> : null}
    </DropdownMenuItem>
  )
}

interface ComposerToolsMenuProps {
  disabled?: boolean
  hasDraftText: boolean
  isImageMode: boolean
  onAttachFiles: () => void
  onToggleImageMode: () => void
  onOpenPromptLibrary: () => void
}

export function ComposerToolsMenu({
  disabled,
  hasDraftText,
  isImageMode,
  onAttachFiles,
  onToggleImageMode,
  onOpenPromptLibrary,
}: ComposerToolsMenuProps) {
  const {
    currentMode,
    sessionSettings,
    updateSessionSettings,
    openWorkspaceTool,
    toggleSettingsPanel,
  } = useChatContext()
  // The prompt library is a popover anchored here. Opening it while this menu
  // is still closing makes it dismiss itself, so it opens once the menu is gone.
  const afterCloseRef = useRef<(() => void) | null>(null)
  const searchAlwaysOn = currentMode === 'live'
  const textOnlyOptionsDisabled = isImageMode || currentMode === 'image'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label="Add files and tools"
          className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-72"
        onCloseAutoFocus={(event) => {
          const afterClose = afterCloseRef.current
          if (!afterClose) return
          afterCloseRef.current = null
          event.preventDefault()
          afterClose()
        }}
      >
        <DropdownMenuItem onSelect={onAttachFiles}>
          <Paperclip className="size-4" />
          Attach files or images
        </DropdownMenuItem>
        <ToggleItem
          icon={<ImagePlus className="size-4" />}
          label="Create an image"
          checked={isImageMode}
          onToggle={onToggleImageMode}
        />
        <ToggleItem
          icon={<Globe className="size-4" />}
          label="Search the web"
          checked={searchAlwaysOn || sessionSettings.webSearch}
          disabled={searchAlwaysOn || textOnlyOptionsDisabled}
          note={searchAlwaysOn ? 'Always on' : undefined}
          onToggle={() => updateSessionSettings({ webSearch: !sessionSettings.webSearch })}
        />
        <ToggleItem
          icon={<FileSearch className="size-4" />}
          label="Use project files"
          checked={sessionSettings.fileContext}
          disabled={textOnlyOptionsDisabled}
          onToggle={() => updateSessionSettings({ fileContext: !sessionSettings.fileContext })}
        />

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            afterCloseRef.current = onOpenPromptLibrary
          }}
        >
          <BookText className="size-4" />
          Prompt library
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openWorkspaceTool('playbooks')}>
          <BookOpen className="size-4" />
          Playbooks
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasDraftText || textOnlyOptionsDisabled}
          onSelect={() => openWorkspaceTool('model-comparison')}
        >
          <GitCompareArrows className="size-4" />
          <span className="flex-1">Compare in Model Duel</span>
          {!hasDraftText ? (
            <span className="text-[11px] text-muted-foreground">Type first</span>
          ) : null}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openWorkspaceTool('artifacts')}>
          <Layers className="size-4" />
          Artifact Studio
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openWorkspaceTool('prism-studio')}>
          <Images className="size-4" />
          Prism Studio
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleSettingsPanel}>
          <SlidersHorizontal className="size-4" />
          Chat settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
