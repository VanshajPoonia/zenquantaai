'use client'

import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, MODE_CONFIGS, MODE_ORDER } from '@/lib/types'
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

// Compact horizontal switcher for header/inline use
export function ModeSwitcherCompact() {
  const { currentMode, setCurrentMode } = useChatContext()
  const [, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border/30 bg-secondary/50 p-1">
      {MODE_ORDER.map((mode) => {
        const isActive = currentMode === mode

        return (
          <button
            key={mode}
            onClick={() => startTransition(() => setCurrentMode(mode))}
            className={cn(
              'relative flex items-center justify-center p-2 rounded-lg transition-all duration-200',
              isActive
                ? cn('text-white', getModeAccentClass(mode, 'bg'))
                : cn(
                    'text-muted-foreground hover:text-foreground hover:bg-secondary/80',
                    `hover:${getModeAccentClass(mode, 'text')}`
                  )
            )}
            title={MODE_CONFIGS[mode].name}
          >
            <ModeIcon mode={mode} size="sm" />
            {isActive && (
              <div className="absolute inset-0 rounded-lg bg-current opacity-20 animate-pulse" />
            )}
          </button>
        )
      })}
    </div>
  )
}

// Premium vertical mode selector for sidebar or modal
export function ModeSwitcherVertical() {
  const { currentMode, setCurrentMode } = useChatContext()
  const [, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      {MODE_ORDER.map((mode) => {
        const config = MODE_CONFIGS[mode]
        const isActive = currentMode === mode

        return (
          <button
            key={mode}
            onClick={() => startTransition(() => setCurrentMode(mode))}
            className={cn(
              'group relative flex items-center gap-4 p-4 rounded-xl transition-all duration-300',
              'border',
              isActive
                ? cn(
                    'border-transparent',
                    getModeAccentClass(mode, 'bg'),
                    getModeGlow(mode),
                    'text-white'
                  )
                : cn(
                    'border-border/50 bg-card/30 hover:bg-card/50',
                    'text-foreground hover:border-border'
                  )
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center size-12 rounded-xl transition-all duration-300',
                isActive
                  ? 'bg-white/20'
                  : cn('bg-secondary/50', getModeAccentClass(mode, 'text'))
              )}
            >
              <ModeIcon mode={mode} size="lg" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold">{config.name}</p>
              <p
                className={cn(
                  'text-sm transition-colors',
                  isActive ? 'text-white/80' : 'text-muted-foreground'
                )}
              >
                {config.helperText}
              </p>
            </div>
            {isActive && (
              <div className="size-3 rounded-full bg-white shadow-lg" />
            )}
          </button>
        )
      })}
    </div>
  )
}
