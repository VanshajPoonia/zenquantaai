'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import { useBuddySpot } from './buddy-bus'
import type { DieScene } from './die-scene'
import { ASSISTANTS } from './landing-data'
import { useCrossFade } from './landing-motion'
import { PipFace } from './pip-face'
import styles from './landing.module.css'

// The canvas reaches this far above the stage (as a share of its height),
// so a thrown die can fly up out of it instead of being cut off.
const OVERHANG = 0.45

// Light from the face that landed up, pooled on the table under the die.
function TableGlow({ color }: { color: string | null }) {
  const layers = useCrossFade(color)
  return (
    <>
      {(['a', 'b'] as const).map((layer) => (
        <span
          key={layer}
          aria-hidden
          className={styles.dieGlow}
          style={{ '--glow': layers[layer] ?? 'transparent', opacity: color && layers.front === layer ? 1 : 0 } as CSSProperties}
        />
      ))}
    </>
  )
}

export function DieAccent({ onStart }: { onStart: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<DieScene | null>(null)
  const [face, setFace] = useState<number | null>(null)
  const [picked, setPicked] = useState(false)
  const [state, setState] = useState<'idle' | 'ready' | 'failed'>('idle')

  // The page buddy copies whatever lands face up.
  useBuddySpot(rootRef, face, 'Drag the big die and let go to throw it.')

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return

    const probe = document.createElement('canvas')
    if (!(probe.getContext('webgl2') ?? probe.getContext('webgl'))) {
      setState('failed')
      setFace(3)
      return
    }

    let disposed = false
    let onScreen = false
    let modulePromise: Promise<typeof import('./die-scene')> | null = null
    const load = () => (modulePromise ??= import('./die-scene'))

    // Fetch three.js as the section approaches; build the scene once it is on
    // screen so the visitor sees the die land.
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void load()
          near.disconnect()
        }
      },
      { rootMargin: '800px 0px' }
    )
    near.observe(stage)

    const visible = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting
        if (sceneRef.current) {
          sceneRef.current.setActive(onScreen && !document.hidden)
          return
        }
        if (!entry.isIntersecting) return
        load()
          .then(({ createDieScene }) =>
            createDieScene({
              canvas,
              pipColors: ASSISTANTS.map((assistant) => assistant.hex),
              body: '#121316',
              overhang: OVERHANG,
              reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
              onSettle: (next) => setFace(next),
            })
          )
          .then((scene) => {
            if (disposed) {
              scene.dispose()
              return
            }
            sceneRef.current = scene
            // The visitor may have scrolled on while three.js loaded.
            scene.setActive(onScreen && !document.hidden)
            setState('ready')
          })
          .catch(() => {
            if (disposed) return
            setState('failed')
            setFace(3)
          })
      },
      { threshold: 0.35 }
    )
    visible.observe(stage)

    const onVisibility = () => sceneRef.current?.setActive(onScreen && !document.hidden)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      near.disconnect()
      visible.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  function roll() {
    setPicked(false)
    if (sceneRef.current) sceneRef.current.roll()
    else setFace((current) => ((current ?? 0) + 1 + Math.floor(Math.random() * 5)) % 6)
  }

  function pick(index: number) {
    setPicked(true)
    if (sceneRef.current) sceneRef.current.showFace(index)
    else setFace(index)
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!sceneRef.current || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setPicked(false)
    sceneRef.current.pointerDown(event.clientX, event.clientY)
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const scene = sceneRef.current
    if (!scene) return
    if (event.buttons & 1) scene.pointerMove(event.clientX, event.clientY)
    else if (event.pointerType === 'mouse') scene.hover(event.clientX, event.clientY)
  }

  const result = face === null ? null : ASSISTANTS[face]

  return (
    <div ref={rootRef} className="grid items-center gap-10 md:grid-cols-[minmax(0,26rem)_1fr] md:gap-16">
      <div ref={stageRef} className={cn(styles.dieStage, 'relative mx-auto aspect-square w-full max-w-[22rem] md:max-w-none')}>
        <TableGlow color={result?.colorVar ?? null} />
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{ height: `${(1 + OVERHANG) * 100}%` }}
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 w-full transition-opacity duration-700',
            state === 'ready' ? 'opacity-100' : 'opacity-0'
          )}
        />
        {state === 'failed' && result && (
          <div className="absolute inset-0 flex items-center justify-center">
            <PipFace pips={(face ?? 0) + 1} color={result.colorVar} className="size-32 rotate-[-8deg] drop-shadow-[0_24px_24px_rgb(0_0_0_/_0.6)]" />
          </div>
        )}
        <button
          type="button"
          aria-label="Roll the die"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => sceneRef.current?.pointerUp()}
          onPointerCancel={() => sceneRef.current?.pointerCancel()}
          onPointerLeave={() => sceneRef.current?.leave()}
          onClick={(event) => {
            if (event.detail === 0 || !sceneRef.current) roll()
          }}
          className={cn(styles.dieHit, 'absolute inset-0 touch-pan-y rounded-[24px]')}
        />
      </div>

      <div>
        <h2 className={cn(styles.h2, 'max-w-md')}>Can&rsquo;t decide? Roll for it.</h2>
        <p className="mt-5 max-w-md text-[17px] leading-7 text-[var(--text-2)]">
          Six sides, six specialists. Start with whoever lands face up. You can switch assistants at
          any point, even halfway through a chat.
        </p>
        <p aria-live="polite" className="mt-8 min-h-7 text-[17px] text-[var(--text-2)]">
          {result ? (
            <>
              {picked ? 'Side' : 'You rolled a'} {(face ?? 0) + 1}:{' '}
              <span className="font-medium" style={{ color: result.colorVar }}>
                {result.name}
              </span>
              , for {result.short}.
            </>
          ) : (
            'Tap the die to roll it, or pick it up and throw.'
          )}
        </p>
        <div role="group" aria-label="Pick a side" className="mt-4 flex gap-2">
          {ASSISTANTS.map((assistant, index) => (
            <button
              key={assistant.family}
              type="button"
              aria-label={`Show ${assistant.name}`}
              aria-pressed={face === index}
              data-buddy-face={index}
              onClick={() => pick(index)}
              style={{ '--key': assistant.colorVar } as CSSProperties}
              className={cn(styles.pip, 'size-9')}
            >
              <PipFace pips={index + 1} color={assistant.colorVar} className="size-full" />
            </button>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={roll} className={styles.buttonGhost}>
            Roll again
          </button>
          <button type="button" onClick={onStart} className={styles.buttonPrimary}>
            Start free
          </button>
        </div>
      </div>
    </div>
  )
}
