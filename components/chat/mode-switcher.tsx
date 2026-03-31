'use client'

import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, MODE_CONFIGS } from '@/lib/types'
import { SparklesIcon, BrainIcon, CodeIcon } from '@/components/icons'

function getModeIcon(mode: AIMode, className?: string) {
  switch (mode) {
    case 'creative':
      return <SparklesIcon className={cn('size-5', className)} />
    case 'logic':
      return <BrainIcon className={cn('size-5', className)} />
    case 'code':
      return <CodeIcon className={cn('size-5', className)} />
  }
}

export function ModeSwitcher() {
  const { currentMode, setCurrentMode } = useChatContext()

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1 p-1.5 bg-secondary/50 rounded-2xl backdrop-blur-sm border border-border/50">
        {(Object.keys(MODE_CONFIGS) as AIMode[]).map((mode) => {
          const config = MODE_CONFIGS[mode]
          const isActive = currentMode === mode

          return (
            <button
              key={mode}
              onClick={() => setCurrentMode(mode)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm font-medium',
                isActive
                  ? cn(
                      'text-white shadow-lg',
                      mode === 'creative' && 'bg-creative',
                      mode === 'logic' && 'bg-logic',
                      mode === 'code' && 'bg-code'
                    )
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              )}
            >
              {getModeIcon(
                mode,
                cn(
                  'transition-transform duration-300',
                  isActive && 'scale-110'
                )
              )}
              <span className="hidden sm:inline">{config.name}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {MODE_CONFIGS[currentMode].helperText}
      </p>
    </div>
  )
}

// Compact version for mobile or inline use
export function ModeSwitcherCompact() {
  const { currentMode, setCurrentMode } = useChatContext()

  return (
    <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl">
      {(Object.keys(MODE_CONFIGS) as AIMode[]).map((mode) => {
        const isActive = currentMode === mode

        return (
          <button
            key={mode}
            onClick={() => setCurrentMode(mode)}
            className={cn(
              'flex items-center justify-center p-2 rounded-lg transition-all duration-200',
              isActive
                ? cn(
                    'text-white shadow-md',
                    mode === 'creative' && 'bg-creative',
                    mode === 'logic' && 'bg-logic',
                    mode === 'code' && 'bg-code'
                  )
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            )}
            title={MODE_CONFIGS[mode].name}
          >
            {getModeIcon(mode, 'size-4')}
          </button>
        )
      })}
    </div>
  )
}
