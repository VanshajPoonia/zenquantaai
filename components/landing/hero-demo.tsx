'use client'

import { memo, useEffect, useState, type ReactNode } from 'react'
import {
  ArrowUp,
  BookOpen,
  Brain,
  ChevronDown,
  Copy,
  FileText,
  Globe,
  ImageIcon,
  Layers,
  Plus,
  SquarePen,
  ThumbsUp,
} from 'lucide-react'
import { useStableCallback } from '@/hooks/useStableCallback'
import { ASSISTANT_FAMILY_COPY } from '@/lib/config'
import { ModeIcon } from '@/lib/mode-utils'
import { ZenquantaLogo } from '@/components/icons'
import { cn } from '@/lib/utils'
import { ASSISTANTS } from './landing-data'
import { PrismArt } from './prism-art'
import styles from './landing.module.css'

type Token = [string, ('k' | 'f' | 's' | 'm')?]

type Unit =
  | { kind: 'p'; text: ReactNode }
  | { kind: 'li'; title: string; text: string }
  | { kind: 'tr'; cells: [string, string, string]; head?: boolean }
  | { kind: 'code'; tokens: Token[] }
  | { kind: 'status'; text: string }
  | { kind: 'sources'; items: string[] }
  | { kind: 'image' }

interface Scene {
  title: string
  prompt: string
  thinking: string
  units: Unit[]
}

const prompt = (index: number, which = 0) =>
  ASSISTANT_FAMILY_COPY[ASSISTANTS[index].family].suggestedPrompts[which]

// Example chats, one per assistant. The prompts are the app's own suggested
// prompts; the replies are written for this page and labelled as examples.
const SCENES: Scene[] = [
  {
    title: 'Kyoto, three slow days',
    prompt: prompt(0, 0),
    thinking: 'Thinking',
    units: [
      { kind: 'p', text: 'A slow version: one area a day, one big sight in the morning, long lunches.' },
      { kind: 'li', title: 'Day 1, Higashiyama', text: 'Kiyomizu-dera at opening, the lanes down to Gion, dinner on Pontocho.' },
      { kind: 'li', title: 'Day 2, Arashiyama', text: 'Bamboo grove before eight, Tenryu-ji garden, tofu lunch by the river.' },
      { kind: 'li', title: 'Day 3, Northern temples', text: 'Kinkaku-ji, then the quiet gardens of Daitoku-ji. Nishiki Market on the way back.' },
      { kind: 'p', text: 'Want travel times between each stop?' },
    ],
  },
  {
    title: 'Studio names',
    prompt: prompt(1, 2),
    thinking: 'Drafting',
    units: [
      { kind: 'p', text: 'Four directions, from quiet to bold:' },
      { kind: 'li', title: 'Northlight', text: 'Guidance, with a little poetry.' },
      { kind: 'li', title: 'Fieldwork', text: 'Strategy that starts with research.' },
      { kind: 'li', title: 'Second Draft', text: 'Honest about how good work happens.' },
      { kind: 'li', title: 'Halftone', text: 'The warmth of a print studio.' },
      { kind: 'p', text: 'My pick is Fieldwork. It sounds like a studio, not a startup.' },
    ],
  },
  {
    title: 'Seats or usage?',
    prompt: prompt(2, 0),
    thinking: 'Reasoning',
    units: [
      { kind: 'p', text: 'It comes down to how value grows for your customer.' },
      { kind: 'tr', head: true, cells: ['', 'Seat-based', 'Usage-based'] },
      { kind: 'tr', cells: ['Forecasting revenue', 'Easy', 'Harder'] },
      { kind: 'tr', cells: ['Grows with', 'Team size', 'Customer value'] },
      { kind: 'tr', cells: ['Buying friction', 'Low', 'Needs an estimate'] },
      { kind: 'p', text: 'If one power user gets most of the value, charge for usage. If value spreads across a team, seats are simpler to buy.' },
    ],
  },
  {
    title: 'Duplicate requests',
    prompt: prompt(3, 1),
    thinking: 'Reading the code',
    units: [
      { kind: 'p', text: 'In development, Strict Mode runs effects twice. Give the effect a cleanup that cancels the first request:' },
      { kind: 'code', tokens: [['useEffect', 'f'], ['(() => {']] },
      { kind: 'code', tokens: [['  '], ['const', 'k'], [' controller = '], ['new', 'k'], [' AbortController', 'f'], ['()']] },
      { kind: 'code', tokens: [['  '], ['fetch', 'f'], ['(url, { signal: controller.signal })']] },
      { kind: 'code', tokens: [['    .'], ['then', 'f'], ['(setData)']] },
      { kind: 'code', tokens: [['  '], ['return', 'k'], [' () => controller.'], ['abort', 'f'], ['()']] },
      { kind: 'code', tokens: [['}, [url])']] },
      { kind: 'p', text: 'Production builds run it once, so you only see this locally.' },
    ],
  },
  {
    title: 'Note-taking market scan',
    prompt: prompt(4, 0),
    thinking: 'Searching the web',
    units: [
      { kind: 'status', text: 'Searched the web, 3 sources' },
      { kind: 'p', text: 'Most tools compete on meeting capture: record, transcribe, summarize.' },
      { kind: 'li', title: 'Crowded', text: 'Meeting summaries and action items.' },
      { kind: 'li', title: 'Thinner', text: 'Notes linked to the projects and files they belong to.' },
      { kind: 'li', title: 'Open', text: 'A private, offline-first option for sensitive work.' },
      { kind: 'sources', items: ['Industry report', 'Product pages', 'User reviews'] },
    ],
  },
  {
    title: 'Rain-lit portrait',
    prompt: prompt(5, 0),
    thinking: 'Creating image',
    units: [{ kind: 'image' }, { kind: 'p', text: 'Here it is. Want a wider frame or warmer light?' }],
  },
]

