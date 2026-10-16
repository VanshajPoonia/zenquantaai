'use client'

import type { CSSProperties } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS } from '@/lib/types'
import { ModeIcon } from '@/lib/mode-utils'
import { ModeSwitcher } from './mode-switcher'

interface EmptyStateProps {
  onPromptSelect: (prompt: string) => void
}

export function EmptyState({ onPromptSelect }: EmptyStateProps) {
  const { currentMode, openOnboarding } = useChatContext()
  const modeConfig = MODE_CONFIGS[currentMode]

  return (
    <div
      style={{ '--mode': `var(--${currentMode})` } as CSSProperties}
      className="relative flex min-h-full flex-col items-center justify-center px-4 py-10 sm:py-14"
    >
      {/* Light from the chosen assistant, behind everything. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[8%] left-1/2 h-72 w-[min(44rem,90%)] -translate-x-1/2 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--mode)_16%,transparent),color-mix(in_oklab,var(--mode)_5%,transparent)_55%,transparent)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col">
        <div key={currentMode} className="animate-arrive flex flex-col items-center text-center">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-xl text-[var(--mode)] shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.08),0_10px_30px_-12px_color-mix(in_oklab,var(--mode)_60%,transparent)]"
            style={{ background: 'color-mix(in oklab, var(--mode) 14%, transparent)' }}
          >
            <ModeIcon mode={currentMode} size="md" />
          </span>
          <h1 className="font-display mt-5 text-[clamp(1.75rem,4vw,2.25rem)] leading-tight text-foreground">
            What are we working on?
          </h1>
          <p className="mt-2 max-w-md text-[15px] leading-6 text-balance text-muted-foreground">
            {modeConfig.description}
          </p>
        </div>

        <div className="animate-arrive mt-8" style={{ '--arrive-delay': '80ms' } as CSSProperties}>
          <ModeSwitcher />
        </div>

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[12.5px] text-muted-foreground">Try asking {modeConfig.name}</p>
            <button
              type="button"
              onClick={openOnboarding}
              className="rounded text-[12.5px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Personalize workspace
            </button>
          </div>
          <ul key={currentMode} className="overflow-hidden rounded-xl border border-border bg-white/[0.015]">
            {modeConfig.suggestedPrompts.map((prompt, index) => (
              <li
                key={prompt}
                className="animate-arrive border-border [&+li]:border-t"
                style={{ '--arrive-delay': `${120 + index * 50}ms` } as CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => onPromptSelect(prompt)}
                  className={cn(
                    'group flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] leading-6 text-foreground/85 transition-colors',
                    'hover:bg-white/[0.035] hover:text-foreground focus-visible:bg-white/[0.035] focus-visible:outline-none'
                  )}
                >
                  <span className="min-w-0 flex-1">{prompt}</span>
                  <ArrowUpRight className="size-4 shrink-0 -translate-x-1 text-[var(--mode)] opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
