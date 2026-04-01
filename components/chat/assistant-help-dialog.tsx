'use client'

import Link from 'next/link'
import { ASSISTANT_FAMILY_COPY, ASSISTANT_PUBLIC_PAGES } from '@/lib/config/assistants'
import { FAMILY_TO_MODE } from '@/lib/config/assistants'
import { getModeAccentClass, getModeTintClass, ModeIcon } from '@/lib/mode-utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface AssistantHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FAMILY_ORDER = ['nova', 'velora', 'axiom', 'forge', 'pulse', 'prism'] as const

export function AssistantHelpDialog({
  open,
  onOpenChange,
}: AssistantHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[92vh] max-w-[1120px] overflow-hidden rounded-[24px] border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40 backdrop-blur-xl sm:w-[min(1120px,calc(100vw-2rem))] sm:rounded-[28px]">
        <div className="max-h-[92vh] overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <DialogHeader className="space-y-3 text-left">
            <div className="inline-flex w-fit rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">
              Assistant Guide
            </div>
            <DialogTitle className="max-w-4xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2.6rem]">
              Pick the right assistant for the work
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-xs leading-6 text-muted-foreground sm:text-sm">
              Zenquanta routes each assistant toward a different kind of outcome.
              Use this guide when you want a faster match between the task and the
              assistant family, then open the assistant page for deeper detail.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 grid gap-4 pb-6 lg:grid-cols-2">
            {FAMILY_ORDER.map((family) => {
              const publicPage = ASSISTANT_PUBLIC_PAGES[family]
              const copy = ASSISTANT_FAMILY_COPY[family]
              const mode = FAMILY_TO_MODE[family]

              return (
                <article
                  key={family}
                  className={`rounded-[1.5rem] border border-border/70 bg-card/60 p-4 shadow-xl shadow-black/10 sm:p-5 ${getModeTintClass(mode, 'subtle')}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-background/70 sm:size-12 ${getModeAccentClass(mode, 'text')}`}
                      >
                        <ModeIcon mode={mode} size="md" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-lg font-semibold text-foreground sm:text-xl">
                          {copy.shortName}
                        </h3>
                        <p className="max-w-xl text-[13px] leading-6 text-muted-foreground sm:text-sm">
                          {copy.helperText}
                        </p>
                      </div>
                    </div>
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="w-full shrink-0 rounded-xl sm:w-auto"
                    >
                      <Link href={`/${publicPage.slug}`}>Learn more</Link>
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
                        Best for
                      </p>
                      <p className="mt-2 text-[13px] leading-6 text-foreground/90 sm:text-sm">
                        {publicPage.bestFor[0]}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
                        Try asking
                      </p>
                      <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-foreground/85 sm:text-sm">
                        {copy.suggestedPrompts[0]}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
