'use client'

import {
  Dispatch,
  RefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { draftStorageKey, getDraftStore, readDraft, writeDraft } from '@/lib/chat/draft-storage'
import {
  appendDraftText,
  subscribeComposerPrefill,
  takeComposerPrefill,
} from '@/lib/chat/composer-prefill'

const SAVE_DELAY_MS = 300

// Saves the composer text per chat, restores it when that chat opens again,
// and applies prefillComposer() text. Call it before other effects that set the text.
export function useComposerDraft({
  conversationId,
  value,
  setValue,
  textareaRef,
}: {
  conversationId?: string | null
  value: string
  setValue: Dispatch<SetStateAction<string>>
  textareaRef: RefObject<HTMLTextAreaElement | null>
}) {
  const key = draftStorageKey(conversationId)
  const loadedKeyRef = useRef<string | null>(null)
  const pendingRef = useRef<{ key: string; text: string } | null>(null)
  const timerRef = useRef<number | null>(null)
  // Set when a new chat's first message is sent, so the chat it creates keeps the composer as is.
  const carryOverRef = useRef(false)
  const [prefillTick, setPrefillTick] = useState(0)

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending) writeDraft(getDraftStore(), pending.key, pending.text)
  }, [])

  useEffect(() => {
    const previousKey = loadedKeyRef.current
    if (previousKey === key) return
    flush()
    loadedKeyRef.current = key
    if (carryOverRef.current) {
      carryOverRef.current = false
      return
    }
    const stored = readDraft(getDraftStore(), key)
    if (stored || previousKey !== null) setValue(stored)
  }, [flush, key, setValue])

  useEffect(() => {
    if (loadedKeyRef.current !== key) return
    if (!value) carryOverRef.current = false
    pendingRef.current = { key, text: value }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS)
  }, [flush, key, value])

  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  useEffect(() => subscribeComposerPrefill(() => setPrefillTick((tick) => tick + 1)), [])

  useEffect(() => {
    const text = takeComposerPrefill()
    if (!text) return
    setValue((previous) => appendDraftText(previous, text))
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [prefillTick, setValue, textareaRef])

  // Call once a message leaves the composer.
  const discard = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingRef.current = null
    writeDraft(getDraftStore(), key, '')
    carryOverRef.current = !conversationId
  }, [conversationId, key])

  return { discard }
}
