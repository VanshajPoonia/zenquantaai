'use client'

import { useEffect, useState, type RefObject } from 'react'

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

// Elements marked data-reveal start visible. Once this runs, the root gets
// data-motion="on" and anything not yet on screen waits to be revealed, so a
// failed script never hides the page.
//
// Elements marked data-loop hold looping CSS animations. They only get
// data-playing while on screen, so nothing animates out of sight.
export function useRevealOnScroll(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return

    const viewport = window.innerHeight
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    targets.forEach((target) => {
      if (target.getBoundingClientRect().top < viewport * 0.92) target.dataset.shown = ''
    })
    root.dataset.motion = 'on'

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          ;(entry.target as HTMLElement).dataset.shown = ''
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    )
    targets.forEach((target) => {
      if (!('shown' in target.dataset)) observer.observe(target)
    })

    const loops = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const target = entry.target as HTMLElement
        if (entry.isIntersecting) target.dataset.playing = ''
        else delete target.dataset.playing
      })
    })
    root.querySelectorAll('[data-loop]').forEach((target) => loops.observe(target))

    return () => {
      observer.disconnect()
      loops.disconnect()
      delete root.dataset.motion
    }
  }, [rootRef])
}

// Calls back with 0..1 as the element travels through the viewport, at most
// once per frame and only while the element is near the screen. `start` and
// `end` are viewport fractions for the element top.
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  onProgress: (progress: number) => void,
  { start = 1, end = 0 }: { start?: number; end?: number } = {}
) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    let last = -1
    let listening = false
    const measure = () => {
      frame = 0
      const rect = element.getBoundingClientRect()
      const vh = window.innerHeight
      const from = vh * start
      const to = vh * end
      const progress = Math.min(1, Math.max(0, (from - rect.top) / Math.max(1, from - to)))
      if (Math.abs(progress - last) < 0.0005) return
      last = progress
      onProgress(progress)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    const listen = (on: boolean) => {
      if (on === listening) return
      listening = on
      if (on) {
        window.addEventListener('scroll', schedule, { passive: true })
        window.addEventListener('resize', schedule)
      } else {
        window.removeEventListener('scroll', schedule)
        window.removeEventListener('resize', schedule)
      }
      // One last reading on the way out pins the value at 0 or 1.
      schedule()
    }
    const near = new IntersectionObserver(([entry]) => listen(entry.isIntersecting), { rootMargin: '30% 0px' })
    near.observe(element)
    measure()
    return () => {
      near.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [ref, onProgress, start, end])
}

// True while the element is at least partly on screen and the tab is visible.
export function useInView(ref: RefObject<HTMLElement | null>, rootMargin = '0px') {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let intersecting = false
    const update = () => setInView(intersecting && !document.hidden)
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting
        update()
      },
      { rootMargin }
    )
    observer.observe(element)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [ref, rootMargin])
  return inView
}

// Two layers for a value that changes now and then (a glow colour, say):
// the new value is painted on the back layer, which then fades in. Only
// opacity animates, and each layer is painted once per value.
export function useCrossFade<T>(value: T) {
  const [layers, setLayers] = useState({ a: value, b: value, front: 'a' as 'a' | 'b', current: value })
  if (layers.current !== value) {
    setLayers(
      layers.front === 'a'
        ? { a: layers.a, b: value, front: 'b', current: value }
        : { a: value, b: layers.b, front: 'a', current: value }
    )
  }
  return layers
}

// A looping clock in milliseconds for the small scripted demos. It only ticks
// while the element is on screen. Before it starts, and for reduced motion,
// it reads Infinity, which every script below treats as its finished frame.
export function useLoopClock(ref: RefObject<HTMLElement | null>, duration: number, step = 60) {
  const reduced = useReducedMotion()
  const inView = useInView(ref)
  const [time, setTime] = useState(Number.POSITIVE_INFINITY)
  const playing = inView && !reduced

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setTime((current) => (Number.isFinite(current) ? (current + step) % duration : 0))
    }, step)
    return () => window.clearInterval(id)
  }, [playing, duration, step])

  return reduced ? Number.POSITIVE_INFINITY : time
}

// How much of `text` has been typed `elapsed` ms after typing started.
export function typedAt(text: string, elapsed: number, perChar = 34) {
  if (elapsed <= 0) return ''
  return text.slice(0, Math.min(text.length, Math.floor(elapsed / perChar)))
}

// How much of `text` has streamed in, a word at a time.
export function streamedAt(text: string, elapsed: number, perWord = 70) {
  if (elapsed <= 0) return ''
  const words = text.split(' ')
  const count = Math.min(words.length, Math.floor(elapsed / perWord) + 1)
  return words.slice(0, count).join(' ')
}
