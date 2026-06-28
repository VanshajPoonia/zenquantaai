'use client'

import Link from 'next/link'
import {
  ASSISTANT_FAMILY_COPY,
  ASSISTANT_PUBLIC_PAGES,
  PLAN_CONFIGS,
  TIER_ASSISTANT_NAMES,
} from '@/lib/config'
import { AssistantFamily } from '@/types'
import { ModeIcon, getModeAccentClass } from '@/lib/mode-utils'
import { ZenquantaLogo } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-border/60 py-10 sm:py-12">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 py-4 text-sm leading-7 text-muted-foreground first:border-t-0">
      {children}
    </div>
  )
}

export function AssistantBrandPage({
  family,
}: {
  family: AssistantFamily
}) {
  const config = ASSISTANT_PUBLIC_PAGES[family]
  const copy = ASSISTANT_FAMILY_COPY[family]
  const mode = config.mode
  const accentText = getModeAccentClass(mode, 'text')

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col">
        <div className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center gap-2 text-left transition-opacity hover:opacity-80"
          >
            <ZenquantaLogo className="size-7" />
            <span className="text-sm font-semibold text-foreground">Zenquanta AI</span>
          </Link>
          <Link
            href="/"
            className="eyebrow transition-colors hover:text-foreground"
          >
            Back to app
          </Link>
        </div>

        {/* Hero — eyebrow + display headline lockup, one accent signal */}
        <section className="border-t border-border/60 py-10 sm:py-14">
          <div className={`flex items-center gap-2 ${accentText}`}>
            <ModeIcon mode={mode} size="md" />
            <Badge variant="eyebrow" className={accentText}>
              {config.badge}
            </Badge>
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {config.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {config.subheadline}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="cta" className="h-11 px-6 text-base">
              <Link href="/">Open {copy.shortName}</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-full px-6 text-base">
              <Link href="/pricing">View plans</Link>
            </Button>
          </div>
        </section>

        <Section eyebrow="Positioning" title={`What ${copy.shortName} is built for`}>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base">
            {config.positioning}
          </p>
          <div className="mt-6 grid gap-x-8 sm:grid-cols-3">
            {config.bestFor.map((item) => (
              <Row key={item}>
                <p className="text-foreground">{item}</p>
              </Row>
            ))}
          </div>
        </Section>

        <Section eyebrow="In practice" title="Demo highlights">
          {config.demoHighlights.map((item) => (
            <Row key={item}>{item}</Row>
          ))}
        </Section>

        <Section eyebrow="Try it" title="Starter prompts">
          <div className="grid gap-x-8 sm:grid-cols-2">
            {copy.suggestedPrompts.map((prompt) => (
              <Row key={prompt}>{prompt}</Row>
            ))}
          </div>
        </Section>

        <Section eyebrow="Profile" title="Signature focus">
          <Row>
            <p className="eyebrow mb-2">Positioning</p>
            <p className="text-foreground">{copy.description}</p>
          </Row>
          <Row>
            <p className="eyebrow mb-2">In-product focus</p>
            <p className="text-foreground">{copy.helperText}</p>
          </Row>
        </Section>

        <Section eyebrow="Plans" title={`${copy.shortName} across every tier`}>
          <div className="grid divide-y divide-border/60 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
            {Object.values(PLAN_CONFIGS).map((plan) => (
              <div key={plan.tier} className="py-4 sm:px-4 sm:py-0 first:sm:pl-0">
                <p className="eyebrow">{plan.tier}</p>
                <p className="mt-2 text-lg font-medium text-foreground">
                  {TIER_ASSISTANT_NAMES[plan.tier][family]}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  ${plan.priceUsd}/month
                </p>
              </div>
            ))}
          </div>
        </Section>

        <div className="h-10" />
      </div>
    </main>
  )
}
