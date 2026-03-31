'use client'

import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS } from '@/lib/types'
import { ModeSwitcher } from './mode-switcher'
import { ChevronRightIcon, SparklesIcon, BrainIcon, CodeIcon } from '@/components/icons'

interface SuggestedPromptProps {
  prompt: string
  onClick: () => void
  mode: string
}

function SuggestedPrompt({ prompt, onClick, mode }: SuggestedPromptProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-all duration-200 hover:border-border',
        mode === 'creative' && 'hover:border-creative/30',
        mode === 'logic' && 'hover:border-logic/30',
        mode === 'code' && 'hover:border-code/30'
      )}
    >
      <p className="text-sm text-foreground leading-relaxed line-clamp-2">
        {prompt}
      </p>
      <div
        className={cn(
          'flex items-center gap-1 mt-2 text-xs transition-colors',
          mode === 'creative' && 'text-creative',
          mode === 'logic' && 'text-logic',
          mode === 'code' && 'text-code'
        )}
      >
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          Use this prompt
        </span>
        <ChevronRightIcon className="size-3 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

function getModeIcon(mode: string, className?: string) {
  switch (mode) {
    case 'creative':
      return <SparklesIcon className={cn('size-12', className)} />
    case 'logic':
      return <BrainIcon className={cn('size-12', className)} />
    case 'code':
      return <CodeIcon className={cn('size-12', className)} />
    default:
      return null
  }
}

interface EmptyStateProps {
  onPromptSelect: (prompt: string) => void
}

export function EmptyState({ onPromptSelect }: EmptyStateProps) {
  const { currentMode } = useChatContext()
  const modeConfig = MODE_CONFIGS[currentMode]

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* Mode Icon */}
      <div
        className={cn(
          'mb-6 p-4 rounded-2xl',
          currentMode === 'creative' && 'bg-creative/10 text-creative',
          currentMode === 'logic' && 'bg-logic/10 text-logic',
          currentMode === 'code' && 'bg-code/10 text-code'
        )}
      >
        {getModeIcon(currentMode)}
      </div>

      {/* Title & Description */}
      <h1 className="text-3xl font-bold text-foreground mb-2 text-center text-balance">
        {modeConfig.emptyStateTitle}
      </h1>
      <p className="text-muted-foreground text-center max-w-md mb-8 text-balance">
        {modeConfig.emptyStateDescription}
      </p>

      {/* Mode Switcher */}
      <div className="mb-10">
        <ModeSwitcher />
      </div>

      {/* Suggested Prompts */}
      <div className="w-full max-w-2xl">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 text-center">
          Try asking
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modeConfig.suggestedPrompts.map((prompt, index) => (
            <SuggestedPrompt
              key={index}
              prompt={prompt}
              onClick={() => onPromptSelect(prompt)}
              mode={currentMode}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
