'use client'

import {
  FocusEvent,
  KeyboardEvent,
  RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import {
  BookText,
  Brain,
  Database,
  Download,
  GitCompareArrows,
  ImagePlus,
  Layers,
  Play,
  Plus,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode } from '@/lib/types'
import { ModeIcon, getModeAccentClass } from '@/lib/mode-utils'
import {
  buildMentionTargets,
  buildSlashItems,
  filterMentionTargets,
  filterSlashItems,
  MentionTarget,
  mentionPrefixFor,
  parseComposerTrigger,
  parseLeadingMention,
  parseSlashSubmission,
  SLASH_GROUP_LABELS,
  SlashItem,
} from '@/lib/chat/commands'
import { XIcon } from '@/components/icons'
import { ASSISTANT_ROLES } from './composer-controls'

type MenuEntry =
  | { kind: 'slash'; id: string; group: string; item: SlashItem }
  | { kind: 'mention'; id: string; group: string; target: MentionTarget }

export type RoutedSubmission =
  | { type: 'handled' }
  | {
      type: 'send'
      content: string
      kind: 'chat' | 'image'
      modeOverride?: AIMode
      customAssistantId?: string | null
    }

const TOOL_ICONS: Record<string, LucideIcon> = {
  'tool:image': ImagePlus,
  'tool:research': Zap,
  'tool:compare': GitCompareArrows,
  'tool:files': Database,
  'tool:artifacts': Layers,
  'tool:memory': Brain,
  'chat:new': Plus,
  'chat:export': Download,
}

// Places the caret at the end, or selects the first {{variable}} of a prompt.
function focusDraft(textarea: HTMLTextAreaElement | null, text: string) {
  requestAnimationFrame(() => {
    if (!textarea) return
    textarea.focus()
    const variable = /\{\{[^}]+\}\}/.exec(text)
    if (variable) {
      textarea.setSelectionRange(variable.index, variable.index + variable[0].length)
    } else {
      textarea.setSelectionRange(text.length, text.length)
    }
  })
}

