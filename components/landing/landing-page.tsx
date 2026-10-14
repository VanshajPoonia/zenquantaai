'use client'

import Link from 'next/link'
import { Bagel_Fat_One } from 'next/font/google'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { ASSISTANT_FAMILY_COPY, PLAN_CONFIGS, TIER_ASSISTANT_NAMES } from '@/lib/config'
import { ZenquantaLogo } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { AssistantFamily, SubscriptionTier } from '@/types'
import type { DieDirection, DieScene, InsideFace } from './die-scene'
import { LandingAuthForm, type AuthMode } from './landing-auth-form'
import { PipFace } from './pip-face'
import styles from './landing.module.css'

const toy = Bagel_Fat_One({ subsets: ['latin'], weight: '400', variable: '--font-toy' })

// Face i of the die carries i + 1 pips and one assistant. The hex values are
// the app's assistant accents (globals.css) converted for canvas painting.
const FACES: {
  family: AssistantFamily
  name: string
  job: string
  colorVar: string
  hex: string
}[] = [
  { family: 'nova', name: 'Nova', job: 'Everyday help. Plans, summaries, recommendations and straight answers.', colorVar: 'var(--general)', hex: '#00cdc5' },
  { family: 'velora', name: 'Velora', job: 'Writing with flair. Stories, names, brand voice and polished copy.', colorVar: 'var(--creative)', hex: '#da6fd3' },
  { family: 'axiom', name: 'Axiom', job: 'Careful thinking. Comparisons, decisions and step-by-step reasoning.', colorVar: 'var(--logic)', hex: '#0091ff' },
  { family: 'forge', name: 'Forge', job: 'Code. Builds features, fixes bugs and explains how things work.', colorVar: 'var(--code)', hex: '#30bd44' },
  { family: 'pulse', name: 'Pulse', job: 'Live research. Searches the web and shows where answers came from.', colorVar: 'var(--live)', hex: '#00b9f8' },
  { family: 'prism', name: 'Prism', job: 'Pictures. Describe an image and Prism makes it.', colorVar: 'var(--image)', hex: '#ff8455' },
]

const RESULT_LINE: Record<AssistantFamily, string> = {
  nova: 'for everyday help',
  velora: 'for writing',
  axiom: 'for careful thinking',
  forge: 'for code',
  pulse: 'for live research',
  prism: 'for pictures',
}

// What is printed inside the die, keyed by the pips on the outside.
const ICONS = {
  chats: ['M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z'],
  projects: ['M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'],
  files: [
    'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
    'M14 2v5a1 1 0 0 0 1 1h5',
    'M10 9H8',
    'M16 13H8',
    'M16 17H8',
  ],
  memory: [
    'M12 18V5',
    'M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4',
    'M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5',
    'M17.997 5.125a4 4 0 0 1 2.526 5.77',
    'M18 18a4 4 0 0 0 2-7.464',
    'M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517',
    'M6 18a4 4 0 0 1-2-7.464',
    'M6.003 5.125a4 4 0 0 0-2.526 5.77',
  ],
  playbooks: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
}

const INSIDE: Record<number, InsideFace> = {
  6: { title: 'Workspace', line: 'Shared by all six', icon: 'logo' },
  5: { title: 'Projects', line: 'Work kept together', icon: ICONS.projects },
  4: { title: 'Chats', line: 'Saved to your account', icon: ICONS.chats },
  3: { title: 'Files', line: 'Ask your uploads', icon: ICONS.files },
  2: { title: 'Memory', line: 'Remembers the thread', icon: ICONS.memory },
  1: { title: 'Playbooks', line: 'Repeat the good runs', icon: ICONS.playbooks },
}

const SHARED = [
  { title: 'Chats', text: 'Every conversation is saved to your account, so it is there on any device.' },
  { title: 'Projects', text: 'Keep the chats and files for one piece of work together.' },
  { title: 'Files', text: 'Upload documents and code, then ask questions about them.' },
  { title: 'Memory', text: 'Zenquanta keeps the key points of a long chat in mind.' },
  { title: 'Playbooks', text: 'Save a run of prompts and play it again with one click.' },
]

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

