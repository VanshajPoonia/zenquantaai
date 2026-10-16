'use client'

/*
 * Landing page for signed-out visitors, in the grammar of Cursor and Linear
 * (the user's brief): near-black canvas, tight sans headlines, hairline
 * structure, and the product itself as the hero.
 *
 * The one material idea: light takes the colour of whichever assistant is
 * working. The hero window's glow, its accent line and the selection colour
 * follow the six assistant hues as the example chats play through.
 *
 * Path: hero (live example chats) > statement that lights up as you read >
 * the six assistants on lit keys > prompts marquee > the shared workspace >
 * tone and temperature > the die, kept as a small playful nod > plans >
 * sign up.
 *
 * The die is the page's object. A small lettered one, the page buddy, rides
 * along in the corner the whole way down: it turns to whichever assistant
 * the page is showing (sections claim it with useBuddySpot, and anything
 * marked data-buddy-face turns it on hover or focus). The footer wordmark is
 * set in flipping letter blocks of the same kind.
 *
 * Motion budget: see the note at the top of landing.module.css. Scroll
 * handlers write to one element each and only when a value changes.
 */

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { ArrowRight } from 'lucide-react'
import { ASSISTANT_FAMILY_COPY, ASSISTANT_PUBLIC_PAGES, PLAN_CONFIGS, TIER_ASSISTANT_NAMES } from '@/lib/config'
import { ModeIcon } from '@/lib/mode-utils'
import { ZenquantaLogo } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { SubscriptionTier } from '@/types'
import { useBuddySpot } from './buddy-bus'
import { DieAccent } from './die-accent'
import { HeroDemo } from './hero-demo'
import { LandingAuthForm, type AuthMode } from './landing-auth-form'
import { ASSISTANTS } from './landing-data'
import { useCrossFade, useInView, useReducedMotion, useRevealOnScroll, useScrollProgress } from './landing-motion'
import { PageBuddy } from './page-buddy'
import { ToneDemo } from './tone-demo'
import { WorkspaceTiles } from './workspace-tiles'
import styles from './landing.module.css'

const TIERS: SubscriptionTier[] = ['free', 'basic', 'pro', 'ultra', 'prime']
const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  ultra: 'Ultra',
  prime: 'Prime',
}

function assistantLevel(tier: SubscriptionTier) {
  const level = TIER_ASSISTANT_NAMES[tier].nova.replace('Nova', '').trim()
  return level || 'Standard'
}

const STATEMENT_LEAD = 'Six specialists, one place.'
const STATEMENT =
  'Nova plans, Velora writes, Axiom reasons, Forge codes, Pulse researches and Prism draws. They share one workspace, so your chats, files and memory come with you from one to the next.'
const NAME_COLOR: Record<string, string> = Object.fromEntries(
  ASSISTANTS.map((assistant) => [assistant.name, assistant.colorVar])
)

const WORDS = STATEMENT.split(' ')

function Statement() {
  const ref = useRef<HTMLParagraphElement>(null)
  // Each word is lit once as the reader reaches it; between thresholds a
  // scrolled frame changes nothing.
  const onProgress = useCallback((progress: number) => {
    const lit = Math.floor(progress * (WORDS.length + 4))
    ref.current?.querySelectorAll<HTMLElement>('[data-word]').forEach((word, index) => {
      const on = index < lit
      if (on === 'lit' in word.dataset) return
      if (on) word.dataset.lit = ''
      else delete word.dataset.lit
    })
  }, [])
  useScrollProgress(ref, onProgress, { start: 0.85, end: 0.25 })

  return (
    <p ref={ref} className={cn(styles.statement, 'max-w-[56rem]')}>
      <span className="text-[var(--text)]">{STATEMENT_LEAD}</span>{' '}
      {WORDS.map((word, index) => {
        const name = word.replace(/[^A-Za-z]/g, '')
        const color = NAME_COLOR[name]
        return (
          <span
            key={`${word}-${index}`}
            data-word
            className={styles.word}
            style={color ? ({ '--lit': color } as CSSProperties) : undefined}
          >
            {word}{' '}
          </span>
        )
      })}
    </p>
  )
}

function CountUp({ value, prefix = '' }: { value: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  useEffect(() => {
    const element = ref.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setShown(0)
    let frame = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const start = performance.now()
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / 1100)
          const eased = 1 - Math.pow(2, -10 * t)
          setShown(Math.round(value * (t === 1 ? 1 : eased)))
          if (t < 1) frame = requestAnimationFrame(step)
        }
        frame = requestAnimationFrame(step)
      },
      { threshold: 0.6 }
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {shown.toLocaleString('en-US')}
    </span>
  )
}

