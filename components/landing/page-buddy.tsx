'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { currentSpot, subscribeToSpots } from './buddy-bus'
import { ASSISTANTS } from './landing-data'
import { useReducedMotion } from './landing-motion'
import styles from './buddy.module.css'

// The page buddy: a small onyx die with one assistant's letter on each face.
// It stays in the corner the whole way down the page, looks toward the
// pointer, turns to whichever assistant the page is showing, says a useful
// line once per section, and rolls (or spins by hand) to introduce one of
// the six. It closes its eyes while a password is typed.
//
// Motion budget: only transforms on a few small elements. The look-at loop
// runs while the pointer or page moves and then stops; face turns are CSS
// transitions; the idle bob and blink are compositor animations that are
// switched off for reduced motion.

// Cube turns that bring each face to the front. Face i is ASSISTANTS[i].
const FACES = [
  { x: 0, y: 0 },
  { x: 0, y: -90 },
  { x: 0, y: 180 },
  { x: 0, y: 90 },
  { x: -90, y: 0 },
  { x: 90, y: 0 },
]
const REST = { x: -14, y: -20 }
// Where the eyes go when nothing is happening: up and left, at the page.
const PAGE_AIM = { x: -0.45, y: -0.55 }
const TUCK_KEY = 'zq-buddy-tucked'
const SLEEP_AFTER = 30_000
const HOLD = 8000

type Mood = 'awake' | 'sleepy' | 'shy' | 'dizzy'

interface Bubble {
  id: number
  lead?: string
  text: string
  open: boolean
}

