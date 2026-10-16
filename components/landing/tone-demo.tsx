'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowUp, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { MODEL_ROUTE_CONFIGS, SYSTEM_PRESET_CONFIGS } from '@/lib/config'
import { ModeIcon } from '@/lib/mode-utils'
import { cn } from '@/lib/utils'
import { getTemperatureQuantity } from '@/lib/utils/session-display'
import type { SystemPresetId } from '@/types'
import { useBuddySpot } from './buddy-bus'
import { ASSISTANTS } from './landing-data'
import { useInView, useReducedMotion } from './landing-motion'
import styles from './landing.module.css'

// The chat settings panel's Tone preset and Temperature, working on one
// example question. The controls use the app's real presets, range and
// labels; the replies are written for this page and labelled as examples.
//
// Temperature also has a colour here, cool to warm, so the change is felt
// before the reply is read: on the track up to the thumb, in the chat
// window's top edge, and as light inside the window (three painted layers
// whose opacities cross-fade).

type Band = 'Focused' | 'Balanced' | 'Expressive'

const PRESETS: SystemPresetId[] = ['default', 'concise', 'detailed', 'startup', 'academic']
const MAX = 2
const STEP = 0.05
const WRITER = ASSISTANTS[1]
const QUESTION = 'Tell our users about offline mode in a couple of sentences.'

const REPLIES: Record<SystemPresetId, Record<Band, string>> = {
  default: {
    Focused: 'Lumen now works offline. Notes save to your device and sync automatically when you reconnect.',
    Balanced: 'Lost signal? Keep writing. Lumen saves every note on your device and syncs it the moment you are back online.',
    Expressive:
      'Tunnels, flights, cabins with one bar of signal: Lumen keeps up with all of them. Write anywhere, and your notes catch up with the cloud the second you resurface.',
  },
  concise: {
    Focused: 'Lumen works offline now. Notes sync when you reconnect.',
    Balanced: 'No signal, no problem. Lumen saves offline and syncs later.',
    Expressive: 'Write in the clouds. Sync when you land.',
  },
  detailed: {
    Focused:
      'Lumen now works without a connection. Every note is saved to your device as you type. When you reconnect, your changes sync automatically, and if a note was edited in two places, Lumen keeps both versions so you can choose.',
    Balanced:
      'You can now use Lumen anywhere, connection or not. Notes are saved on your device as you type, then synced the moment you are back online. Edited the same note on two devices? You will see both versions side by side and pick the one to keep.',
    Expressive:
      'Picture the train ride where your best idea shows up and the Wi-Fi does not. Lumen now saves every keystroke on your device, then quietly syncs it all when you reconnect. If two devices disagree, you get both versions side by side and the final say.',
  },
  startup: {
    Focused: 'Offline mode is live. Lumen saves locally and syncs on reconnect, so your team never loses a note.',
    Balanced: 'Offline mode just shipped. Write on planes, trains and hotel Wi-Fi, and Lumen syncs everything when you are back.',
    Expressive: "Your ideas don't wait for Wi-Fi, and now neither does Lumen. Offline mode is here: capture anywhere, sync everywhere.",
  },
  academic: {
    Focused: 'Lumen now supports offline use. Notes are stored locally and synchronized when a connection becomes available.',
    Balanced:
      'Lumen can now be used without a network connection. Notes are retained on the device and synchronized once connectivity returns, which reduces the risk of data loss.',
    Expressive:
      'Connectivity is no longer a precondition for writing in Lumen. Notes persist locally and are reconciled with the cloud on reconnection: a modest change with a notable effect on reliability.',
  },
}

// Where each text assistant's temperature starts, from the app's config.
const STARTS = ASSISTANTS.filter((assistant) => assistant.mode !== 'image')
  .map((assistant) => ({ assistant, value: MODEL_ROUTE_CONFIGS[assistant.mode].temperature }))
  .sort((a, b) => a.value - b.value)

// The band edges match getTemperatureQuantity.
const BANDS: { label: Band; from: number; to: number; color: string }[] = [
  { label: 'Focused', from: 0, to: 0.45, color: 'var(--tone-cool)' },
  { label: 'Balanced', from: 0.45, to: 1.05, color: 'var(--tone-mid)' },
  { label: 'Expressive', from: 1.05, to: MAX, color: 'var(--tone-warm)' },
]

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

// How much of each halo colour shows at a temperature.
function warmth(temperature: number) {
  const cool = clamp01((0.6 - temperature) / 0.6)
  const warm = clamp01((temperature - 1) / 0.8)
  return { cool, mid: clamp01(1 - cool - warm), warm }
}

const WRITER_START = MODEL_ROUTE_CONFIGS[WRITER.mode].temperature

