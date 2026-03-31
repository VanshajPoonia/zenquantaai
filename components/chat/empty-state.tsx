'use client'

import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS } from '@/lib/types'
import { ModeIcon, getModeAccentClass, getModeGradient, getModeGlow } from '@/lib/mode-utils'
import { ModeSwitcher } from './mode-switcher'
import { ChevronRightIcon } from '@/components/icons'

interface SuggestedPromptCardProps {
  prompt: string
  onClick: () => void
  index: number
}

function SuggestedPromptCard({ prompt, onClick, index }: SuggestedPromptCardProps) {
  const { currentMode } = useChatContext()

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative text-left p-5 rounded-2xl transition-all duration-300',
        'border border-border/30 bg-card/20 backdrop-blur-sm',
        'hover:bg-card/40 hover:border-border/50 hover:scale-[1.02]',
        'animate-in fade-in slide-in-from-bottom-4 fill-mode-both'
      )}
      style={{ animationDelay: `${index * 75}ms` }}
    >
      {/* Subtle gradient overlay on hover */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          getModeGradient(currentMode)
        )}
      />

      <div className="relative">
        <p className="text-sm text-foreground leading-relaxed line-clamp-2 mb-3">
          {prompt}
        </p>
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium transition-all duration-300',
            getModeAccentClass(currentMode, 'text'),
            'opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0'
          )}
        >
          <span>Use this prompt</span>
          <ChevronRightIcon className="size-3" />
        </div>
      </div>
    </button>
  )
}

interface EmptyStateProps {
  onPromptSelect: (prompt: string) => void
}

export function EmptyState({ onPromptSelect }: EmptyStateProps) {
  const { currentMode } = useChatContext()
  const modeConfig = MODE_CONFIGS[currentMode]

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8 md:py-10">
      {/* Animated background glow */}
      <div
        className={cn(
          'absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-[600px] h-[400px] rounded-full blur-[120px] opacity-20',
          'transition-all duration-700 pointer-events-none',
          currentMode === 'general' && 'bg-general',
          currentMode === 'creative' && 'bg-creative',
          currentMode === 'logic' && 'bg-logic',
          currentMode === 'code' && 'bg-code'
        )}
      />

      <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto">
        {/* Mode Icon with premium styling */}
        <div
          className={cn(
            'relative mb-8 animate-in zoom-in duration-500',
          )}
        >
          {/* Outer ring */}
          <div
            className={cn(
              'absolute -inset-3 rounded-3xl opacity-20 blur-md',
              getModeAccentClass(currentMode, 'bg')
            )}
          />
          {/* Icon container */}
          <div
            className={cn(
              'relative flex items-center justify-center size-24 rounded-3xl',
              'bg-gradient-to-br from-secondary/80 to-secondary/40',
              'border border-border/50',
              getModeGlow(currentMode)
            )}
          >
            <ModeIcon
              mode={currentMode}
              size="xl"
              className={cn(getModeAccentClass(currentMode, 'text'))}
            />
          </div>
        </div>

        {/* Title & Description */}
        <h1 className="text-4xl font-bold text-foreground mb-3 text-center text-balance animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-both">
          {modeConfig.emptyStateTitle}
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-lg mb-10 text-balance animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
          {modeConfig.emptyStateDescription}
        </p>

        {/* Mode Switcher */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both">
          <ModeSwitcher />
        </div>

        {/* Suggested Prompts */}
        <div className="w-full max-w-2xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 text-center">
            Try asking
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modeConfig.suggestedPrompts.map((prompt, index) => (
              <SuggestedPromptCard
                key={index}
                prompt={prompt}
                onClick={() => onPromptSelect(prompt)}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