interface Controls {
  press: (event: ReactPointerEvent<HTMLButtonElement>) => void
  drag: (event: ReactPointerEvent<HTMLButtonElement>) => void
  release: () => void
  click: () => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function faceAt(x: number, y: number) {
  const pitch = x - 360 * Math.round(x / 360)
  if (pitch === -90) return 4
  if (pitch === 90) return 5
  const yaw = ((y % 360) + 360) % 360
  return ({ 0: 0, 270: 1, 180: 2, 90: 3 } as Record<number, number>)[yaw] ?? 0
}

export function PageBuddy() {
  const reduced = useReducedMotion()
  const dockRef = useRef<HTMLDivElement>(null)
  const hopRef = useRef<HTMLSpanElement>(null)
  const shadowRef = useRef<HTMLSpanElement>(null)
  const lookRef = useRef<HTMLSpanElement>(null)
  const cubeRef = useRef<HTMLSpanElement>(null)
  const pupilsRef = useRef<(HTMLSpanElement | null)[]>([])
  const controls = useRef<Controls | null>(null)
  const angleRef = useRef({ x: 0, y: 0 })
  const faceRef = useRef(0)
  const hiddenRef = useRef(false)
  const enteredRef = useRef(false)
  const onEnterRef = useRef<(() => void) | null>(null)

  const [face, setFace] = useState(0)
  const [mood, setMood] = useState<Mood>('awake')
  const [bubble, setBubble] = useState<Bubble | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [tucked, setTucked] = useState(false)
  const [autoTucked, setAutoTucked] = useState(false)
  const [entered, setEntered] = useState(false)

  const hidden = tucked || autoTucked
  useEffect(() => {
    hiddenRef.current = hidden
  }, [hidden])

  // Remember a visitor who tucked the buddy away; walk on once the hero has
  // had its moment.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(TUCK_KEY) === '1') setTucked(true)
    } catch {
      // Storage can be blocked; the buddy then simply starts out.
    }
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setEntered(true), still ? 0 : 1500)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!entered) return
    const timer = window.setTimeout(() => {
      enteredRef.current = true
      onEnterRef.current?.()
    }, 700)
    return () => window.clearTimeout(timer)
  }, [entered])

  useEffect(() => {
    const dock = dockRef.current
    const look = lookRef.current
    const cube = cubeRef.current
    if (!dock || !look || !cube) return
    const still = reduced

    let currentMood: Mood = 'awake'
    let hoverFace: number | null = null
    let held: { face: number; until: number } | null = null
    let lastSpot: string | null = null
    const hinted = new Set<string>()
    let saidNotLooking = false
    let clicks: number[] = []
    let lastActive = performance.now()
    let lastDragEnd = 0
    let bubbleId = 0
    const timers = { revert: 0, bubble: 0, mood: 0, sleep: 0, glance: 0 }

    // Speech
    function say(text: string, lead?: string, ms = 3800) {
      if (hiddenRef.current) return
      bubbleId += 1
      setBubble({ id: bubbleId, text, lead, open: true })
      window.clearTimeout(timers.bubble)
      timers.bubble = window.setTimeout(() => setBubble((value) => (value ? { ...value, open: false } : value)), ms)
    }

    // Faces
    function turnTo(next: number, spin = false) {
      const target = FACES[next]
      const from = angleRef.current
      let x = target.x + 360 * Math.round((from.x - target.x) / 360)
      let y = target.y + 360 * Math.round((from.y - target.y) / 360)
      if (spin && !still) {
        x += Math.random() < 0.5 ? 360 : -360
        y += [-360, 0, 360][Math.floor(Math.random() * 3)]
      }
      angleRef.current = { x, y }
      cube!.style.transition = still
        ? 'none'
        : spin
          ? 'transform 1.1s cubic-bezier(0.2, 0.85, 0.25, 1)'
          : 'transform 0.8s cubic-bezier(0.34, 1.35, 0.5, 1)'
      cube!.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`
      faceRef.current = next
      setFace(next)
    }

    function hop(height = 16) {
      if (still) return
      hopRef.current?.animate(
        [
          { transform: 'translateY(0)', easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' },
          { transform: `translateY(${-height}px)`, offset: 0.4, easing: 'cubic-bezier(0.55, 0, 0.85, 0.4)' },
          { transform: 'translateY(0)', offset: 0.76, easing: 'ease-out' },
          { transform: `translateY(${-height * 0.16}px)`, offset: 0.88, easing: 'ease-in' },
          { transform: 'translateY(0)' },
        ],
        { duration: 720 }
      )
      shadowRef.current?.animate(
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(0.6)', opacity: 0.45, offset: 0.4 },
          { transform: 'scale(1)', opacity: 1, offset: 0.76 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 720 }
      )
    }

    // The face to show: what the pointer is on, else a face the visitor
    // rolled a moment ago, else whatever the section in view asks for.
    function wanted() {
      if (hoverFace !== null) return hoverFace
      if (held && held.until > performance.now()) return held.face
      return currentSpot()?.face ?? null
    }

    function settle() {
      const next = wanted()
      if (next !== null && next !== faceRef.current) turnTo(next)
    }

    function settleLater(ms: number) {
      window.clearTimeout(timers.revert)
      timers.revert = window.setTimeout(settle, ms)
    }

    function setMoodTo(next: Mood) {
      if (currentMood === next) return
      currentMood = next
      setMood(next)
      kick()
    }

    function introduce(next: number) {
      const assistant = ASSISTANTS[next]
      held = { face: next, until: performance.now() + HOLD }
      settleLater(HOLD + 50)
      say(assistant.job, `${assistant.name} here.`, 4200)
      setAnnouncement(`${assistant.name}: ${assistant.job}`)
    }

    function otherFace() {
      let next = Math.floor(Math.random() * 5)
      if (next >= faceRef.current) next += 1
      return next
    }

    function roll() {
      activity()
      const now = performance.now()
      clicks = clicks.filter((time) => now - time < 1800)
      clicks.push(now)
      if (clicks.length >= 4 && currentMood !== 'dizzy' && !still) {
        clicks = []
        setMoodTo('dizzy')
        turnTo(otherFace(), true)
        hop(24)
        say('Whoa. Give me a second.')
        window.clearTimeout(timers.mood)
        timers.mood = window.setTimeout(() => setMoodTo('awake'), 2400)
        return
      }
      const next = otherFace()
      turnTo(next, true)
      hop(22)
      introduce(next)
    }

    // Sections
    function onSpots() {
      const spot = currentSpot()
      const id = spot?.id ?? null
      if (id !== lastSpot) {
        lastSpot = id
        if (spot?.hint && enteredRef.current && !hinted.has(spot.id)) {
          hinted.add(spot.id)
          say(spot.hint)
        }
      }
      settle()
    }
    const unsubscribe = subscribeToSpots(onSpots)
    onSpots()
    onEnterRef.current = () => {
      lastSpot = null
      onSpots()
    }

    // Anything marked data-buddy-face turns the buddy while pointed at or
    // focused.
    function faceOf(target: EventTarget | null) {
      const element = target instanceof Element ? target.closest<HTMLElement>('[data-buddy-face]') : null
      if (!element || dock!.contains(element)) return null
      const value = Number(element.dataset.buddyFace)
      return Number.isInteger(value) && value >= 0 && value < FACES.length ? { element, value } : null
    }

    function point(value: number) {
      hoverFace = value
      window.clearTimeout(timers.revert)
      if (value !== faceRef.current) turnTo(value)
    }

    function onOver(event: PointerEvent) {
      const hit = faceOf(event.target)
      if (hit) point(hit.value)
    }

    function onOut(event: PointerEvent) {
      const from = faceOf(event.target)
      if (!from || faceOf(event.relatedTarget)?.element === from.element) return
      hoverFace = null
      settleLater(600)
    }

    const isSecret = (element: Element | null) => Boolean(element?.matches?.('input[autocomplete$="password"]'))
    const isField = (element: Element | null) => Boolean(element?.matches?.('input, textarea, select'))

    function onFocusIn(event: FocusEvent) {
      const target = event.target as Element | null
      const hit = faceOf(target)
      if (hit) point(hit.value)
      if (isSecret(target)) {
        if (currentMood !== 'dizzy') setMoodTo('shy')
        if (!saidNotLooking) {
          saidNotLooking = true
          say('Not looking. Promise.')
        }
      }
      // On a phone the corner is precious while typing.
      if (isField(target) && window.innerWidth < 640) setAutoTucked(true)
    }

    function onFocusOut(event: FocusEvent) {
      if (faceOf(event.target)) {
        hoverFace = null
        settleLater(600)
      }
      // Wait for focus to land, so moving between password fields does not
      // open the eyes in between.
      window.setTimeout(() => {
        const active = document.activeElement
        if (currentMood === 'shy' && !isSecret(active)) setMoodTo('awake')
        if (!isField(active)) setAutoTucked(false)
      }, 0)
    }

    // Looking
    let centre = { x: 0, y: 0 }
    function measure() {
      const rect = dock!.getBoundingClientRect()
      centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    measure()

    let aim = { ...PAGE_AIM }
    const pose = { yaw: 0, pitch: 0, px: aim.x, py: aim.y, jolt: 0 }
    let frame = 0

    function step() {
      frame = 0
      let yaw = aim.x * 12
      let pitch = -aim.y * 10
      let px = aim.x
      let py = aim.y
      if (currentMood === 'shy') {
        yaw = 34
        pitch = -12
        px = 0.5
        py = 0.7
      } else if (currentMood === 'sleepy') {
        yaw = 0
        pitch = -9
        px = 0
        py = 0.5
      }
      const k = still ? 1 : 0.12
      pose.yaw += (yaw - pose.yaw) * k
      pose.pitch += (pitch - pose.pitch) * k
      pose.px += (px - pose.px) * (still ? 1 : 0.25)
      pose.py += (py - pose.py) * (still ? 1 : 0.25)
      pose.jolt = still ? 0 : pose.jolt * 0.86
      look!.style.transform = `rotateX(${(REST.x + pose.pitch + pose.jolt).toFixed(2)}deg) rotateY(${(REST.y + pose.yaw).toFixed(2)}deg)`
      const pupil = `translate(${(pose.px * 55).toFixed(1)}%, ${(pose.py * 45).toFixed(1)}%)`
      pupilsRef.current.forEach((element) => {
        if (element) element.style.transform = pupil
      })
      const moving =
        Math.abs(yaw - pose.yaw) + Math.abs(pitch - pose.pitch) > 0.05 ||
        Math.abs(px - pose.px) + Math.abs(py - pose.py) > 0.004 ||
        Math.abs(pose.jolt) > 0.05
      if (moving && !still) frame = requestAnimationFrame(step)
    }

    function kick() {
      if (!frame) frame = requestAnimationFrame(step)
    }
    kick()

    function aimAt(x: number, y: number) {
      aim = {
        x: clamp((x - centre.x) / (window.innerWidth * 0.55), -1, 1),
        y: clamp((y - centre.y) / (window.innerHeight * 0.55), -1, 1),
      }
      kick()
    }

    // Dozing off after a quiet half minute, and waking with a start.
    function activity() {
      lastActive = performance.now()
      if (currentMood === 'sleepy') {
        setMoodTo('awake')
        hop(10)
      }
    }

    function checkSleep() {
      const idle = performance.now() - lastActive
      if (idle >= SLEEP_AFTER) {
        if (currentMood === 'awake' && !document.hidden) setMoodTo('sleepy')
        timers.sleep = window.setTimeout(checkSleep, SLEEP_AFTER)
      } else {
        timers.sleep = window.setTimeout(checkSleep, SLEEP_AFTER - idle + 50)
      }
    }
    timers.sleep = window.setTimeout(checkSleep, SLEEP_AFTER)

    function onPointerMove(event: PointerEvent) {
      activity()
      if (!still && event.pointerType === 'mouse') aimAt(event.clientX, event.clientY)
    }

    function onPointerDown(event: PointerEvent) {
      activity()
      if (still || event.pointerType === 'mouse' || dock!.contains(event.target as Node)) return
      // On touch, glance at the tap and then back at the page.
      aimAt(event.clientX, event.clientY)
      window.clearTimeout(timers.glance)
      timers.glance = window.setTimeout(() => {
        aim = { ...PAGE_AIM }
        kick()
      }, 1400)
    }

    let lastScroll = window.scrollY
    function onScroll() {
      activity()
      const y = window.scrollY
      const delta = y - lastScroll
      lastScroll = y
      if (still) return
      // A little nod with the scroll, like it is riding along.
      pose.jolt = clamp(pose.jolt - delta * 0.05, -10, 10)
      kick()
    }

    // Turning it by hand
    let press: { x: number; y: number; ax: number; ay: number; moved: boolean; vx: number; lx: number; t: number } | null = null
    controls.current = {
      press(event) {
        if (event.button !== 0 || hiddenRef.current) return
        event.currentTarget.setPointerCapture(event.pointerId)
        const { x, y } = angleRef.current
        press = { x: event.clientX, y: event.clientY, ax: x, ay: y, moved: false, vx: 0, lx: event.clientX, t: performance.now() }
      },
      drag(event) {
        if (!press) return
        const dx = event.clientX - press.x
        const dy = event.clientY - press.y
        if (!press.moved) {
          if (Math.hypot(dx, dy) < 5) return
          press.moved = true
          hoverFace = null
          cube!.style.transition = 'none'
        }
        const now = performance.now()
        press.vx = press.vx * 0.6 + ((event.clientX - press.lx) / Math.max(1, now - press.t)) * 0.4
        press.lx = event.clientX
        press.t = now
        const base = 360 * Math.round(press.ax / 360)
        const x = clamp(press.ax - dy * 1.2, base - 110, base + 110)
        const y = press.ay + dx * 1.2
        angleRef.current = { x, y }
        cube!.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`
      },
      release() {
        const was = press
        press = null
        if (!was?.moved) return
        lastDragEnd = performance.now()
        activity()
        const { x, y } = angleRef.current
        const base = 360 * Math.round(was.ax / 360)
        const snappedX = base + 90 * Math.round((x - base) / 90)
        let snappedY = 90 * Math.round(y / 90) + 90 * Math.round(clamp(was.vx * 0.5, -3, 3))
        // Top and bottom faces land upright.
        if (snappedX !== base) snappedY = 360 * Math.round(snappedY / 360)
        angleRef.current = { x: snappedX, y: snappedY }
        cube!.style.transition = still ? 'none' : 'transform 0.7s cubic-bezier(0.34, 1.3, 0.5, 1)'
        cube!.style.transform = `rotateX(${snappedX}deg) rotateY(${snappedY}deg)`
        const next = faceAt(snappedX, snappedY)
        faceRef.current = next
        setFace(next)
        introduce(next)
      },
      click() {
        if (performance.now() - lastDragEnd < 350) return
        roll()
      },
    }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', activity)
    window.addEventListener('resize', measure)

    return () => {
      unsubscribe()
      onEnterRef.current = null
      controls.current = null
      cancelAnimationFrame(frame)
      Object.values(timers).forEach((timer) => window.clearTimeout(timer))
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', activity)
      window.removeEventListener('resize', measure)
    }
  }, [reduced])

  function setTuck(next: boolean) {
    setTucked(next)
    setBubble(null)
    try {
      window.localStorage.setItem(TUCK_KEY, next ? '1' : '0')
    } catch {
      // Not remembered, which is fine.
    }
  }

  return (
    <div
      ref={dockRef}
      className={styles.dock}
      data-entered={entered ? '' : undefined}
      data-tucked={hidden ? '' : undefined}
      data-talking={bubble?.open && !hidden ? '' : undefined}
      data-mood={mood}
      style={{ '--face': ASSISTANTS[face].colorVar } as CSSProperties}
    >
      <p aria-hidden className={styles.bubble}>
        {bubble && (
          <span key={bubble.id} className={styles.bubbleText}>
            {bubble.lead && <span className={styles.bubbleLead}>{bubble.lead} </span>}
            {bubble.text}
          </span>
        )}
      </p>

      {!hidden && (
        <button type="button" aria-label="Tuck the page buddy away" onClick={() => setTuck(true)} className={styles.tuck}>
          <X className="size-3" />
        </button>
      )}

      <button
        type="button"
        aria-label={hidden ? 'Bring back the page buddy' : 'Page buddy. Roll it to meet an assistant.'}
        onPointerDown={(event) => controls.current?.press(event)}
        onPointerMove={(event) => controls.current?.drag(event)}
        onPointerUp={() => controls.current?.release()}
        onPointerCancel={() => controls.current?.release()}
        onClick={() => {
          if (tucked) setTuck(false)
          else controls.current?.click()
        }}
        className={styles.buddy}
      >
        <span ref={shadowRef} aria-hidden className={styles.shadow} />
        <span aria-hidden className={styles.float}>
          <span ref={hopRef} className={styles.hop}>
            <span ref={lookRef} className={styles.look}>
              <span ref={cubeRef} className={styles.cube}>
                {FACES.map((_, index) => (
                  <span key={`core-${index}`} className={cn(styles.core, styles[`side${index}`])} />
                ))}
                {ASSISTANTS.map((assistant, index) => (
                  <span
                    key={assistant.family}
                    data-front={index === face ? '' : undefined}
                    className={cn(styles.face, styles[`side${index}`])}
                    style={{ '--face': assistant.colorVar } as CSSProperties}
                  >
                    <span className={styles.eyes}>
                      {[0, 1].map((eye) => (
                        <span key={eye} className={styles.eye}>
                          <span
                            ref={(node) => {
                              pupilsRef.current[index * 2 + eye] = node
                            }}
                            className={styles.pupil}
                          />
                        </span>
                      ))}
                    </span>
                    <span className={styles.letter}>{assistant.name[0]}</span>
                  </span>
                ))}
              </span>
            </span>
          </span>
        </span>
        <span aria-hidden className={styles.snooze}>
          z
        </span>
      </button>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