const TOUR: { preset: SystemPresetId; temperature: number }[] = [
  { preset: 'default', temperature: 0.2 },
  { preset: 'default', temperature: 1.5 },
  { preset: 'concise', temperature: 0.9 },
  { preset: 'startup', temperature: 1.4 },
  { preset: 'academic', temperature: 0.3 },
  { preset: 'detailed', temperature: 0.9 },
  { preset: 'default', temperature: WRITER_START },
]

const PER_WORD = 38
const HOLD = 3400

const pct = (value: number) => `${(value / MAX) * 100}%`

function StreamedReply({ text, instant }: { text: string; instant: boolean }) {
  const words = text.split(' ')
  const [count, setCount] = useState(instant ? words.length : 0)
  useEffect(() => {
    if (count >= words.length) return
    const timer = window.setTimeout(() => setCount((current) => current + 1), PER_WORD)
    return () => window.clearTimeout(timer)
  }, [count, words.length])
  return (
    <p className="text-[15px] leading-[1.65] text-[var(--text)]">
      {words.slice(0, count).join(' ')}
      {count < words.length && <span aria-hidden className={styles.miniCursor} style={{ background: WRITER.colorVar }} />}
    </p>
  )
}

export function ToneDemo() {
  const rootRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const inView = useInView(rootRef)
  const [preset, setPreset] = useState<SystemPresetId>('default')
  const [temperature, setTemperature] = useState(WRITER_START)
  const [touring, setTouring] = useState(true)
  const [stop, setStop] = useState(0)
  const [changes, setChanges] = useState(0)

  const band = getTemperatureQuantity(temperature) as Band
  const reply = REPLIES[preset][band]
  const bandColor = BANDS.find((item) => item.label === band)?.color ?? 'var(--tone-mid)'
  const halo = warmth(temperature)

  useBuddySpot(rootRef, ASSISTANTS.indexOf(WRITER), 'Drag the temperature and watch the reply change.')

  // A short tour of settings plays while the section is on screen, until the
  // visitor changes something themselves.
  useEffect(() => {
    if (!touring || !inView || reducedMotion) return
    const words = reply.split(' ').length
    const timer = window.setTimeout(
      () => {
        const next = TOUR[stop % TOUR.length]
        setPreset(next.preset)
        setTemperature(next.temperature)
        setStop((current) => current + 1)
        setChanges((current) => current + 1)
      },
      (changes === 0 ? 1200 : words * PER_WORD) + HOLD
    )
    return () => window.clearTimeout(timer)
  }, [touring, inView, reducedMotion, reply, stop, changes])

  function takeOver() {
    setTouring(false)
  }

  function choosePreset(next: SystemPresetId) {
    takeOver()
    setPreset(next)
    setChanges((current) => current + 1)
  }

  function chooseTemperature(next: number) {
    takeOver()
    setTemperature(Math.min(MAX, Math.max(0, Math.round(next / STEP) * STEP)))
    setChanges((current) => current + 1)
  }

  const presetLabel = SYSTEM_PRESET_CONFIGS[preset].label

  return (
    <div ref={rootRef} className="grid gap-3 lg:grid-cols-[minmax(0,25rem)_1fr]">
      <div className={cn(styles.panel, 'p-5 sm:p-7')} style={{ '--key': WRITER.colorVar } as CSSProperties}>
        <p className="relative flex items-center gap-2 text-[13px] text-[var(--text-2)]">
          <SlidersHorizontal aria-hidden className="size-3.5" />
          Chat settings
          <span className="text-[var(--text-3)]">/ Advanced</span>
        </p>

        <fieldset className="relative mt-6">
          <legend className="text-[13.5px] font-medium text-[var(--text)]">Tone preset</legend>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={preset === id}
                onClick={() => choosePreset(id)}
                className={styles.toneChip}
              >
                {SYSTEM_PRESET_CONFIGS[id].label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="relative mt-7">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="tune-temperature" className="text-[13.5px] font-medium text-[var(--text)]">
              Temperature
            </label>
            <span className="font-mono text-[12.5px] text-[var(--text-2)] tabular-nums">
              {temperature.toFixed(2)}{' '}
              <span className="transition-colors duration-500" style={{ color: bandColor }}>
                {band}
              </span>
            </span>
          </div>

          <div
            className={styles.slider}
            data-touring={touring && !reducedMotion ? '' : undefined}
            style={{ '--thumb': bandColor } as CSSProperties}
          >
            <div className={styles.sliderTrack}>
              <span className={styles.sliderSpectrum} />
              <span className={styles.sliderRest} style={{ transform: `translateX(${pct(temperature)})` }} />
              {BANDS.slice(1).map((item) => (
                <span key={item.label} aria-hidden className={styles.sliderEdge} style={{ left: pct(item.from) }} />
              ))}
            </div>
            {STARTS.map(({ assistant, value }) => (
              <span
                key={assistant.family}
                aria-hidden
                className={styles.sliderStart}
                style={{ left: pct(value), background: assistant.colorVar }}
              />
            ))}
            <span aria-hidden className={styles.sliderThumbRail} style={{ transform: `translateX(${pct(temperature)})` }}>
              <span className={styles.sliderThumb} />
            </span>
            <input
              id="tune-temperature"
              type="range"
              min={0}
              max={MAX}
              step={STEP}
              value={temperature}
              aria-valuetext={`${temperature.toFixed(2)}, ${band}`}
              onPointerDown={takeOver}
              onChange={(event) => chooseTemperature(Number(event.target.value))}
              className={styles.sliderInput}
            />
          </div>
          <div aria-hidden className="mt-2 grid text-[11.5px] text-[var(--text-3)]" style={{ gridTemplateColumns: BANDS.map((item) => `${item.to - item.from}fr`).join(' ') }}>
            {BANDS.map((item) => (
              <span key={item.label} className={cn('transition-colors duration-300', item.label === band && 'text-[var(--text)]')}>
                {item.label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-[var(--text-3)]">Higher is more creative, lower is more precise.</p>
        </div>

        <div className="relative mt-7 border-t border-[var(--line)] pt-5">
          <p className="text-[13px] text-[var(--text-2)]">Where each assistant starts</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STARTS.map(({ assistant, value }) => (
              <button
                key={assistant.family}
                type="button"
                onClick={() => chooseTemperature(value)}
                aria-label={`Set temperature to ${value}, where ${assistant.name} starts`}
                className={cn(styles.toneChip, 'gap-1.5')}
                aria-pressed={Math.abs(temperature - value) < 0.001}
                data-buddy-face={ASSISTANTS.indexOf(assistant)}
                style={{ '--key': assistant.colorVar } as CSSProperties}
              >
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--key)]" />
                {assistant.name}
                <span className="font-mono text-[11px] text-[var(--text-3)]">{value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn(styles.window, 'isolate flex flex-col')} style={{ '--hue': bandColor } as CSSProperties}>
        <div aria-hidden className={styles.toneHalo}>
          <span data-tone="cool" style={{ opacity: halo.cool }} />
          <span data-tone="mid" style={{ opacity: halo.mid }} />
          <span data-tone="warm" style={{ opacity: halo.warm }} />
        </div>
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--line)] px-4 text-[12px] text-[var(--text-3)]">
          <span>Offline mode announcement</span>
          <span>Example chat</span>
        </div>
        <div className="flex flex-1 flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.07] px-3.5 py-2 text-[14px] text-[var(--text)]">{QUESTION}</p>
          </div>
          <div className="flex gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
              style={{ background: `color-mix(in oklab, ${WRITER.colorVar} 16%, transparent)`, color: WRITER.colorVar }}
            >
              <ModeIcon mode={WRITER.mode} size="sm" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                <span className="font-medium text-[var(--text)]">{WRITER.name}</span>
                <span key={`${preset}-${band}`} className={cn(styles.pop, 'rounded-full bg-white/[0.05] px-2 py-0.5 text-[11.5px] text-[var(--text-2)]')}>
                  {presetLabel} · {temperature.toFixed(2)}
                </span>
              </p>
              <div className="mt-2 min-h-[12.5rem] sm:min-h-[7.5rem]">
                <StreamedReply key={reply} text={reply} instant={changes === 0 || reducedMotion} />
              </div>
            </div>
          </div>
        </div>
        <div aria-hidden className="px-4 pb-4 sm:px-8">
          <div className="flex h-12 items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-white/[0.025] pr-2 pl-3.5 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-[var(--text-3)]">Reply to {WRITER.name}</span>
            <span className="hidden h-7 items-center gap-1 rounded-full bg-white/[0.05] px-2.5 text-[12px] text-[var(--text-2)] sm:inline-flex">
              <SlidersHorizontal className="size-3" />
              {presetLabel}
              <span className="font-mono text-[11px] text-[var(--text-3)] tabular-nums">{temperature.toFixed(2)}</span>
              <ChevronDown className="size-3 text-[var(--text-3)]" />
            </span>
            <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.08] text-[var(--text-3)]">
              <ArrowUp className="size-3.5" />
            </span>
          </div>
        </div>
        <p className="border-t border-[var(--line)] px-4 py-3 text-[12px] text-[var(--text-3)] sm:px-8">
          {touring && !reducedMotion ? 'Showing a few settings. Change one to take over.' : 'Example replies, written for this page.'}
        </p>
      </div>
    </div>
  )
}
