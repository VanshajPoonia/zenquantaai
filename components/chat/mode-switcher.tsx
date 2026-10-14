'use client'

import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS, MODE_ORDER } from '@/lib/types'
import {
  ModeIcon,
  getModeAccentClass,
  getModeGlow,
  getModeTintClass,
} from '@/lib/mode-utils'

export function ModeSwitcher() {
  const { currentMode, setCurrentMode } = useChatContext()
  const [, startTransition] = useTransition()

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={cn(
          'grid w-full max-w-5xl grid-cols-2 gap-1.5 rounded-2xl p-1.5 backdrop-blur-xl sm:grid-cols-3 xl:grid-cols-6',
          'bg-gradient-to-b from-secondary/80 to-secondary/40',
          'border border-border/50 shadow-xl shadow-black/20'
        )}
      >
        {MODE_ORDER.map((mode) => {
          const config = MODE_CONFIGS[mode]
          const isActive = currentMode === mode

          return (
            <button
              key={mode}
              onClick={() => startTransition(() => setCurrentMode(mode))}
              className={cn(
                'relative flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 transition-all duration-200',
                'text-sm font-semibold tracking-tight will-change-transform',
                isActive
                  ? cn(
                      'text-white shadow-lg',
                      getModeAccentClass(mode, 'bg'),
                      getModeGlow(mode)
                    )
                  : cn(
                      'text-muted-foreground hover:text-foreground',
                      getModeTintClass(mode, 'subtle'),
                      'hover:bg-secondary/80'
                    )
              )}
            >
              <ModeIcon
                mode={mode}
                size="md"
                className={cn(
                  'transition-all duration-300',
                  isActive && 'scale-110 drop-shadow-lg'
                )}
              />
              <span className="hidden sm:inline">{config.name}</span>
            </button>
          )
        })}
      </div>

      <p className="text-sm text-muted-foreground animate-in fade-in duration-300">
        {MODE_CONFIGS[currentMode].description}
      </p>
    </div>
  )
}