export function useComposerCommands({
  value,
  setValue,
  setComposerKind,
  textareaRef,
}: {
  value: string
  setValue: (value: string) => void
  setComposerKind: (kind: 'chat' | 'image') => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}) {
  const {
    promptLibrary,
    promptWorkflows,
    customAssistants,
    currentMode,
    currentCustomAssistantId,
    currentChat,
    openWorkspaceTool,
    createNewChat,
    exportCurrentChat,
    setCurrentMode,
    setCurrentCustomAssistant,
  } = useChatContext()
  const menuId = useId()
  // Esc or an inserted prompt close the menu until the next edit. It only shows while focused.
  const [dismissed, setDismissed] = useState(false)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState({ key: '', index: 0 })

  const mentionTargets = useMemo(
    () => buildMentionTargets(ASSISTANT_ROLES, customAssistants),
    [customAssistants]
  )
  const slashItems = useMemo(
    () =>
      buildSlashItems({
        prompts: promptLibrary.filter(
          (prompt) => prompt.mode === 'any' || prompt.mode === currentMode
        ),
        playbooks: promptWorkflows,
        canExport: (currentChat?.messages.length ?? 0) > 0,
      }),
    [currentChat?.messages.length, currentMode, promptLibrary, promptWorkflows]
  )

  const trigger = useMemo(() => parseComposerTrigger(value), [value])
  const triggerKey = trigger ? `${trigger.type}:${trigger.query}` : ''
  const mention = parseLeadingMention(value, mentionTargets)

  const entries = useMemo<MenuEntry[]>(() => {
    if (!trigger || dismissed || !focused) return []
    if (trigger.type === 'mention') {
      return filterMentionTargets(mentionTargets, trigger.query).map((target) => ({
        kind: 'mention',
        id: target.id,
        group: target.customAssistantId ? 'Your assistants' : 'Assistants',
        target,
      }))
    }
    return filterSlashItems(slashItems, trigger.query).map((item) => ({
      kind: 'slash',
      id: item.id,
      group: SLASH_GROUP_LABELS[item.group],
      item,
    }))
  }, [dismissed, focused, mentionTargets, slashItems, trigger])

  const isOpen = entries.length > 0
  const activeIndex =
    active.key === triggerKey ? Math.min(active.index, entries.length - 1) : 0
  const optionId = useCallback((index: number) => `${menuId}-option-${index}`, [menuId])

  const setActiveIndex = (index: number) => setActive({ key: triggerKey, index })

  const pickMention = (target: MentionTarget) => {
    if (target.mode === 'image' && !target.customAssistantId) {
      setValue('')
      setComposerKind('image')
      focusDraft(textareaRef.current, '')
      return
    }
    const next = `@${target.handle} `
    setValue(next)
    focusDraft(textareaRef.current, next)
  }

  const runSlash = (item: SlashItem) => {
    const action = item.action
    switch (action.type) {
      case 'prompt':
        setValue(action.content)
        setDismissed(true)
        focusDraft(textareaRef.current, action.content)
        return
      case 'playbook':
        setValue('')
        openWorkspaceTool({ tool: 'playbooks', workflowId: action.workflowId })
        return
      case 'tool':
        setValue('')
        openWorkspaceTool(action.tool)
        return
      case 'compare':
        setValue('/compare ')
        focusDraft(textareaRef.current, '/compare ')
        return
      case 'image':
        setValue('')
        setComposerKind('image')
        focusDraft(textareaRef.current, '')
        return
      case 'new-chat':
        setValue('')
        void createNewChat()
        return
      case 'export':
        setValue('')
        exportCurrentChat('markdown')
        return
    }
  }

  const pick = (index: number) => {
    const entry = entries[index]
    if (!entry) return
    if (entry.kind === 'mention') pickMention(entry.target)
    else runSlash(entry.item)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!isOpen || event.nativeEvent.isComposing) return false
    if (event.metaKey || event.ctrlKey || event.altKey) return false

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((activeIndex + 1) % entries.length)
        return true
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((activeIndex - 1 + entries.length) % entries.length)
        return true
      case 'Enter':
      case 'Tab':
        if (event.shiftKey) return false
        event.preventDefault()
        pick(activeIndex)
        return true
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        setDismissed(true)
        return true
      default:
        return false
    }
  }

  const handleBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    const menu = document.getElementById(menuId)
    if (menu && event.relatedTarget instanceof Node && menu.contains(event.relatedTarget)) {
      return
    }
    setFocused(false)
  }

  // A typed or pasted "@prism " turns on image mode, like picking Prism does.
  const handleChange = (next: string) => {
    setDismissed(false)
    const typed = parseLeadingMention(next, mentionTargets)
    if (typed && typed.target.mode === 'image' && !typed.target.customAssistantId) {
      setValue(typed.rest)
      setComposerKind('image')
      return
    }
    setValue(next)
  }

  const removeMention = () => {
    if (!mention) return
    setValue(mention.rest)
    focusDraft(textareaRef.current, mention.rest)
  }

  // Applies "/compare", "/image" and "@assistant" before a send. Null means a plain send.
  const routeSubmission = (hasAttachments: boolean): RoutedSubmission | null => {
    const slash = parseSlashSubmission(value)
    if (slash?.command === 'compare') {
      setValue(slash.rest)
      openWorkspaceTool('model-comparison')
      return { type: 'handled' }
    }
    if (slash?.command === 'image') {
      if (!slash.rest && !hasAttachments) {
        setValue('')
        setComposerKind('image')
        return { type: 'handled' }
      }
      return { type: 'send', content: slash.rest, kind: 'image' }
    }

    if (!mention) return null
    const { target, rest } = mention
    if (target.customAssistantId) {
      setCurrentCustomAssistant(target.customAssistantId)
    } else {
      setCurrentMode(target.mode)
    }
    if (!rest.trim() && !hasAttachments) {
      setValue('')
      return { type: 'handled' }
    }
    return {
      type: 'send',
      content: rest,
      kind: target.mode === 'image' ? 'image' : 'chat',
      modeOverride: target.mode,
      customAssistantId: target.customAssistantId,
    }
  }

  // A queued message for another assistant comes back with its @mention.
  const queuedText = (prompt: {
    content: string
    kind?: 'chat' | 'image'
    mode: AIMode
    customAssistantId?: string | null
  }) => {
    const sameAssistant =
      prompt.mode === currentMode &&
      (prompt.customAssistantId ?? null) === (currentCustomAssistantId ?? null)
    if (prompt.kind === 'image' || sameAssistant) return prompt.content
    return `${mentionPrefixFor(mentionTargets, prompt.mode, prompt.customAssistantId)}${prompt.content}`
  }

  return {
    menuId,
    entries,
    isOpen,
    activeIndex,
    activeOptionId: isOpen ? optionId(activeIndex) : undefined,
    optionId,
    triggerType: trigger?.type ?? null,
    mention,
    hasTrigger: Boolean(trigger),
    setActiveIndex,
    pick,
    handleKeyDown,
    handleBlur,
    handleFocus: () => setFocused(true),
    handleChange,
    removeMention,
    routeSubmission,
    queuedText,
  }
}