// Two glow layers that cross-fade when the colour changes, so the large
// gradient is painted once per colour and only opacity animates.
function HeroGlow({ hue }: { hue: string }) {
  const layers = useCrossFade(hue)
  return (
    <>
      <div aria-hidden className={styles.heroLight} style={{ '--glow': layers.a, opacity: layers.front === 'a' ? 1 : 0 } as CSSProperties} />
      <div aria-hidden className={styles.heroLight} style={{ '--glow': layers.b, opacity: layers.front === 'b' ? 1 : 0 } as CSSProperties} />
    </>
  )
}

function Marquee() {
  const rows = [
    ASSISTANTS.flatMap((assistant, index) =>
      ASSISTANT_FAMILY_COPY[assistant.family].suggestedPrompts.slice(0, 2).map((prompt) => ({ prompt, index }))
    ),
    ASSISTANTS.flatMap((assistant, index) =>
      ASSISTANT_FAMILY_COPY[assistant.family].suggestedPrompts.slice(2, 4).map((prompt) => ({ prompt, index }))
    ),
  ]
  return (
    <div aria-label="Things people ask" role="region" data-loop className="space-y-2.5">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.marquee}>
          <ul className={styles.track} data-reverse={rowIndex === 1 ? '' : undefined}>
            {[...row, ...row].map(({ prompt, index }, itemIndex) => (
              <li
                key={`${prompt}-${itemIndex}`}
                aria-hidden={itemIndex >= row.length ? true : undefined}
                data-buddy-face={index}
                className="flex h-10 shrink-0 items-center gap-2.5 rounded-full border border-[var(--line)] bg-white/[0.02] pr-4 pl-3 text-[14px] text-[var(--text-2)]"
              >
                <ModeIcon mode={ASSISTANTS[index].mode} size="sm" className="size-3.5" />
                <span className="sr-only">{ASSISTANTS[index].name}:</span>
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function AssistantKeys() {
  const [active, setActive] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const inView = useInView(sectionRef)
  const keyRefs = useRef<(HTMLButtonElement | null)[]>([])
  useBuddySpot(sectionRef, active, 'Press 1 to 6 and I will keep up.')

  // Keys 1 to 6 pick an assistant while this part of the page is in view.
  useEffect(() => {
    if (!inView) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const index = Number(event.key) - 1
      if (index >= 0 && index < 6) setActive(index)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inView])

  function onTabKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + 6) % 6
    setActive(next)
    keyRefs.current[next]?.focus()
  }

  const assistant = ASSISTANTS[active]
  const copy = ASSISTANT_FAMILY_COPY[assistant.family]
  const page = ASSISTANT_PUBLIC_PAGES[assistant.family]

  return (
    <div ref={sectionRef}>
      <div role="tablist" aria-label="Assistants" className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 sm:gap-3">
        {ASSISTANTS.map((item, index) => (
          <button
            key={item.family}
            ref={(node) => {
              keyRefs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`key-${item.family}`}
            aria-selected={index === active}
            aria-controls="assistant-panel"
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => onTabKey(event, index)}
            data-buddy-face={index}
            style={{ '--key': item.colorVar } as CSSProperties}
            className={styles.key}
          >
            <span className="flex items-center justify-between font-mono text-[11px] text-[var(--text-3)]">
              {index + 1}
              <ModeIcon mode={item.mode} size="sm" className={cn('size-3.5 transition-colors duration-300', index === active ? 'text-[var(--key)]' : 'text-[var(--text-3)]')} />
            </span>
            <span className="text-[15px] font-medium text-[var(--text)]">{item.name}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 hidden text-[13px] text-[var(--text-3)] sm:block">
        Tip: press <kbd className={styles.kbd}>1</kbd> to <kbd className={styles.kbd}>6</kbd> to switch.
      </p>

      <div
        id="assistant-panel"
        role="tabpanel"
        aria-labelledby={`key-${assistant.family}`}
        style={{ '--key': assistant.colorVar } as CSSProperties}
        className={cn(styles.panel, styles.panelQuiet, 'mt-8 grid gap-10 p-6 sm:p-9 lg:grid-cols-[1fr_1.1fr]')}
      >
        <div key={assistant.family} className={styles.swap}>
          <h3 className="flex items-center gap-3 text-[clamp(2rem,4vw,2.75rem)] font-[560] tracking-[-0.035em]">
            <span
              aria-hidden
              className="flex size-10 items-center justify-center rounded-xl"
              style={{ background: `color-mix(in oklab, ${assistant.colorVar} 16%, transparent)`, color: assistant.colorVar }}
            >
              <ModeIcon mode={assistant.mode} size="md" />
            </span>
            {assistant.name}
          </h3>
          <p className="mt-4 max-w-md text-[17px] leading-7 text-[var(--text)]">{copy.helperText}</p>
          <ul className="mt-6 space-y-2.5">
            {page.bestFor.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] leading-6 text-[var(--text-2)]">
                <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-[var(--key)]" />
                {item}
              </li>
            ))}
          </ul>
          <Link href={`/${assistant.family}`} className={cn(styles.textLink, 'mt-8 inline-flex items-center gap-1.5 text-[14px]')}>
            More about {assistant.name}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div key={`${assistant.family}-prompts`} className={cn(styles.swap, 'space-y-2.5 lg:pt-1')}>
          <p className="text-[13px] text-[var(--text-3)]">Try asking</p>
          {copy.suggestedPrompts.slice(0, 3).map((prompt, index) => (
            <p
              key={prompt}
              style={{ '--d': `${index * 70}ms` } as CSSProperties}
              className={cn(styles.promptRow, 'rounded-xl border border-[var(--line)] bg-white/[0.02] px-4 py-3 text-[15px] leading-6 text-[var(--text)]')}
            >
              {prompt}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

const WORDMARK = 'Zenquanta'.split('')

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const startRef = useRef<HTMLElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const identifierRef = useRef<HTMLInputElement>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-up')
  const [navSolid, setNavSolid] = useState(false)
  const [demo, setDemo] = useState(0)
  const [manualPick, setManualPick] = useState(false)
  const reducedMotion = useReducedMotion()
  const heroPlaying = useInView(frameRef)

  useRevealOnScroll(rootRef)
  useBuddySpot(heroRef, demo, 'Hi. Six faces, six assistants. Tap me to meet one.')
  useBuddySpot(startRef, null, 'No email needed. Just an ID and a password.')

  useEffect(() => {
    let solid: boolean | null = null
    const onScroll = () => {
      const next = window.scrollY > 8
      if (next === solid) return
      solid = next
      setNavSolid(next)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // The product window starts tipped back and settles flat as you scroll,
  // and leans a few degrees toward the pointer. Both go into one transform
  // written straight on the element: one composited layer moves and nothing
  // beneath it is restyled.
  const tilt = useRef({ scroll: 0, x: 0, y: 0, toX: 0, toY: 0, frame: 0 })
  const paintTilt = useCallback(() => {
    const element = tiltRef.current
    if (!element) return
    const { scroll, x, y } = tilt.current
    element.style.transform = `perspective(1800px) rotateX(${(scroll * 12 - y * 2.2).toFixed(2)}deg) rotateY(${(x * 2.8).toFixed(2)}deg) scale(${(1 - scroll * 0.05).toFixed(4)})`
  }, [])
  const onTilt = useCallback(
    (progress: number) => {
      tilt.current.scroll = reducedMotion ? 0 : 1 - progress
      paintTilt()
    },
    [reducedMotion, paintTilt]
  )
  useScrollProgress(frameRef, onTilt, { start: 0.8, end: 0.12 })

  useEffect(() => {
    const hero = heroRef.current
    if (!hero || reducedMotion) return
    const state = tilt.current
    const ease = () => {
      state.frame = 0
      state.x += (state.toX - state.x) * 0.08
      state.y += (state.toY - state.y) * 0.08
      paintTilt()
      if (Math.abs(state.toX - state.x) + Math.abs(state.toY - state.y) > 0.002) state.frame = requestAnimationFrame(ease)
    }
    const aim = (x: number, y: number) => {
      state.toX = x
      state.toY = y
      if (!state.frame) state.frame = requestAnimationFrame(ease)
    }
    const onMove = (event: PointerEvent) => {
      const rect = frameRef.current?.getBoundingClientRect()
      if (event.pointerType !== 'mouse' || !rect) return
      aim(
        Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2))),
        Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)))
      )
    }
    const onLeave = () => aim(0, 0)
    hero.addEventListener('pointermove', onMove, { passive: true })
    hero.addEventListener('pointerleave', onLeave)
    return () => {
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(state.frame)
      state.frame = 0
    }
  }, [reducedMotion, paintTilt])

  const nextDemo = useCallback(() => {
    setManualPick(false)
    setDemo((current) => (current + 1) % ASSISTANTS.length)
  }, [])

  function pickDemo(index: number) {
    setManualPick(true)
    setDemo(index)
  }

  function goStart(mode: AuthMode) {
    setAuthMode(mode)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('start')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    identifierRef.current?.focus({ preventScroll: true })
  }

  const hue = ASSISTANTS[demo].hex

  return (
    <div ref={rootRef} className={cn(styles.root, 'min-h-screen overflow-x-clip')}>
      <a
        href="#start"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to sign up
      </a>

      <header className={cn(styles.nav, navSolid && styles.navSolid, 'fixed inset-x-0 top-0 z-40')}>
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-[75rem] items-center gap-6 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <ZenquantaLogo className="size-7 rounded-md" />
            <span className="text-[15px] font-medium tracking-[-0.01em]">Zenquanta</span>
          </Link>
          <div className="hidden items-center gap-1 text-[13.5px] md:flex">
            <a href="#assistants" className={styles.navLink}>Assistants</a>
            <a href="#workspace" className={styles.navLink}>Workspace</a>
            <a href="#plans" className={styles.navLink}>Plans</a>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => goStart('sign-in')} className={styles.navLink}>
              Sign in
            </button>
            <button type="button" onClick={() => goStart('sign-up')} className={cn(styles.buttonPrimary, styles.buttonSmall)}>
              Start free
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section
          ref={heroRef}
          aria-labelledby="hero-heading"
          className={cn(styles.hero, 'relative pt-32 sm:pt-40')}
          style={{ '--hue': hue } as CSSProperties}
        >
          <HeroGlow hue={hue} />
          <div className="relative mx-auto max-w-[75rem] px-5 sm:px-8">
            <h1 id="hero-heading" className={styles.h1}>
              <span className={styles.enter} style={{ '--delay': '60ms' } as CSSProperties}>
                Six AI specialists.
              </span>
              <br />
              <span className={cn(styles.enter, 'text-[var(--text-2)]')} style={{ '--delay': '160ms' } as CSSProperties}>
                One workspace.
              </span>
            </h1>
            <div className="mt-7 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className={styles.enter} style={{ '--delay': '260ms' } as CSSProperties}>
                <p className="max-w-[34rem] text-[17px] leading-7 text-[var(--text-2)] sm:text-[18px]">
                  Everyday help, writing, careful thinking, code, live research and pictures, in one
                  app. Pick the right assistant for the job and your chats, files and memory come along.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => goStart('sign-up')} className={styles.buttonPrimary}>
                    Start free
                  </button>
                  <a href="#assistants" className={styles.buttonGhost}>
                    Meet the six
                  </a>
                </div>
                <p className="mt-5 text-[13.5px] text-[var(--text-3)]">
                  Free plan with all six. Sign up with an ID and a password, no email.
                </p>
              </div>

              <div className={styles.enter} style={{ '--delay': '360ms' } as CSSProperties}>
                <p className="mb-2.5 text-[12.5px] text-[var(--text-3)]">Now playing</p>
                <div role="group" aria-label="Example chats" className="flex flex-wrap gap-1.5">
                  {ASSISTANTS.map((assistant, index) => (
                    <button
                      key={assistant.family}
                      type="button"
                      aria-pressed={demo === index}
                      onClick={() => pickDemo(index)}
                      data-buddy-face={index}
                      style={{ '--key': assistant.colorVar } as CSSProperties}
                      className={styles.chip}
                    >
                      <span aria-hidden className="size-1.5 rounded-full bg-[var(--key)]" />
                      {assistant.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div ref={frameRef} data-loop className={cn(styles.frame, styles.enter, 'mt-14 sm:mt-20')} style={{ '--delay': '480ms' } as CSSProperties}>
              <div aria-hidden className={styles.frameFade} />
              <div ref={tiltRef} className={styles.tilt}>
                <HeroDemo
                  active={demo}
                  playing={heroPlaying}
                  reducedMotion={reducedMotion}
                  holdMs={manualPick ? 9000 : 3200}
                  onNext={nextDemo}
                />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="What Zenquanta is" className="mx-auto max-w-[75rem] px-5 pt-24 pb-32 sm:px-8 sm:pt-32 sm:pb-44">
          <Statement />
        </section>

        <section id="assistants" aria-labelledby="assistants-heading" className={cn(styles.band, 'scroll-mt-16 py-24 sm:py-32')}>
          <div className="mx-auto max-w-[75rem] px-5 sm:px-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 id="assistants-heading" data-reveal className={styles.h2}>
                The right mind
                <br />
                for each job.
              </h2>
              <p data-reveal style={{ '--delay': '80ms' } as CSSProperties} className="max-w-md text-[17px] leading-7 text-[var(--text-2)] lg:justify-self-end">
                Each assistant is tuned for a different kind of work. Pick one in the composer, or let
                Zenquanta suggest a better fit when your question calls for it.
              </p>
            </div>
            <div data-reveal style={{ '--delay': '120ms' } as CSSProperties} className="mt-14">
              <AssistantKeys />
            </div>
          </div>
          <div data-reveal className="mt-20 sm:mt-24">
            <Marquee />
          </div>
        </section>

        <section id="workspace" aria-labelledby="workspace-heading" className="scroll-mt-16 py-24 sm:py-36">
          <div className="mx-auto max-w-[75rem] px-5 sm:px-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 id="workspace-heading" data-reveal className={styles.h2}>
                Everything stays
                <br />
                in one place.
              </h2>
              <p data-reveal style={{ '--delay': '80ms' } as CSSProperties} className="max-w-md text-[17px] leading-7 text-[var(--text-2)] lg:justify-self-end">
                Start a plan with Nova, hand it to Forge, ask Pulse to check the facts. Every assistant
                works from the same chats, projects, files and memory.
              </p>
            </div>
            <div className="mt-14">
              <WorkspaceTiles />
            </div>
          </div>
        </section>

        <section id="tone" aria-labelledby="tone-heading" className={cn(styles.band, 'scroll-mt-16 overflow-clip py-24 sm:py-32')}>
          <div className="mx-auto max-w-[75rem] px-5 sm:px-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 id="tone-heading" data-reveal className={styles.h2}>
                Same question.
                <br />
                Your kind of answer.
              </h2>
              <p data-reveal style={{ '--delay': '80ms' } as CSSProperties} className="max-w-md text-[17px] leading-7 text-[var(--text-2)] lg:justify-self-end">
                Every chat has a tone preset and a temperature. Turn it down for precise answers, up for
                creative ones. Change them for one chat, or set your defaults in Settings.
              </p>
            </div>
            <div data-reveal style={{ '--delay': '120ms' } as CSSProperties} className="mt-14">
              <ToneDemo />
            </div>
          </div>
        </section>

        <section aria-labelledby="die-heading" className="py-24 sm:py-32">
          <div className="mx-auto max-w-[75rem] px-5 sm:px-8" data-reveal>
            <span id="die-heading" className="sr-only">Roll for an assistant</span>
            <DieAccent onStart={() => goStart('sign-up')} />
          </div>
        </section>

        <section id="plans" aria-labelledby="plans-heading" className="scroll-mt-16 py-24 sm:py-36">
          <div className="mx-auto max-w-[75rem] px-5 sm:px-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <h2 id="plans-heading" data-reveal className={styles.h2}>
                Free to start.
                <br />
                Clear about limits.
              </h2>
              <p data-reveal style={{ '--delay': '80ms' } as CSSProperties} className="max-w-md text-[17px] leading-7 text-[var(--text-2)] lg:justify-self-end">
                Every account starts on Free with all six assistants. Need more? Request a plan from
                inside the app and the team switches it on. No card, no checkout.
              </p>
            </div>

            <div data-reveal style={{ '--delay': '120ms' } as CSSProperties} className={cn(styles.plans, 'mt-14')}>
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Plans and their daily limits</caption>
                <thead>
                  <tr className="text-[12.5px] text-[var(--text-3)]">
                    <th scope="col" className="px-4 pt-5 pb-3 font-normal sm:px-6">Plan</th>
                    <th scope="col" className="px-4 pt-5 pb-3 font-normal sm:px-6">Per month</th>
                    <th scope="col" className="px-4 pt-5 pb-3 font-normal sm:px-6">Messages a day</th>
                    <th scope="col" className="px-4 pt-5 pb-3 font-normal sm:px-6">Images a day</th>
                    <th scope="col" className="hidden px-6 pt-5 pb-3 font-normal md:table-cell">Assistants</th>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map((tier) => {
                    const plan = PLAN_CONFIGS[tier]
                    return (
                      <tr key={tier} className={cn(styles.planRow, tier === 'free' && styles.planFree)}>
                        <th scope="row" className="px-4 py-4 text-[15px] font-medium sm:px-6">
                          {TIER_LABEL[tier]}
                          <span className="block text-[12px] font-normal text-[var(--text-3)] md:hidden">
                            {assistantLevel(tier)}
                          </span>
                        </th>
                        <td className="px-4 py-4 text-[17px] font-[520] tracking-[-0.01em] sm:px-6">
                          <CountUp value={plan.priceUsd} prefix="$" />
                        </td>
                        <td className="px-4 py-4 text-[15px] text-[var(--text-2)] sm:px-6">
                          <CountUp value={plan.dailyMessageLimit} />
                        </td>
                        <td className="px-4 py-4 text-[15px] text-[var(--text-2)] sm:px-6">
                          <CountUp value={plan.maxImagesPerDay} />
                        </td>
                        <td className="hidden px-6 py-4 text-[15px] text-[var(--text-2)] md:table-cell">
                          All six, {assistantLevel(tier)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-[13.5px] text-[var(--text-3)]">
              Prices in US dollars. Higher plans unlock stronger versions of each assistant.{' '}
              <Link href="/pricing" className={styles.textLink}>
                See every plan detail
              </Link>
            </p>
          </div>
        </section>

        <section ref={startRef} id="start" aria-labelledby="start-heading" className={cn(styles.band, styles.startBand, 'scroll-mt-16 py-24 sm:py-36')}>
          <div className="mx-auto grid max-w-[75rem] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_minmax(0,27rem)] lg:gap-24">
            <div data-reveal>
              <h2 id="start-heading" className={styles.h2}>
                Start in under
                <br />
                a minute.
              </h2>
              <p className="mt-6 max-w-md text-[17px] leading-7 text-[var(--text-2)]">
                Pick an ID and a password. That is the whole sign-up. You land in your workspace with all
                six assistants, ready for your first chat.
              </p>
              <ul className="mt-9 space-y-3.5 text-[15px]">
                {['No email and no card needed', 'All six assistants on the Free plan', 'Your chats are saved to your account'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[var(--text)]">
                    <span aria-hidden className="h-px w-4 bg-[var(--text-3)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal style={{ '--delay': '100ms' } as CSSProperties}>
              <LandingAuthForm mode={authMode} onModeChange={setAuthMode} identifierRef={identifierRef} />
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden border-t border-[var(--line)] pt-16">
        <div className="mx-auto flex max-w-[75rem] flex-col gap-10 px-5 sm:flex-row sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5">
            <ZenquantaLogo className="size-7 rounded-md" />
            <span className="text-[15px] font-medium">Zenquanta AI</span>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-[14px]">
            <div className="space-y-3">
              <p className="text-[13px] text-[var(--text-3)]">Assistants</p>
              {ASSISTANTS.map((assistant) => (
                <Link
                  key={assistant.family}
                  href={`/${assistant.family}`}
                  data-buddy-face={ASSISTANTS.indexOf(assistant)}
                  className={cn(styles.footerLink, 'block')}
                >
                  {assistant.name}
                </Link>
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-[13px] text-[var(--text-3)]">Product</p>
              <Link href="/pricing" className={cn(styles.footerLink, 'block')}>
                Plans
              </Link>
              <button type="button" onClick={() => goStart('sign-in')} className={cn(styles.footerLink, 'block')}>
                Sign in
              </button>
              <button type="button" onClick={() => goStart('sign-up')} className={cn(styles.footerLink, 'block')}>
                Create an account
              </button>
            </div>
          </div>
        </div>
        {/* Each letter is a small block: point at one and it tips forward to
            show its top, in an assistant's colour, then rights itself. */}
        <p aria-hidden className={styles.wordmark}>
          {WORDMARK.map((letter, index) => (
            <span
              key={index}
              data-buddy-face={index % ASSISTANTS.length}
              style={{ '--key': ASSISTANTS[index % ASSISTANTS.length].colorVar } as CSSProperties}
              className={styles.flip}
            >
              <span className={styles.flipBox}>
                <span className={styles.flipFront}>{letter}</span>
                <span className={styles.flipTop}>{letter}</span>
              </span>
            </span>
          ))}
        </p>
        <div aria-hidden className={styles.wordmarkFade} />
      </footer>

      <PageBuddy />
    </div>
  )
}

export default LandingPage
