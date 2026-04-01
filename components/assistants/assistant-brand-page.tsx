'use client'

import Link from 'next/link'
import {
  ASSISTANT_FAMILY_COPY,
  ASSISTANT_PUBLIC_PAGES,
  PLAN_CONFIGS,
  TIER_ASSISTANT_NAMES,
} from '@/lib/config'
import { AssistantFamily } from '@/types'
import {
  ModeIcon,
  getModeAccentClass,
  getModeGlow,
  getModeTintClass,
} from '@/lib/mode-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AssistantBrandPage({
  family,
}: {
  family: AssistantFamily
}) {
  const config = ASSISTANT_PUBLIC_PAGES[family]
  const copy = ASSISTANT_FAMILY_COPY[family]
  const mode = config.mode

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section
          className={`relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 p-6 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-8 ${getModeGlow(mode)}`}
        >
          <div className={`pointer-events-none absolute inset-0 opacity-80 ${getModeTintClass(mode, 'strong')}`} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge
                variant="outline"
                className={`rounded-full border-current/20 bg-background/50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${getModeAccentClass(mode, 'text')}`}
              >
                {config.badge}
              </Badge>
              <div className="mt-5 flex items-center gap-4">
                <div
                  className={`flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-background/70 ${getModeAccentClass(mode, 'text')}`}
                >
                  <ModeIcon mode={mode} size="lg" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Zenquanta assistant
                  </p>
                  <h1 className="mt-1 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    {copy.shortName}
                  </h1>
                </div>
              </div>
              <p className="mt-6 text-xl font-medium leading-8 text-foreground">
                {config.headline}
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {config.subheadline}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-xl">
                <Link href="/">Open Zenquanta</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-xl">
                <Link href="/pricing">View plans</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>What {copy.shortName} is built for</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm leading-7 text-muted-foreground">
                {config.positioning}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {config.bestFor.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-border/60 bg-background/40 px-4 py-4"
                  >
                    <p className="text-sm font-medium text-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Demo highlights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {config.demoHighlights.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-border/60 bg-background/40 px-4 py-4"
                >
                  <p className="text-sm leading-6 text-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Starter prompts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {copy.suggestedPrompts.map((prompt) => (
                <div
                  key={prompt}
                  className="rounded-2xl border border-border/60 bg-background/40 px-4 py-4"
                >
                  <p className="text-sm leading-6 text-foreground">{prompt}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Signature profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Positioning
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground">{copy.description}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  In-product focus
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground">{copy.helperText}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>{copy.shortName} across every tier</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-5">
              {Object.values(PLAN_CONFIGS).map((plan) => (
                <div
                  key={plan.tier}
                  className="rounded-2xl border border-border/60 bg-background/40 px-4 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {plan.tier}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {TIER_ASSISTANT_NAMES[plan.tier][family]}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    ${plan.priceUsd}/month
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
