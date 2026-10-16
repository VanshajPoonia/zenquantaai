'use client'

import { useEffect, useId, useRef, type RefObject } from 'react'

// How the page talks to its buddy. Sections that cross the middle of the
// screen claim a "spot": the face the buddy should show there, and a hint to
// say once.
//
// Spots are kept as state rather than fired as events, so the buddy can read
// them whenever it mounts or wakes.

export interface BuddySpot {
  face: number | null
  hint?: string
}

const spots = new Map<string, BuddySpot>()
const spotListeners = new Set<() => void>()

function setSpot(id: string, spot: BuddySpot | null) {
  // Re-inserting moves the spot to the end, so the latest claim wins.
  spots.delete(id)
  if (spot) spots.set(id, spot)
  spotListeners.forEach((listener) => listener())
}

export function currentSpot(): (BuddySpot & { id: string }) | null {
  let last: (BuddySpot & { id: string }) | null = null
  spots.forEach((spot, id) => {
    last = { id, ...spot }
  })
  return last
}

export function subscribeToSpots(listener: () => void) {
  spotListeners.add(listener)
  return () => {
    spotListeners.delete(listener)
  }
}

// While the element spans the middle line of the screen, the buddy shows
// `face` and says `hint` the first time.
export function useBuddySpot(ref: RefObject<HTMLElement | null>, face: number | null, hint?: string) {
  const id = useId()
  const active = useRef(false)
  const latest = useRef<BuddySpot>({ face, hint })

  useEffect(() => {
    latest.current = { face, hint }
    if (active.current) setSpot(id, latest.current)
  }, [id, face, hint])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        active.current = entry.isIntersecting
        setSpot(id, entry.isIntersecting ? latest.current : null)
      },
      { rootMargin: '-48% 0px -51% 0px' }
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      active.current = false
      setSpot(id, null)
    }
  }, [id, ref])
}