function formatCount(value: number) {
  return value.toLocaleString('en-US')
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export function LandingPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('sign-up')
  const [heroFace, setHeroFace] = useState<number | null>(null)
  const [wasPicked, setWasPicked] = useState(false)
  const [activeCard, setActiveCard] = useState(-1)
  const [padFlat, setPadFlat] = useState(false)
  const [navSolid, setNavSolid] = useState(false)
  const [sceneState, setSceneState] = useState<'loading' | 'ready' | 'failed'>('loading')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const facesRef = useRef<HTMLElement>(null)
  const unfoldRef = useRef<HTMLElement>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLLIElement | null)[]>([])
  const identifierRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<DieScene | null>(null)
  const activeCardRef = useRef(-1)

  // Read every frame by the scene: where the die sits and what it shows.
  const direct = useCallback((): DieDirection => {
    const vh = window.innerHeight
    const compact = window.innerWidth < 1024
    const facesTop = facesRef.current?.getBoundingClientRect().top ?? Infinity
    const firstCardTop = cardRefs.current[0]?.firstElementChild?.getBoundingClientRect().top ?? Infinity
    const unfoldRect = unfoldRef.current?.getBoundingClientRect()
    const heroScrolled = Math.max(0, -(heroRef.current?.getBoundingClientRect().top ?? 0))

    // On phones the die sits above the text, so it waits until the first card
    // arrives instead of hovering over the section heading.
    let mode: DieDirection['mode'] = 'hero'
    if (compact ? firstCardTop < vh * 0.47 : facesTop < vh * 0.55) mode = 'faces'
    if (unfoldRect && unfoldRect.top < vh * 0.45) mode = 'unfold'

    // The card nearest the reading line decides the face.
    const line = vh * (compact ? 0.72 : 0.5)
    let face = 0
    let best = Infinity
    cardRefs.current.forEach((card, index) => {
      if (!card) return
      const rect = card.getBoundingClientRect()
      const distance = Math.abs(rect.top + rect.height / 2 - line)
      if (distance < best) {
        best = distance
        face = index
      }
    })
    const nextActive = mode === 'faces' ? face : -1
    if (nextActive !== activeCardRef.current) {
      activeCardRef.current = nextActive
      setActiveCard(nextActive)
    }

    let fold = 1
    if (unfoldRect) {
      const progress = clamp(-unfoldRect.top / Math.max(1, unfoldRect.height - vh))
      fold = 1 - smoothstep(0.08, 0.62, progress)
    }

    const anchor = compact
      ? mode === 'hero'
        ? { x: 0, y: 0.3 + (heroScrolled / vh) * 2 }
        : mode === 'faces'
          ? { x: 0, y: 0.5 }
          : { x: 0, y: 0.36 }
      : mode === 'hero'
        ? { x: 0.46, y: -0.08 }
        : mode === 'faces'
          ? { x: 0.48, y: -0.06 }
          : { x: 0.42, y: -0.02 }

    return { mode, anchor, face, fold, compact }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let scene: DieScene | null = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const probe = document.createElement('canvas')
    const supported = Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'))
    if (!supported) {
      setSceneState('failed')
      setHeroFace(0)
      return
    }

    const bodyFont = getComputedStyle(document.body).fontFamily
    import('./die-scene')
      .then(({ createDieScene }) =>
        createDieScene({
          canvas,
          faceColors: FACES.map((face) => face.hex),
          ink: '#0c1f18',
          bone: '#f5f2e5',
          feltShadow: '#04170f',
          inside: INSIDE,
          fonts: { display: toy.style.fontFamily, body: bodyFont },
          logoUrl: '/file.svg',
          reducedMotion,
          direct,
          onSettle: (face) => setHeroFace(face),
        })
      )
      .then((created) => {
        if (disposed) {
          created.dispose()
          return
        }
        scene = created
        sceneRef.current = created
        setSceneState('ready')
      })
      .catch(() => {
        if (disposed) return
        setSceneState('failed')
        setHeroFace(0)
      })

    // Only draw while the stage is on screen.
    const observer = new IntersectionObserver(([entry]) => {
      sceneRef.current?.setActive(entry.isIntersecting && !document.hidden)
    })
    if (stageRef.current) observer.observe(stageRef.current)
    const onVisibility = () => sceneRef.current?.setActive(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      scene?.dispose()
      sceneRef.current = null
    }
  }, [direct])

  // The fallback has no scene to read the page, so cards follow scroll here.
  useEffect(() => {
    if (sceneState !== 'failed') return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => direct())
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [direct, sceneState])

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const pad = padRef.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPadFlat(true)
      },
      { threshold: 0.35 }
    )
    if (pad) observer.observe(pad)

    return () => {
      window.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

  function roll() {
    setWasPicked(false)
    if (sceneRef.current) {
      sceneRef.current.roll()
    } else {
      setHeroFace((face) => ((face ?? 0) + 1 + Math.floor(Math.random() * 5)) % 6)
    }
  }

  function pickFace(face: number) {
    setWasPicked(true)
    if (sceneRef.current) sceneRef.current.showFace(face)
    else setHeroFace(face)
  }

  function goPlay(mode: AuthMode) {
    setAuthMode(mode)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('play')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    identifierRef.current?.focus({ preventScroll: true })
  }

  function onDiePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!sceneRef.current || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    sceneRef.current.dragStart(event.clientX, event.clientY)
  }

  const rolled = heroFace === null ? null : FACES[heroFace]

  return (
    <div className={cn(styles.root, toy.variable, 'min-h-screen')}>
      <a
        href="#play"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-[var(--signal)] focus:px-4 focus:py-2 focus:text-[var(--ink)]"
      >
        Skip to sign up
      </a>

      <header
        className={cn(
          styles.navBar,
          navSolid && styles.navBarSolid,
          'fixed inset-x-0 top-0 z-40'
        )}
      >
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <ZenquantaLogo className="size-8 rounded-lg" />
            <span className="text-base font-semibold tracking-tight">Zenquanta AI</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#plans" className="hidden px-3 py-2 text-sm font-medium text-[var(--felt-text)] hover:text-[var(--bone)] md:inline">
              Plans
            </a>
            <button
              type="button"
              onClick={() => goPlay('sign-in')}
              className="rounded-full px-3 py-2 text-sm font-medium text-[var(--felt-text)] hover:text-[var(--bone)]"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => goPlay('sign-up')}
              className={cn(styles.token, 'min-h-10 px-4 text-sm sm:min-h-11 sm:px-5')}
            >
              Start free
            </button>
          </div>
        </nav>
      </header>

      <main>
        <div ref={stageRef} className={cn(styles.felt, 'relative')}>
          {/* The die lives on one canvas that stays in view across the stage. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="sticky top-0 h-svh w-full">
              <canvas
                ref={canvasRef}
                className={cn(
                  'h-full w-full transition-opacity duration-700',
                  sceneState === 'ready' ? 'opacity-100' : 'opacity-0'
                )}
              />
            </div>
          </div>

          <section ref={heroRef} aria-labelledby="hero-heading" className="relative">
            <div className="mx-auto grid min-h-svh max-w-7xl grid-rows-[1fr_auto] px-4 pt-20 pb-10 sm:px-8 lg:grid-cols-2 lg:grid-rows-1 lg:items-center lg:gap-10 lg:pt-24">
              <div className="relative row-start-2 max-w-xl lg:row-start-1">
                <h1 id="hero-heading" className={cn(styles.display, 'text-[clamp(3.4rem,9vw,6rem)] leading-[0.9]')}>
                  One app.
                  <br />
                  Six sides.
                </h1>
                <p className="mt-6 max-w-[34rem] text-lg leading-8 text-[var(--felt-text)] sm:text-xl sm:leading-9">
                  Zenquanta AI puts six AI specialists in one place: everyday help, writing,
                  careful thinking, code, live research and pictures. Each side of the die is
                  one of them. Roll it to say hello.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => goPlay('sign-up')} className={styles.token}>
                    Start free
                  </button>
                  <button type="button" onClick={roll} className={styles.tokenGhost}>
                    <PipFace pips={5} color="var(--bone)" className="size-5" />
                    Roll the die
                  </button>
                </div>
                <p className="mt-5 text-sm text-[var(--felt-text)]">
                  Free plan with all six. Sign up with an ID and a password, no email.
                </p>
              </div>

              <div className="relative row-start-1 flex min-h-[46svh] flex-col items-center justify-end lg:min-h-[70svh]">
                <button
                  type="button"
                  aria-label="Roll the die"
                  onPointerDown={onDiePointerDown}
                  onPointerMove={(event) => sceneRef.current?.dragMove(event.clientX, event.clientY)}
                  onPointerUp={() => sceneRef.current?.dragEnd()}
                  onPointerCancel={() => sceneRef.current?.dragEnd()}
                  onClick={(event) => {
                    // Pointer clicks already rolled through dragEnd.
                    if (event.detail === 0 || !sceneRef.current) roll()
                  }}
                  className="absolute inset-x-0 top-0 bottom-28 cursor-grab touch-pan-y rounded-[40px] active:cursor-grabbing"
                />

                {sceneState === 'failed' && rolled && (
                  <div className="pointer-events-none absolute inset-x-0 top-[12%] flex justify-center">
                    <PipFace pips={(heroFace ?? 0) + 1} color={rolled.colorVar} className="size-44 rotate-[-8deg] drop-shadow-[0_30px_30px_rgb(0_0_0_/_0.5)] sm:size-56" />
                  </div>
                )}

                <div className="relative flex flex-col items-center gap-4 pb-2">
                  <p aria-live="polite" className="min-h-7 text-center text-base text-[var(--felt-text)]">
                    {rolled ? (
                      <>
                        {wasPicked ? 'Side' : 'You rolled a'} {(heroFace ?? 0) + 1}:{' '}
                        <span className="font-semibold text-[var(--bone)]">{rolled.name}</span>, {RESULT_LINE[rolled.family]}.
                      </>
                    ) : (
                      'Rolling…'
                    )}
                  </p>
                  <div role="group" aria-label="Pick a side" className="flex gap-2 sm:gap-2.5">
                    {FACES.map((face, index) => (
                      <button
                        key={face.family}
                        type="button"
                        aria-label={`Show ${face.name}`}
                        aria-pressed={heroFace === index}
                        onClick={() => pickFace(index)}
                        className={cn(styles.pipButton, 'size-10 sm:size-11')}
                      >
                        <PipFace pips={index + 1} color={face.colorVar} className="size-full" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section ref={facesRef} aria-labelledby="faces-heading" className="relative pb-[20svh]">
            <div className="mx-auto max-w-7xl px-4 sm:px-8">
              <div className="lg:w-1/2 lg:pr-10">
                <h2 id="faces-heading" className={cn(styles.display, 'pt-16 text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.95] lg:pt-24')}>
                  Every side is a specialist.
                </h2>
                <p className="mt-5 max-w-md text-lg leading-8 text-[var(--felt-text)]">
                  Pick the one that fits the job, or switch halfway through a chat. Here is who you get.
                </p>
              </div>

              <ol className="mt-[26svh] lg:mt-[8svh] lg:w-1/2 lg:pr-10">
                {FACES.map((face, index) => {
                  const prompts = ASSISTANT_FAMILY_COPY[face.family].suggestedPrompts.slice(0, 2)
                  return (
                    <li
                      key={face.family}
                      ref={(node) => {
                        cardRefs.current[index] = node
                      }}
                      className="flex min-h-[78svh] items-center py-6 lg:min-h-[86svh]"
                    >
                      <article
                        aria-label={`Side ${index + 1}: ${face.name}`}
                        style={{ '--face': face.colorVar } as CSSProperties}
                        className={cn(styles.card, activeCard === index && styles.cardActive, 'w-full p-7 sm:p-9')}
                      >
                        <div className="flex items-center gap-4">
                          <PipFace pips={index + 1} color="rgb(255 255 255 / 0.55)" className="size-12 shrink-0 sm:size-14" />
                          <h3 className={cn(styles.display, 'text-5xl leading-none sm:text-6xl')}>{face.name}</h3>
                        </div>
                        <p className="mt-5 text-xl leading-8 font-medium">{face.job}</p>
                        <div className="mt-6 space-y-2.5">
                          {prompts.map((prompt) => (
                            <p key={prompt} className={cn(styles.bubble, 'w-fit max-w-full px-4 py-2.5 text-[15px] leading-6')}>
                              {prompt}
                            </p>
                          ))}
                        </div>
                        <Link href={`/${face.family}`} className={cn(styles.cardLink, 'mt-6 inline-block text-sm font-semibold')}>
                          More about {face.name}
                        </Link>
                      </article>
                    </li>
                  )
                })}
              </ol>
            </div>
          </section>

          <section ref={unfoldRef} aria-labelledby="unfold-heading" className="relative h-[250svh]">
            <div className="sticky top-0 flex h-svh items-end lg:items-center">
              <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-8 lg:pb-0">
                <div className="max-w-md">
                  <h2 id="unfold-heading" className={cn(styles.display, 'text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.95]')}>
                    Six sides. One inside.
                  </h2>
                  <p className="mt-5 text-lg leading-8 text-[var(--felt-text)]">
                    Open the die and every side wraps the same workspace. Start a plan with Nova,
                    hand it to Forge, ask Pulse to check the facts. Your chat, your files and what
                    Zenquanta remembers come along.
                  </p>
                  <ul className="mt-7 hidden space-y-3 lg:block">
                    {SHARED.map((item) => (
                      <li key={item.title} className="flex gap-3 text-base leading-7">
                        <span aria-hidden className="mt-2.5 size-2 shrink-0 rounded-full bg-[var(--signal)]" />
                        <span>
                          <span className="font-semibold text-[var(--bone)]">{item.title}.</span>{' '}
                          <span className="text-[var(--felt-text)]">{item.text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <ul className="sr-only lg:hidden">
                    {SHARED.map((item) => (
                      <li key={item.title}>
                        {item.title}. {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section id="plans" aria-labelledby="plans-heading" className={cn(styles.feltDeep, 'scroll-mt-24 px-4 py-24 sm:px-8 sm:py-32')}>
          <div className="mx-auto max-w-5xl">
            <h2 id="plans-heading" className={cn(styles.display, 'max-w-3xl text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[0.95]')}>
              Free to play. Go bigger when you want.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--felt-text)]">
              Every account starts on Free with all six assistants. Need more? Request a plan from
              inside the app and the team switches it on. Higher plans unlock stronger versions of
              each assistant.
            </p>

            <div ref={padRef} className={cn(styles.pad, padFlat && styles.padFlat, 'mt-12 overflow-hidden')}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Plans and their daily limits</caption>
                  <thead>
                    <tr className={cn(styles.display, 'align-bottom text-base leading-tight sm:text-xl')}>
                      <th scope="col" className="px-3 pt-5 pb-3 font-normal sm:px-5 sm:pt-6 sm:pb-4">Plan</th>
                      <th scope="col" className="px-3 pt-5 pb-3 font-normal sm:px-5 sm:pt-6 sm:pb-4">A month</th>
                      <th scope="col" className="px-3 pt-5 pb-3 font-normal sm:px-5 sm:pt-6 sm:pb-4">Messages a day</th>
                      <th scope="col" className="px-3 pt-5 pb-3 font-normal sm:px-5 sm:pt-6 sm:pb-4">Images a day</th>
                      <th scope="col" className="hidden px-5 pt-6 pb-4 font-normal sm:table-cell">Assistants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIERS.map((tier) => {
                      const plan = PLAN_CONFIGS[tier]
                      return (
                        <tr key={tier} className={cn(tier === 'free' && styles.padFree)}>
                          <th scope="row" className="px-3 py-3.5 text-base font-semibold sm:px-5 sm:py-4">
                            {TIER_LABEL[tier]}
                            <span className="block text-xs font-normal text-[rgb(12_31_24_/_0.7)] sm:hidden">
                              {assistantLevel(tier)}
                            </span>
                          </th>
                          <td className={cn(styles.numbers, 'px-3 py-3.5 text-base sm:px-5 sm:py-4 sm:text-lg')}>${plan.priceUsd}</td>
                          <td className={cn(styles.numbers, 'px-3 py-3.5 text-base sm:px-5 sm:py-4 sm:text-lg')}>{formatCount(plan.dailyMessageLimit)}</td>
                          <td className={cn(styles.numbers, 'px-3 py-3.5 text-base sm:px-5 sm:py-4 sm:text-lg')}>{formatCount(plan.maxImagesPerDay)}</td>
                          <td className="hidden px-5 py-4 text-base sm:table-cell">All six, {assistantLevel(tier)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-6 text-sm text-[var(--felt-text)]">
              Prices in US dollars. <Link href="/pricing" className={styles.footerLink}>See every plan detail</Link>
            </p>
          </div>
        </section>

        <section id="play" aria-labelledby="play-heading" className={cn(styles.felt, 'scroll-mt-24 px-4 py-24 sm:px-8 sm:py-32')}>
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-20">
            <div>
              <h2 id="play-heading" className={cn(styles.display, 'text-[clamp(3rem,8vw,5.6rem)] leading-[0.9]')}>
                Your turn.
              </h2>
              <p className="mt-6 max-w-md text-lg leading-8 text-[var(--felt-text)]">
                Pick an ID and a password. That is the whole sign-up: no email, no card. You land
                in your workspace with all six assistants, ready for your first chat.
              </p>
              <div aria-hidden className="mt-10 hidden gap-3 lg:flex">
                {FACES.map((face, index) => (
                  <PipFace
                    key={face.family}
                    pips={index + 1}
                    color={face.colorVar}
                    className="size-12"
                  />
                ))}
              </div>
            </div>
            <LandingAuthForm mode={authMode} onModeChange={setAuthMode} identifierRef={identifierRef} />
          </div>
        </section>
      </main>

      <footer className={cn(styles.feltDeep, 'px-4 py-12 sm:px-8')}>
        <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <ZenquantaLogo className="size-7 rounded-md" />
            <span className="text-sm font-semibold">Zenquanta AI</span>
          </div>
          <nav aria-label="Assistants and plans" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {FACES.map((face) => (
              <Link key={face.family} href={`/${face.family}`} className={styles.footerLink}>
                {face.name}
              </Link>
            ))}
            <Link href="/pricing" className={styles.footerLink}>
              Plans
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