const LIBRARY = [
  { label: 'Artifacts', icon: Layers },
  { label: 'Images', icon: ImageIcon },
  { label: 'Playbooks', icon: BookOpen },
  { label: 'Files', icon: FileText },
  { label: 'Memory', icon: Brain },
  { label: 'Research', icon: Globe },
]

type Phase = 'typing' | 'thinking' | 'streaming' | 'done'

function groupUnits(units: Unit[]) {
  const groups: { kind: Unit['kind']; units: Unit[]; start: number }[] = []
  units.forEach((unit, index) => {
    const last = groups[groups.length - 1]
    const groupable = unit.kind === 'li' || unit.kind === 'tr' || unit.kind === 'code'
    if (last && groupable && last.kind === unit.kind) last.units.push(unit)
    else groups.push({ kind: unit.kind, units: [unit], start: index })
  })
  return groups
}

function Reply({ units, shown }: { units: Unit[]; shown: number }) {
  return (
    <div className="space-y-2.5">
      {groupUnits(units).map((group) => {
        const visible = group.units.slice(0, Math.max(0, shown - group.start))
        if (visible.length === 0) return null
        const key = `${group.kind}-${group.start}`
        switch (group.kind) {
          case 'li':
            return (
              <ul key={key} className="space-y-1.5">
                {visible.map((unit) =>
                  unit.kind === 'li' ? (
                    <li key={unit.title} className={cn(styles.unit, 'flex gap-2.5')}>
                      <span aria-hidden className="mt-[0.55em] size-1 shrink-0 rounded-full bg-[var(--hue)]" />
                      <span>
                        <span className="font-medium text-[var(--text)]">{unit.title}.</span>{' '}
                        <span className="text-[var(--text-2)]">{unit.text}</span>
                      </span>
                    </li>
                  ) : null
                )}
              </ul>
            )
          case 'tr':
            return (
              <div key={key} className="overflow-hidden rounded-lg border border-[var(--line)]">
                {visible.map((unit, row) =>
                  unit.kind === 'tr' ? (
                    <div
                      key={row}
                      className={cn(
                        styles.unit,
                        'grid grid-cols-[1.2fr_1fr_1fr] gap-3 px-3 py-1.5 text-[12.5px]',
                        unit.head ? 'bg-white/[0.03] font-medium text-[var(--text-2)]' : 'border-t border-[var(--line)]'
                      )}
                    >
                      {unit.cells.map((cell, column) => (
                        <span key={column} className={column === 0 ? 'text-[var(--text-2)]' : 'text-[var(--text)]'}>
                          {cell}
                        </span>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            )
          case 'code':
            return (
              <pre key={key} className="overflow-hidden rounded-lg border border-[var(--line)] bg-black/40 px-3 py-2.5 font-mono text-[12px] leading-[1.7]">
                {visible.map((unit, line) =>
                  unit.kind === 'code' ? (
                    <div key={line} className={styles.unit}>
                      {unit.tokens.map(([text, type], index) => (
                        <span key={index} className={type ? styles[`tok_${type}`] : 'text-[var(--text-2)]'}>
                          {text}
                        </span>
                      ))}
                    </div>
                  ) : null
                )}
              </pre>
            )
          case 'status': {
            const unit = group.units[0]
            return unit.kind === 'status' ? (
              <p key={key} className={cn(styles.unit, 'inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11.5px] text-[var(--text-2)]')}>
                <Globe className="size-3 text-[var(--hue)]" aria-hidden />
                {unit.text}
              </p>
            ) : null
          }
          case 'sources': {
            const unit = group.units[0]
            return unit.kind === 'sources' ? (
              <div key={key} className={cn(styles.unit, 'flex flex-wrap gap-1.5')}>
                {unit.items.map((item, index) => (
                  <span key={item} className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1 text-[11.5px] text-[var(--text-2)]">
                    <span className="font-mono text-[10px] text-[var(--hue)]">{index + 1}</span>
                    {item}
                  </span>
                ))}
              </div>
            ) : null
          }
          case 'image':
            return (
              <figure key={key} className="w-full max-w-[19rem] overflow-hidden rounded-xl border border-[var(--line)]">
                <div className={cn(styles.develop, 'relative overflow-hidden')}>
                  <PrismArt className="h-auto w-full" />
                  <span aria-hidden className={styles.rain} />
                </div>
                <figcaption className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 text-[11px] text-[var(--text-3)]">
                  <span>Example image</span>
                  <span>Prism</span>
                </figcaption>
              </figure>
            )
          default: {
            const unit = group.units[0]
            return unit.kind === 'p' ? (
              <p key={key} className={cn(styles.unit, 'text-[var(--text)]')}>
                {unit.text}
              </p>
            ) : null
          }
        }
      })}
    </div>
  )
}

const PER_CHAR = 20
const TYPE_DELAY = 500

// Types the prompt into the composer, a letter at a time, from mount.
function ComposerLine({ text, placeholder }: { text: string; placeholder: string }) {
  const [typed, setTyped] = useState(0)
  useEffect(() => {
    if (!text) return
    let count = 0
    let timer = window.setTimeout(function step() {
      count += 1
      setTyped(count)
      if (count < text.length) timer = window.setTimeout(step, PER_CHAR)
    }, TYPE_DELAY + PER_CHAR)
    return () => window.clearTimeout(timer)
  }, [text])
  const shown = text.slice(0, typed)
  return (
    <>
      <p className="min-h-[2.75rem] px-3.5 pt-3 text-[13.5px] text-[var(--text)]">
        {shown ? (
          <>
            {shown}
            <span aria-hidden className={styles.caret} />
          </>
        ) : (
          <span className="text-[var(--text-3)]">{placeholder}</span>
        )}
      </p>
      <SendButton lit={Boolean(shown)} />
    </>
  )
}

function SendButton({ lit }: { lit: boolean }) {
  return (
    <span
      aria-hidden
      data-send
      className={cn(
        'absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full transition-[background-color,opacity] duration-300',
        lit ? 'bg-[var(--hue)] text-black' : 'bg-white/[0.08] text-[var(--text-3)]'
      )}
    >
      <ArrowUp className="size-3.5" />
    </span>
  )
}

const Sidebar = memo(function Sidebar({ active }: { active: number }) {
  return (
    <aside aria-hidden className="hidden w-[13.5rem] shrink-0 flex-col border-r border-[var(--line)] bg-black/25 px-2.5 py-3 text-[12.5px] md:flex">
      <div className="flex items-center gap-2 px-1.5">
        <ZenquantaLogo className="size-5 rounded" />
        <span className="font-medium text-[var(--text)]">Zenquanta</span>
      </div>
      <div className="mt-3 flex h-8 items-center gap-2 rounded-md border border-[var(--line)] px-2 text-[var(--text)]">
        <SquarePen className="size-3.5 text-[var(--text-2)]" />
        New chat
      </div>
      <p className="mt-4 px-1.5 text-[11px] text-[var(--text-3)]">Library</p>
      <ul className="mt-1 space-y-px">
        {LIBRARY.map(({ label, icon: Icon }) => (
          <li key={label} className="flex h-7 items-center gap-2 rounded-md px-1.5 text-[var(--text-2)]">
            <Icon className="size-3.5" />
            {label}
          </li>
        ))}
      </ul>
      <p className="mt-4 px-1.5 text-[11px] text-[var(--text-3)]">Chats</p>
      <ul className="mt-1 space-y-px">
        {SCENES.map((item, index) => (
          <li
            key={item.title}
            className={cn(
              'flex h-7 items-center gap-2 rounded-md px-1.5 transition-colors duration-300',
              index === active ? 'bg-white/[0.06] text-[var(--text)]' : 'text-[var(--text-2)]'
            )}
          >
            <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: ASSISTANTS[index].colorVar }} />
            <span className="truncate">{item.title}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
})

export function HeroDemo({
  active,
  playing,
  reducedMotion,
  holdMs,
  onNext,
}: {
  active: number
  playing: boolean
  reducedMotion: boolean
  holdMs: number
  onNext: () => void
}) {
  const scene = SCENES[active]
  const assistant = ASSISTANTS[active]
  const [phase, setPhase] = useState<Phase>('typing')
  const [shown, setShown] = useState(0)
  // Bumped each time a scene starts playing, to restart the composer typing.
  const [run, setRun] = useState(0)
  const advance = useStableCallback(onNext)

  useEffect(() => {
    if (!playing) return
    const units = SCENES[active].units.length
    const timers: number[] = []
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))

    if (reducedMotion) {
      setPhase('done')
      setShown(units)
      at(holdMs + 4000, () => advance())
      return () => timers.forEach(clearTimeout)
    }

    const text = SCENES[active].prompt
    setShown(0)
    setPhase('typing')
    setRun((current) => current + 1)
    let t = TYPE_DELAY + text.length * PER_CHAR + 380
    at(t, () => setPhase('thinking'))
    t += SCENES[active].units[0]?.kind === 'image' ? 1500 : 950
    at(t, () => setPhase('streaming'))
    for (let i = 1; i <= units; i += 1) at(t + i * 340, () => setShown(i))
    t += units * 340 + 380
    at(t, () => setPhase('done'))
    at(t + holdMs, () => advance())
    return () => timers.forEach(clearTimeout)
  }, [active, playing, reducedMotion, holdMs, advance])

  const sent = phase !== 'typing'

  return (
    <div className={cn(styles.window, 'flex h-[30rem] flex-col sm:h-[37rem]')}>
      <div className="relative flex h-10 shrink-0 items-center border-b border-[var(--line)] px-4">
        <div aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-white/[0.12]" />
          <span className="size-2.5 rounded-full bg-white/[0.12]" />
          <span className="size-2.5 rounded-full bg-white/[0.12]" />
        </div>
        <p className="absolute inset-x-0 text-center text-[12px] text-[var(--text-3)]">Zenquanta AI</p>
        <p className="ml-auto text-[11px] text-[var(--text-3)]">Example chat</p>
      </div>

      <div className="flex min-h-0 flex-1">
        <Sidebar active={active} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-4 text-[13px]">
            <span className="truncate text-[var(--text)]">{scene.title}</span>
            <ChevronDown aria-hidden className="size-3.5 text-[var(--text-3)]" />
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden px-4 pt-5 text-[13.5px] leading-[1.6] sm:px-8">
            <div key={active} className="mx-auto max-w-[34rem] space-y-5">
              {sent && (
                <div className={cn(styles.unit, 'flex justify-end')}>
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.07] px-3.5 py-2 text-[var(--text)]">{scene.prompt}</p>
                </div>
              )}
              {sent && (
                <div className={cn(styles.unit, 'flex gap-3')}>
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `color-mix(in oklab, ${assistant.colorVar} 16%, transparent)`, color: assistant.colorVar }}
                  >
                    <ModeIcon mode={assistant.mode} size="sm" className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-[var(--text)]">{assistant.name}</p>
                    <div className="mt-1.5">
                      {phase === 'thinking' ? (
                        <p className={cn(styles.shimmer, 'text-[13px]')}>{scene.thinking}</p>
                      ) : (
                        <Reply units={scene.units} shown={shown} />
                      )}
                      {phase === 'streaming' && <span aria-hidden className={styles.cursor} />}
                      {phase === 'done' && (
                        <div aria-hidden className={cn(styles.unit, 'mt-3 flex gap-1 text-[var(--text-3)]')}>
                          <Copy className="size-3.5" />
                          <ThumbsUp className="ml-2 size-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--window)] to-transparent" />
          </div>

          <div className="shrink-0 px-4 pb-4 sm:px-8">
            <div className="relative mx-auto max-w-[34rem] rounded-xl border border-[var(--line-strong)] bg-white/[0.025] shadow-[0_8px_24px_-12px_rgb(0_0_0_/_0.8)]">
              {sent || reducedMotion ? (
                <>
                  <p className="min-h-[2.75rem] px-3.5 pt-3 text-[13.5px] text-[var(--text-3)]">Ask {assistant.name} anything</p>
                  <SendButton lit={false} />
                </>
              ) : (
                <ComposerLine key={`${active}-${run}`} text={playing ? scene.prompt : ''} placeholder={`Ask ${assistant.name} anything`} />
              )}
              <div className="flex items-center gap-1.5 px-2 pb-2 pr-11">
                <span aria-hidden className="flex size-7 items-center justify-center rounded-full text-[var(--text-2)]">
                  <Plus className="size-3.5" />
                </span>
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 text-[12px] text-[var(--text)]">
                  <ModeIcon mode={assistant.mode} size="sm" className="size-3.5 text-[var(--hue)]" />
                  {assistant.name}
                  <ChevronDown className="size-3 text-[var(--text-3)]" />
                </span>
                <span className="ml-auto hidden h-7 items-center text-[11.5px] text-[var(--text-3)] sm:inline-flex">Balanced</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

