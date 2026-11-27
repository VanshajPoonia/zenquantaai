'use client'

import { useEffect, useRef } from 'react'
import { useChatContext } from '@/lib/chat-context'
import {
  canShowNotices,
  findFinishedMessage,
  finishedReply,
  noticeText,
  readDoneNoticesSetting,
  unreadTitle,
} from '@/lib/pwa/done-notices'

function showNotice(text: string, conversationId: string) {
  if (!canShowNotices({ hasNotification: 'Notification' in window, userAgent: navigator.userAgent })) return
  if (Notification.permission !== 'granted' || !readDoneNoticesSetting()) return
  try {
    const notice = new Notification(text, { tag: `zenquanta-reply-${conversationId}`, icon: '/icons/icon-192.png' })
    notice.onclick = () => {
      window.focus()
      notice.close()
    }
  } catch (error) {
    // The title still shows the unread count, so a failed notice is not fatal.
    console.warn('Could not show a reply notice.', error)
  }
}

/** Marks replies that finish in a background tab: "(1)" in the title and, if turned on, a notice. */
export function useDoneNotices(): void {
  const { streamingState, conversations } = useChatContext()
  const previousRef = useRef(streamingState)
  const unreadRef = useRef(0)
  const titleRef = useRef<string | null>(null)

  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = streamingState
    const finished = finishedReply(previous, streamingState)
    if (!finished || document.visibilityState !== 'hidden') return
    const message = findFinishedMessage(conversations, finished)
    if (!message) return

    unreadRef.current += 1
    titleRef.current ??= document.title
    document.title = unreadTitle(unreadRef.current)
    showNotice(noticeText(message), finished.conversationId)
  }, [streamingState, conversations])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || unreadRef.current === 0) return
      unreadRef.current = 0
      if (titleRef.current !== null) document.title = titleRef.current
      titleRef.current = null
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])
}
