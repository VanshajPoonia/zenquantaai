'use client'

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { ArrowUp, Check, FileText, FolderOpen, ImageIcon, MessageSquare, Play, Search, Sparkles } from 'lucide-react'
import { ModeIcon } from '@/lib/mode-utils'
import { cn } from '@/lib/utils'
import { ASSISTANTS } from './landing-data'
import { streamedAt, typedAt, useLoopClock } from './landing-motion'
import styles from './landing.module.css'

// Each tile plays a short scripted example of the feature it describes: a
// question typed into the composer, the answer streaming back. Scripts are
// pure functions of a looping clock, and an Infinity clock (before playback,
// or with reduced motion) shows the finished frame.

function trackPointer(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

const assistant = (index: number) => ASSISTANTS[index]

// Splits a looping clock into alternating script runs.
function runOf(time: number, cycle: number, runs: number) {
  if (!Number.isFinite(time)) return { run: 0, local: Number.POSITIVE_INFINITY, fading: false }
  return { run: Math.floor(time / cycle) % runs, local: time % cycle, fading: time % cycle > cycle - 600 }
}

function Tile({
  title,
  text,
  className,
  delay,
  duration,
  children,
}: {
  title: string
  text: string
  className?: string
  delay: number
  duration: number
  children: (time: number) => ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const time = useLoopClock(ref, duration)
  return (
    <article
      ref={ref}
      data-reveal
      data-loop
      onPointerMove={trackPointer}
      style={{ '--delay': `${delay}ms` } as CSSProperties}
      className={cn(styles.tile, 'flex flex-col p-5 sm:p-7', className)}
    >
      <div aria-hidden className="relative min-h-0 flex-1">
        {children(time)}
      </div>
      <h3 className="mt-6 text-[15px] font-medium text-[var(--text)]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[14.5px] leading-6 text-[var(--text-2)]">{text}</p>
    </article>
  )
}

function MiniComposer({ text, placeholder, hue }: { text: string; placeholder: string; hue: string }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-white/[0.025] pr-1 pl-2.5">
      <span className="min-w-0 flex-1 truncate">
        {text ? (
          <span className="text-[var(--text)]">
            {text}
            <span className={styles.caret} />
          </span>
        ) : (
          <span className="text-[var(--text-3)]">{placeholder}</span>
        )}
      </span>
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
          text ? 'text-black' : 'bg-white/[0.07] text-[var(--text-3)]'
        )}
        style={text ? { background: hue } : undefined}
      >
        <ArrowUp className="size-3" />
      </span>
    </div>
  )
}

function Question({ children }: { children: ReactNode }) {
  return (
    <p className={cn(styles.unit, 'ml-auto w-fit max-w-[88%] rounded-xl rounded-br-sm bg-white/[0.07] px-2.5 py-1.5 text-[var(--text)]')}>
      {children}
    </p>
  )
}

