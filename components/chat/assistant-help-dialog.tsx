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
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden rounded-[2rem] border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="space-y-3 text-left">
            <div className="inline-flex w-fit rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Assistant Guide
            </div>
            <DialogTitle className="text-3xl font-semibold tracking-tight text-foreground">
              Pick the right assistant for the work
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Zenquanta routes each assistant toward a different kind of outcome.
              Use this guide when you want a faster match between the task and the
              assistant family.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {FAMILY_ORDER.map((family) => {
              const publicPage = ASSISTANT_PUBLIC_PAGES[family]
              const copy = ASSISTANT_FAMILY_COPY[family]
              const mode = FAMILY_TO_MODE[family]

              return (
                <article
                  key={family}
                  className={`rounded-[1.75rem] border border-border/70 bg-card/60 p-5 shadow-xl shadow-black/10 ${getModeTintClass(mode, 'subtle')}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-background/70 ${getModeAccentClass(mode, 'text')}`}
                      >
                        <ModeIcon mode={mode} size="md" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-foreground">
                          {copy.shortName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {copy.helperText}
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="secondary" size="sm" className="rounded-xl">
                      <Link href={`/${publicPage.slug}`}>Learn more</Link>
                    </Button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-border/60 bg-background/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Use this when
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground/90">
                      {publicPage.subheadline}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Best for
                      </p>
                      <ul className="mt-2 space-y-2 text-sm text-foreground/85">
                        {publicPage.bestFor.slice(0, 3).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Try asking
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground/85">
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