export type ComposerCommands = ReturnType<typeof useComposerCommands>

function EntryIcon({ entry }: { entry: MenuEntry }) {
  if (entry.kind === 'mention') {
    return entry.target.iconEmoji ? (
      <span aria-hidden className="w-4 text-center text-sm leading-none">
        {entry.target.iconEmoji}
      </span>
    ) : (
      <span className={cn('inline-flex', getModeAccentClass(entry.target.mode, 'text'))}>
        <ModeIcon mode={entry.target.mode} size="sm" />
      </span>
    )
  }

  const Icon =
    entry.item.group === 'prompts'
      ? BookText
      : entry.item.group === 'playbooks'
        ? Play
        : TOOL_ICONS[entry.item.id] ?? Plus
  return <Icon aria-hidden className="size-4 text-muted-foreground" />
}

export function ComposerCommandMenu({ commands }: { commands: ComposerCommands }) {
  const { entries, isOpen, activeIndex, menuId, optionId, triggerType, setActiveIndex, pick } =
    commands

  // Scrolls the list only, so the page does not jump on a phone.
  useEffect(() => {
    const list = document.getElementById(menuId)
    const option = document.getElementById(optionId(activeIndex))
    if (!isOpen || !list || !option) return
    if (activeIndex === 0) {
      list.scrollTop = 0
    } else if (option.offsetTop < list.scrollTop) {
      list.scrollTop = option.offsetTop
    } else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
    }
  }, [activeIndex, isOpen, menuId, optionId])

  if (!isOpen) return null

  const groups: Array<{ label: string; items: Array<{ entry: MenuEntry; index: number }> }> = []
  entries.forEach((entry, index) => {
    const last = groups.at(-1)
    if (last && last.label === entry.group) last.items.push({ entry, index })
    else groups.push({ label: entry.group, items: [{ entry, index }] })
  })

  return (
    <div
      id={menuId}
      role="listbox"
      tabIndex={-1}
      aria-label={triggerType === 'mention' ? 'Assistants' : 'Commands'}
      className="animate-arrive absolute inset-x-0 bottom-full z-30 mb-2 max-h-[min(18rem,45vh)] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.09] bg-popover p-1 shadow-[0_16px_40px_-12px_rgb(0_0_0_/_0.8)]"
    >
      {groups.map((group, groupIndex) => (
        <div
          key={group.label}
          role="group"
          aria-labelledby={`${menuId}-group-${groupIndex}`}
        >
          <div
            id={`${menuId}-group-${groupIndex}`}
            aria-hidden
            className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground"
          >
            {group.label}
          </div>
          {group.items.map(({ entry, index }) => {
            const prefix =
              entry.kind === 'mention'
                ? `@${entry.target.handle}`
                : entry.item.name
                  ? `/${entry.item.name}`
                  : null
            const label = entry.kind === 'mention' ? entry.target.label : entry.item.label
            const hint = entry.kind === 'mention' ? entry.target.hint : entry.item.hint
            const selected = index === activeIndex

            return (
              <div
                key={entry.id}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                className={cn(
                  'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm',
                  selected ? 'bg-white/[0.08] text-foreground' : 'text-foreground/90'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => {
                  if (!selected) setActiveIndex(index)
                }}
                onClick={() => pick(index)}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  <EntryIcon entry={entry} />
                </span>
                {prefix ? (
                  <span className="shrink-0 font-mono text-[12.5px] text-foreground">
                    {prefix}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'min-w-0 truncate',
                    prefix ? 'text-muted-foreground' : 'font-medium'
                  )}
                >
                  {label}
                </span>
                {hint ? (
                  <span className="ml-auto hidden min-w-0 truncate pl-2 text-xs text-muted-foreground sm:block">
                    {hint}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function MentionChip({
  target,
  onRemove,
}: {
  target: MentionTarget
  onRemove: () => void
}) {
  return (
    <div className="flex px-3 pt-2.5">
      <span className="animate-arrive inline-flex h-6 items-center gap-1.5 rounded-full bg-white/[0.06] pl-2 pr-0.5 text-[12px] font-medium text-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.06)]">
        {target.iconEmoji ? (
          <span aria-hidden className="text-xs leading-none">
            {target.iconEmoji}
          </span>
        ) : (
          <span className={cn('inline-flex', getModeAccentClass(target.mode, 'text'))}>
            <ModeIcon mode={target.mode} size="sm" />
          </span>
        )}
        To {target.label}
        <button
          type="button"
          aria-label={`Do not send to ${target.label}`}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          onClick={onRemove}
        >
          <XIcon className="size-3" />
        </button>
      </span>
    </div>
  )
}
