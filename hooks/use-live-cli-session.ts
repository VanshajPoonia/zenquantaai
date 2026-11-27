'use client'

import { useEffect, useRef, useState } from 'react'
import {
  LIVE_CHECK_WINDOW_MS,
  LIVE_POLL_MS,
  LIVE_START_CURSOR,
  LIVE_WINDOW_MS,
  liveCursor,
  sessionAgeMs,
} from '@/lib/cli/live-session'
import type { Conversation, ConversationMessagesAfterResponse } from '@/types'

export interface LiveCliSession {
  isLive: boolean
  /** Browser time of the last change, corrected by the server clock. Null until checked. */
  lastActivityAt: number | null
}

const IDLE: LiveCliSession = { isLive: false, lastActivityAt: null }

/** Polls an open zq session for new entries while it is active and the tab is visible. */
export function useLiveCliSession(
  chat: Conversation | null,
  applyLiveMessages: (conversationId: string, page: ConversationMessagesAfterResponse) => void
): LiveCliSession {
  // Wait for the first page, or the cursor would page through the whole history.
  const isLoaded = chat ? chat.messages.length > 0 || chat.messageCount === 0 : false
  const chatId = chat?.surface === 'cli' && isLoaded ? chat.id : null
  const [state, setState] = useState<LiveCliSession & { chatId: string | null }>({
    ...IDLE,
    chatId: null,
  })
  const chatRef = useRef(chat)
  const applyRef = useRef(applyLiveMessages)
  useEffect(() => {
    chatRef.current = chat
    applyRef.current = applyLiveMessages
  })

  useEffect(() => {
    if (!chatId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let request: AbortController | null = null
    let lastActivityAt = Date.parse(chatRef.current?.updatedAt ?? '')

    const schedule = (delay: number) => {
      if (stopped) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void poll(), delay)
    }

    const poll = async () => {
      timer = null
      const current = chatRef.current
      if (stopped || request || document.visibilityState !== 'visible' || current?.id !== chatId) return

      const cursor = liveCursor(current.messages) ?? LIVE_START_CURSOR
      const query = new URLSearchParams({ after: cursor, limit: '50' })
      request = new AbortController()
      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/messages?${query.toString()}`,
          { cache: 'no-store', signal: request.signal }
        )
        // Signed out or deleted: nothing more to watch here.
        if (response.status === 401 || response.status === 404) return
        if (!response.ok) {
          schedule(LIVE_POLL_MS * 3)
          return
        }
        const page = (await response.json()) as ConversationMessagesAfterResponse
        if (stopped) return
        applyRef.current(chatId, page)
        const age = sessionAgeMs(page)
        const isLive = age < LIVE_WINDOW_MS
        lastActivityAt = Date.now() - age
        setState({ chatId, isLive, lastActivityAt })
        if (!isLive) return
        const advanced = page.hasMoreAfter && liveCursor(page.messages) !== cursor
        schedule(advanced ? 250 : LIVE_POLL_MS)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // A dropped connection gets one slower retry while the session still looks active.
        if (Date.now() - lastActivityAt < LIVE_WINDOW_MS) schedule(LIVE_POLL_MS * 2)
      } finally {
        request = null
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || timer) return
      if (Date.now() - lastActivityAt < LIVE_CHECK_WINDOW_MS) void poll()
    }

    if (Date.now() - lastActivityAt < LIVE_CHECK_WINDOW_MS) void poll()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      request?.abort()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [chatId])

  return state.chatId === chatId ? { isLive: state.isLive, lastActivityAt: state.lastActivityAt } : IDLE
}
