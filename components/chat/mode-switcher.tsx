'use client'

import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, MODE_CONFIGS } from '@/lib/types'
import { ModeIcon, getModeAccentClass, getModeGlow } from '@/lib/mode-utils'

export function ModeSwitcher() {
  const { currentMode, setCurrentMode } = useChatContext()
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<AIMode, HTMLButtonElement>>(new Map())

  useEffect(() => {
    const button = buttonRefs.current.get(currentMode)
    const container = containerRef.current
    if (button && container) {
      const containerRect = container.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      })
    }
  }, [currentMode])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Premium mode switcher */}
      <div
        ref={containerRef}
        className={cn(
          'relative flex items-center gap-1 p-1.5 rounded-2xl backdrop-blur-xl',
          'bg-gradient-to-b from-secondary/80 to-secondary/40',
          'border border-border/50 shadow-xl shadow-black/20'
        )}
      >
        {/* Animated background indicator */}
        <div
          className={cn(
            'absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out',
            getModeAccentClass(currentMode, 'bg'),
            getModeGlow(currentMode)
          )}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />

        {(Object.keys(MODE_CONFIGS) as AIMode[]).map((mode) => {
          const config = MODE_CONFIGS[mode]
          const isActive = currentMode === mode

          return (
            <button
              key={mode}
              ref={(el) => {
                if (el) buttonRefs.current.set(mode, el)
              }}
              onClick={() => setCurrentMode(mode)}
              className={cn(
                'relative z-10 flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all duration-300',
                'text-sm font-semibold tracking-tight',
                isActive
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
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

      {/* Helper text with subtle animation */}
      <p className="text-sm text-muted-foreground animate-in fade-in duration-300">
        {MODE_CONFIGS[currentMode].helperText}
      </p>
    </div>
  )
}

// Compact horizontal switcher for header/inline use
export function ModeSwitcherCompact() {
  const { currentMode, setCurrentMode } = useChatContext()

  return (
    <div className="flex items-center gap-0.5 p-1 bg-secondary/50 rounded-xl border border-border/30">
      {(Object.keys(MODE_CONFIGS) as AIMode[]).map((mode) => {
        const isActive = currentMode === mode

        return (
          <button
            key={mode}
            onClick={() => setCurrentMode(mode)}
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

  return (
    <div className="flex flex-col gap-2">
      {(Object.keys(MODE_CONFIGS) as AIMode[]).map((mode) => {
        const config = MODE_CONFIGS[mode]
        const isActive = currentMode === mode

        return (
          <button
            key={mode}
            onClick={() => setCurrentMode(mode)}
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
                {config.model}
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
