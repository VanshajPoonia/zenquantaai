'use client'

import { useTransition, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS, MODE_ORDER } from '@/lib/types'
import { ModeIcon } from '@/lib/mode-utils'

// The six assistants as a row of keys. The chosen one is pressed in and lit
// in its own hue.
export function ModeSwitcher() {
  const { currentMode, setCurrentMode } = useChatContext()
  const [, startTransition] = useTransition()

  return (
    <div role="radiogroup" aria-label="Assistant" className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">
      {MODE_ORDER.map((mode) => {
        const config = MODE_CONFIGS[mode]
        const isActive = currentMode === mode

        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => startTransition(() => setCurrentMode(mode))}
            style={{ '--key': `var(--${mode})` } as CSSProperties}
            className={cn(
              'group relative flex h-[3.75rem] flex-col items-start justify-between rounded-xl px-3 pt-2.5 pb-3 text-left',
              'bg-gradient-to-b from-white/[0.05] to-white/[0.02] transition-[transform,box-shadow,background-color] duration-200 ease-out',
              'shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06),inset_0_0_0_1px_rgb(255_255_255_/_0.07),0_3px_0_rgb(0_0_0_/_0.55)]',
              'hover:-translate-y-px hover:from-white/[0.07]',
              'after:absolute after:right-3 after:bottom-2 after:left-3 after:h-0.5 after:rounded-full after:bg-[var(--key)] after:opacity-20 after:transition-opacity after:duration-300',
              isActive &&
                'translate-y-0.5 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05),inset_0_0_0_1px_color-mix(in_oklab,var(--key)_50%,transparent),0_1px_0_rgb(0_0_0_/_0.55),0_12px_30px_-12px_color-mix(in_oklab,var(--key)_70%,transparent)] after:opacity-100 after:shadow-[0_1px_10px_var(--key)] hover:translate-y-0.5'
            )}
          >
            <ModeIcon
              mode={mode}
              size="sm"
              className={cn(
                'size-4 transition-colors duration-300',
                isActive ? 'text-[var(--key)]' : 'text-muted-foreground group-hover:text-foreground/80'
              )}
            />
            <span className={cn('text-[13px] font-medium', isActive ? 'text-foreground' : 'text-foreground/75')}>
              {config.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
