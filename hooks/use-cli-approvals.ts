'use client'

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useChatContext } from '@/lib/chat-context'
import {
  APPROVALS_POLL_MS,
  shouldPollApprovals,
  type PendingCliApproval,
  type PendingCliApprovalsResponse,
} from '@/lib/cli/approvals'

interface ApprovalsSnapshot {
  enabled: boolean
  approvals: PendingCliApproval[]
  /** Server clock minus browser clock, measured when the list arrived. */
  serverOffsetMs: number
  /** Last zq sync by the browser clock, from the server. */
  latestActivityAt: number | null
}

const INITIAL: ApprovalsSnapshot = { enabled: true, approvals: [], serverOffsetMs: 0, latestActivityAt: null }
let snapshot = INITIAL
const listeners = new Set<() => void>()

function setSnapshot(next: ApprovalsSnapshot) {
  const sameApprovals =
    next.approvals.length === snapshot.approvals.length &&
    next.approvals.every((approval, index) => approval.id === snapshot.approvals[index]?.id)
  if (
    sameApprovals &&
    next.enabled === snapshot.enabled &&
    next.latestActivityAt === snapshot.latestActivityAt &&
    Math.abs(next.serverOffsetMs - snapshot.serverOffsetMs) < 1_000
  ) {
    return
  }
  snapshot = { ...next, approvals: sameApprovals ? snapshot.approvals : next.approvals }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useCliApprovals(): ApprovalsSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => INITIAL)
}

/** True while a zq session waits on an answer. Rows re-render only when this flips. */
export function useHasPendingApproval(conversationId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot.approvals.some((approval) => approval.conversationId === conversationId),
    () => false
  )
}

async function refreshApprovals(): Promise<void> {
  const response = await fetch('/api/approvals', { cache: 'no-store' })
  if (response.status === 401) {
    setSnapshot({ ...snapshot, enabled: false, approvals: [] })
    return
  }
  if (!response.ok) return
  const body = (await response.json()) as PendingCliApprovalsResponse
  const serverOffsetMs = Date.parse(body.serverNow) - Date.now()
  const latest = body.latestCliActivityAt ? Date.parse(body.latestCliActivityAt) - serverOffsetMs : null
  setSnapshot({
    enabled: body.enabled,
    approvals: body.approvals,
    serverOffsetMs: Number.isFinite(serverOffsetMs) ? serverOffsetMs : 0,
    latestActivityAt: latest !== null && Number.isFinite(latest) ? latest : null,
  })
}

/** Sends the answer. The card goes away once the server took it or the approval is gone. */
export async function decideCliApproval(
  id: string,
  decision: 'approve' | 'deny'
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetch(`/api/approvals/${encodeURIComponent(id)}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    if (response.ok || response.status === 404 || response.status === 409) {
      setSnapshot({ ...snapshot, approvals: snapshot.approvals.filter((approval) => approval.id !== id) })
    }
    return response.ok ? { ok: true } : { ok: false, message: body?.error ?? 'Could not send your answer. Try again.' }
  } catch {
    return { ok: false, message: 'Could not reach Zenquanta. Check your connection and try again.' }
  }
}

/** Polls pending approvals every 5 s while the tab is visible and zq was active lately. Mount once. */
export function useCliApprovalsPoller(): void {
  const { authState, hasLoadedWorkspaceData, chats } = useChatContext()
  const isReady = authState.status === 'authenticated' && hasLoadedWorkspaceData
  const listedActivityAt = useMemo(() => {
    let latest: number | null = null
    for (const chat of chats) {
      if (chat.surface !== 'cli') continue
      const time = Date.parse(chat.updatedAt)
      if (Number.isFinite(time) && (latest === null || time > latest)) latest = time
    }
    return latest
  }, [chats])
  // People who never used zq on this account never poll.
  const usesZq = listedActivityAt !== null
  const listedActivityRef = useRef(listedActivityAt)
  const kickRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    listedActivityRef.current = listedActivityAt
    kickRef.current?.()
  }, [listedActivityAt])

  useEffect(() => {
    if (!isReady || !usesZq) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight = false
    let failures = 0

    const latestActivity = () => {
      const known = [listedActivityRef.current, snapshot.latestActivityAt].filter(
        (value): value is number => value !== null
      )
      return known.length ? Math.max(...known) : null
    }
    const keepPolling = () =>
      shouldPollApprovals({
        enabled: snapshot.enabled,
        visible: document.visibilityState === 'visible',
        pendingCount: snapshot.approvals.length,
        latestActivityAt: latestActivity(),
      })

    const run = async () => {
      timer = null
      if (stopped || inFlight || !snapshot.enabled || document.visibilityState !== 'visible') return
      inFlight = true
      try {
        await refreshApprovals()
        failures = 0
      } catch (error) {
        // A dropped connection backs off and tries again while zq still looks active.
        if (!(error instanceof TypeError)) throw error
        failures += 1
      } finally {
        inFlight = false
      }
      if (!stopped && !timer && keepPolling()) {
        timer = setTimeout(() => void run(), APPROVALS_POLL_MS * Math.min(4, failures + 1))
      }
    }

    // One check on load, when the tab comes back and when the list shows new zq activity.
    const kick = () => {
      if (!timer) void run()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') kick()
    }
    kickRef.current = kick
    kick()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopped = true
      kickRef.current = null
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isReady, usesZq])
}