function Answerer({ index, children }: { index: number; children: ReactNode }) {
  const who = assistant(index)
  return (
    <div className={cn(styles.unit, 'flex gap-2')}>
      <span
        className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md"
        style={{ background: `color-mix(in oklab, ${who.colorVar} 16%, transparent)`, color: who.colorVar }}
      >
        <ModeIcon mode={who.mode} size="sm" className="size-3" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function Streaming({ text, full, hue }: { text: string; full: string; hue: string }) {
  return (
    <>
      {text}
      {text.length < full.length && <span className={styles.miniCursor} style={{ background: hue }} />}
    </>
  )
}

/* Projects and files: ask a question of the uploads, see the passage. */

const FILES = ['brand-guidelines.pdf', 'pricing-notes.md', 'launch-plan.docx']
const FILE_QA = [
  {
    file: 0,
    question: 'What tone do the guidelines ask for?',
    answer: 'Warm and plain-spoken: short sentences, everyday words and no jargon.',
    quote: 'Write the way a helpful colleague talks.',
  },
  {
    file: 1,
    question: 'Which price did we settle on?',
    answer: '$12 a month per person, with a free plan for up to three projects.',
    quote: 'Final: $12/mo per seat. Free tier capped at 3 projects.',
  },
]
const FILE_CYCLE = 9000

function FilesScene({ time }: { time: number }) {
  const { run, local, fading } = runOf(time, FILE_CYCLE, FILE_QA.length)
  const qa = FILE_QA[run]
  const sendAt = 300 + qa.question.length * 34 + 260
  const answerAt = sendAt + 1100
  const answerEnd = answerAt + qa.answer.split(' ').length * 70
  const sent = local >= sendAt
  const reading = sent && local < answerAt
  const answer = streamedAt(qa.answer, local - answerAt)
  const cited = local >= answerEnd + 150
  const hue = assistant(0).colorVar

  return (
    <div className="grid h-[27rem] grid-rows-[auto_minmax(0,1fr)] gap-3 text-[12.5px] sm:h-[18.5rem] sm:grid-cols-[0.85fr_1.15fr] sm:grid-rows-1">
      <div className={cn(styles.mockPanel, 'p-3')}>
        <p className="flex items-center gap-2 text-[var(--text)]">
          <FolderOpen className="size-3.5 text-[var(--text-2)]" />
          Lumen launch
          <span className="ml-auto text-[11px] text-[var(--text-3)]">Project</span>
        </p>
        <ul className="mt-3 space-y-1.5">
          {FILES.map((file, index) => {
            const active = index === qa.file && (reading || cited) && !fading
            return (
              <li key={file} data-active={active ? '' : undefined} className={cn(styles.fileRow, 'flex items-center gap-2 rounded-md px-2 py-1.5 text-[var(--text-2)]')}>
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{file}</span>
                <span className="ml-auto shrink-0 text-[11px] text-[var(--text-3)]">Ready</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className={cn(styles.mockPanel, 'flex min-h-0 flex-col p-3')}>
        <div className={cn(styles.fade, 'min-h-0 flex-1 space-y-2.5 overflow-hidden', fading && 'opacity-0')}>
          {sent && <Question>{qa.question}</Question>}
          {reading && (
            <Answerer index={0}>
              <p className={cn(styles.shimmer, 'text-[12px]')}>Retrieving excerpts from your files</p>
            </Answerer>
          )}
          {answer && (
            <Answerer index={0}>
              <p className="leading-5 text-[var(--text)]">
                <Streaming text={answer} full={qa.answer} hue={hue} />
                {cited && <span className={cn(styles.pop, 'ml-1 inline-block rounded bg-white/[0.06] px-1 font-mono text-[10.5px]')} style={{ color: hue }}>1</span>}
              </p>
              {cited && (
                <blockquote className={cn(styles.unit, 'mt-2 rounded-md border border-[var(--line)] bg-black/30 px-2.5 py-2 text-[11.5px] leading-5 text-[var(--text-2)]')}>
                  &ldquo;{qa.quote}&rdquo;
                  <span className="mt-0.5 block text-[10.5px] text-[var(--text-3)]">{FILES[qa.file]}</span>
                </blockquote>
              )}
            </Answerer>
          )}
        </div>
        <div className="mt-2.5">
          <MiniComposer text={sent ? '' : typedAt(qa.question, local - 300)} placeholder="Ask about your files" hue={hue} />
        </div>
      </div>
    </div>
  )
}

/* Memory: a follow-up that uses what the chat already knows. */

const NOTES = ['Travelling in April, likes slow mornings', 'Vegetarian, keen on tofu dishes', 'Wants travel times between stops']
const MEMORY_QA = {
  question: 'Where should we eat on day two?',
  answer: 'Try tofu by the river in Arashiyama, since you are vegetarian.',
}
const MEMORY_CYCLE = 9000

function MemoryScene({ time }: { time: number }) {
  const { local, fading } = runOf(time, MEMORY_CYCLE, 1)
  const sendAt = 300 + MEMORY_QA.question.length * 34 + 260
  const recallAt = sendAt + 450
  const answerAt = sendAt + 1150
  const sent = local >= sendAt
  const recalling = local >= recallAt && !fading
  const answer = streamedAt(MEMORY_QA.answer, local - answerAt)
  const hue = assistant(0).colorVar

  return (
    <div className={cn(styles.mockPanel, 'flex h-[20rem] flex-col p-3 text-[12.5px] sm:h-[18.5rem]')}>
      <div className="flex items-center justify-between">
        <p className="text-[var(--text)]">Kyoto, three slow days</p>
        <span className="inline-flex h-4 w-7 items-center rounded-full p-0.5" style={{ background: `color-mix(in oklab, ${hue} 70%, transparent)` }}>
          <span className="ml-auto size-3 rounded-full bg-white" />
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {NOTES.map((note, index) => {
          const used = index === 1 && recalling
          return (
            <li key={note} data-used={used ? '' : undefined} className={cn(styles.note, 'flex items-start gap-2 rounded-md px-1.5 py-1 text-[var(--text-2)]')}>
              <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: hue }} />
              <span className="min-w-0 flex-1 truncate">{note}</span>
            </li>
          )
        })}
      </ul>
      <div className={cn(styles.fade, 'mt-2.5 min-h-0 flex-1 space-y-2 overflow-hidden border-t border-[var(--line)] pt-2.5', fading && 'opacity-0')}>
        {sent && <Question>{MEMORY_QA.question}</Question>}
        {sent && !answer && (
          <Answerer index={0}>
            <p className={cn(styles.shimmer, 'text-[12px]')}>Thinking</p>
          </Answerer>
        )}
        {answer && (
          <Answerer index={0}>
            <p className="leading-5 text-[var(--text)]">
              <Streaming text={answer} full={MEMORY_QA.answer} hue={hue} />
            </p>
          </Answerer>
        )}
      </div>
      <div className="mt-2">
        <MiniComposer text={sent ? '' : typedAt(MEMORY_QA.question, local - 300)} placeholder="Ask Nova" hue={hue} />
      </div>
    </div>
  )
}

/* Playbooks: one click runs the steps in order. */

const STEPS = [
  { index: 0, label: 'Outline the post' },
  { index: 1, label: 'Write the draft' },
  { index: 5, label: 'Make a cover image' },
]
const STEP_AT = [700, 2100, 3500, 5100]
const PLAYBOOK_CYCLE = 8500

function PlaybookScene({ time }: { time: number }) {
  const { local, fading } = runOf(time, PLAYBOOK_CYCLE, 1)
  const pressed = local >= 350 && local < STEP_AT[0] + 150
  const finished = local >= STEP_AT[3]
  const done = STEPS.filter((_, order) => local >= STEP_AT[order + 1]).length
  return (
    <div className={cn(styles.mockPanel, 'flex h-[15rem] flex-col p-3 text-[12.5px]')}>
      <div className="flex items-center justify-between">
        <p className="text-[var(--text)]">Launch post</p>
        <span
          data-pressed={pressed ? '' : undefined}
          className={cn(styles.runButton, 'inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px]')}
        >
          {finished && !fading ? <Check className="size-3" /> : <Play className="size-3" />}
          {finished && !fading ? 'Done' : local >= STEP_AT[0] && !fading ? 'Running' : 'Run'}
        </span>
      </div>
      <ol className="relative mt-4 flex-1 space-y-4">
        <span aria-hidden className={styles.rail}>
          <span className={styles.railFill} style={{ transform: `scaleY(${fading ? 0 : done / STEPS.length})` }} />
        </span>
        {STEPS.map((step, order) => {
          const state = fading ? 'idle' : local >= STEP_AT[order + 1] ? 'done' : local >= STEP_AT[order] ? 'running' : 'idle'
          const who = assistant(step.index)
          return (
            <li key={step.label} className="relative flex items-center gap-3" style={{ '--key': who.colorVar } as CSSProperties}>
              <span data-state={state} className={cn(styles.stepDot, 'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full')}>
                <ModeIcon mode={who.mode} size="sm" className="size-3" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[var(--text)]">{step.label}</span>
                <span className="block text-[11px] text-[var(--text-3)]">{who.name}</span>
              </span>
              <span className="shrink-0 text-[11px]">
                {state === 'running' && <span className={styles.shimmer}>Running</span>}
                {state === 'done' && (
                  <span className={cn(styles.pop, 'inline-flex items-center gap-1 text-[var(--text-2)]')}>
                    Done
                    <Check className="size-3" style={{ color: who.colorVar }} />
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* Model Duel: two answers to the same question, keep the better one. */

const DUEL = {
  question: 'A name for a budgeting app?',
  sides: [
    { index: 0, answer: 'Penny. Short, friendly and easy to say out loud.', perWord: 95 },
    { index: 1, answer: 'Tally. It sounds like keeping score, not doing chores.', perWord: 80 },
  ],
}
const DUEL_ASK = 600
const DUEL_KEEP = 2400
const DUEL_CYCLE = 8000

function DuelScene({ time }: { time: number }) {
  const { local, fading } = runOf(time, DUEL_CYCLE, 1)
  const streamAt = DUEL_ASK + 700
  const keepAt = streamAt + DUEL_KEEP
  const kept = local >= keepAt && !fading
  return (
    <div className="flex h-[15rem] flex-col gap-2 text-[12px]">
      <div className={cn(styles.fade, 'flex min-h-7 justify-end', fading && 'opacity-0')}>
        {local >= DUEL_ASK && <Question>{DUEL.question}</Question>}
      </div>
      <div className={cn(styles.fade, 'grid min-h-0 flex-1 grid-cols-2 gap-2', fading && 'opacity-0')}>
        {DUEL.sides.map((side, column) => {
          const who = assistant(side.index)
          const text = streamedAt(side.answer, local - streamAt, side.perWord)
          const winner = column === 1
          return (
            <div
              key={side.index}
              data-kept={kept && winner ? '' : undefined}
              data-dropped={kept && !winner ? '' : undefined}
              className={cn(styles.mockPanel, styles.duelCol, 'flex min-h-0 flex-col p-2.5')}
              style={{ '--key': who.colorVar } as CSSProperties}
            >
              <p className="flex items-center gap-1.5 text-[var(--text)]">
                <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: who.colorVar }} />
                {who.name}
              </p>
              <p className="mt-2 min-h-0 flex-1 overflow-hidden leading-[1.45] text-[var(--text-2)]">
                {text ? <Streaming text={text} full={side.answer} hue={who.colorVar} /> : local >= DUEL_ASK ? <span className={styles.shimmer}>Thinking</span> : null}
              </p>
              <span className={cn(styles.duelPick, 'mt-2 flex h-6 shrink-0 items-center justify-center gap-1 rounded-md text-[11px]')}>
                {kept && winner ? (
                  <>
                    <Check className="size-3" /> Kept
                  </>
                ) : (
                  'Keep this'
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* Search everything: type, watch results narrow, open one. */

const INDEX = [
  { icon: MessageSquare, label: 'Kyoto, three slow days', meta: 'Chat' },
  { icon: FileText, label: 'kyoto-bookings.pdf', meta: 'File' },
  { icon: ImageIcon, label: 'Kyoto temple at dawn', meta: 'Image' },
  { icon: MessageSquare, label: 'Launch post outline', meta: 'Chat' },
  { icon: FileText, label: 'launch-plan.docx', meta: 'File' },
  { icon: Sparkles, label: 'Launch announcement', meta: 'Prompt' },
  { icon: MessageSquare, label: 'Studio names', meta: 'Chat' },
  { icon: FileText, label: 'brand-guidelines.pdf', meta: 'File' },
]
const QUERIES = ['kyoto', 'launch']
const SEARCH_CYCLE = 6500

function Match({ label, query }: { label: string; query: string }) {
  const at = query ? label.toLowerCase().indexOf(query) : -1
  if (at < 0) return <>{label}</>
  return (
    <>
      {label.slice(0, at)}
      <span className="text-[var(--text)]">{label.slice(at, at + query.length)}</span>
      {label.slice(at + query.length)}
    </>
  )
}

function SearchScene({ time }: { time: number }) {
  const { run, local, fading } = runOf(time, SEARCH_CYCLE, QUERIES.length)
  const query = fading ? '' : typedAt(QUERIES[run], local - 400, 110)
  const typedDone = local >= 400 + QUERIES[run].length * 110
  const selected = local >= 2600 && !fading ? 1 : 0
  const opened = local >= 3500 && !fading
  const results = (query ? INDEX.filter((item) => item.label.toLowerCase().includes(query)) : INDEX).slice(0, 4)
  return (
    <div className={cn(styles.mockPanel, 'flex h-[15rem] flex-col overflow-hidden text-[12.5px]')}>
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
        <Search className="size-3.5 text-[var(--text-2)]" />
        <span className="min-w-0 flex-1 truncate text-[var(--text)]">
          {query || <span className="text-[var(--text-3)]">Search chats, files, prompts</span>}
          {query && <span className={styles.caret} />}
        </span>
        <kbd className="rounded border border-[var(--line-strong)] px-1.5 font-mono text-[10px] text-[var(--text-3)]">esc</kbd>
      </div>
      <p className="px-3 pt-2 text-[10.5px] text-[var(--text-3)]">{query && typedDone ? `${results.length} results` : query ? 'Searching' : 'Recent'}</p>
      <ul className="flex-1 p-1.5">
        {results.map(({ icon: Icon, label, meta }, index) => (
          <li
            key={label}
            data-selected={index === selected ? '' : undefined}
            data-open={opened && index === selected ? '' : undefined}
            className={cn(styles.searchRow, 'flex items-center gap-2 rounded-md px-2 py-1.5 text-[var(--text-2)]')}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">
              <Match label={label} query={query} />
            </span>
            <span className="ml-auto text-[11px] text-[var(--text-3)]">{meta}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-[var(--line)] px-3 py-2 text-[10.5px] text-[var(--text-3)]">
        <span>
          <kbd className="font-mono">↑↓</kbd> move
        </span>
        <span>
          <kbd className="font-mono">↵</kbd> open
        </span>
      </div>
    </div>
  )
}

export function WorkspaceTiles() {
  return (
    <div className="grid gap-3 md:grid-cols-6">
      <Tile
        className="md:col-span-4"
        delay={0}
        duration={FILE_CYCLE * FILE_QA.length}
        title="Projects and files"
        text="Keep the chats and files for one piece of work together, then ask questions of your uploads and see the passage each answer came from."
      >
        {(time) => <FilesScene time={time} />}
      </Tile>
      <Tile className="md:col-span-2" delay={80} duration={MEMORY_CYCLE} title="Memory" text="Long chats keep their key points, so you do not have to repeat yourself.">
        {(time) => <MemoryScene time={time} />}
      </Tile>
      <Tile className="md:col-span-2" delay={0} duration={PLAYBOOK_CYCLE} title="Playbooks" text="Save a run of prompts across assistants and play it again in one click.">
        {(time) => <PlaybookScene time={time} />}
      </Tile>
      <Tile className="md:col-span-2" delay={80} duration={DUEL_CYCLE} title="Model Duel" text="Ask two assistants the same thing and keep the better answer.">
        {(time) => <DuelScene time={time} />}
      </Tile>
      <Tile
        className="md:col-span-2"
        delay={160}
        duration={SEARCH_CYCLE * QUERIES.length}
        title="Search everything"
        text="Press Cmd K or Ctrl K to find any chat, file, prompt or image."
      >
        {(time) => <SearchScene time={time} />}
      </Tile>
    </div>
  )
}
