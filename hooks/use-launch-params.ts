'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useChatContext } from '@/lib/chat-context'
import { readLaunchParams, stripLaunchParams, type LaunchParams } from '@/lib/pwa/launch-params'
import { isWorkspacePath } from '@/lib/utils/chat-path'

/**
 * Handles `?prompt=`, `?assistant=` and `?new=1` from app shortcuts and the share sheet.
 * Sign-in happens in place on "/", so signed-out visitors keep the parameters until then.
 */
export function useLaunchParams(): void {
  const searchParams = useSearchParams()
  const { authState, hasLoadedWorkspaceData, currentChat, isNewChatDraft, createNewChat, prepareComposerDraft } =
    useChatContext()
  const pendingRef = useRef<LaunchParams | null>(null)
  const isReady = authState.status === 'authenticated' && hasLoadedWorkspaceData

  useEffect(() => {
    if (!isReady || !isWorkspacePath(window.location.pathname)) return
    const launch = readLaunchParams(window.location.search)
    if (!launch) return
    window.history.replaceState(window.history.state, '', stripLaunchParams(window.location.href))
    pendingRef.current = launch
    void createNewChat()
  }, [isReady, searchParams, createNewChat])

  // Fill the composer only once the new chat is open, so the previous chat keeps its mode.
  useEffect(() => {
    const launch = pendingRef.current
    if (!launch || currentChat || !isNewChatDraft) return
    pendingRef.current = null
    if (!launch.prompt && !launch.mode) return
    // Append so a saved new-chat draft survives a share or shortcut launch.
    prepareComposerDraft({ content: launch.prompt ?? '', mode: launch.mode ?? undefined, append: true })
  }, [currentChat, isNewChatDraft, prepareComposerDraft])
}
