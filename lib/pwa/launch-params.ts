import { FAMILY_TO_MODE } from '@/lib/config/assistants'
import type { AIMode, AssistantFamily } from '@/types'

export const SHARED_PROMPT_MAX = 4_000
const LAUNCH_KEYS = ['prompt', 'assistant', 'new'] as const

export interface LaunchParams {
  prompt: string | null
  mode: AIMode | null
  newChat: boolean
}

function clean(value: string | null | undefined): string {
  return (value ?? '').slice(0, SHARED_PROMPT_MAX).trim()
}

/** Turns what a phone's share sheet sent into one draft. Links often arrive inside the text too. */
export function buildSharedPrompt(input: {
  title?: string | null
  text?: string | null
  url?: string | null
}): string {
  const title = clean(input.title)
  const text = clean(input.text)
  const url = clean(input.url)
  const parts: string[] = []
  if (title && !text.includes(title)) parts.push(title)
  if (text) parts.push(text)
  if (url && !parts.some((part) => part.includes(url))) parts.push(url)
  return parts.join('\n\n').slice(0, SHARED_PROMPT_MAX)
}

/** Reads `?prompt=`, `?assistant=` and `?new=1`. Null when the address has none of them. */
export function readLaunchParams(search: string): LaunchParams | null {
  const params = new URLSearchParams(search)
  if (!LAUNCH_KEYS.some((key) => params.has(key))) return null
  const assistant = params.get('assistant')?.trim().toLowerCase() ?? ''
  return {
    prompt: clean(params.get('prompt')) || null,
    mode: Object.hasOwn(FAMILY_TO_MODE, assistant) ? FAMILY_TO_MODE[assistant as AssistantFamily] : null,
    newChat: params.get('new') === '1',
  }
}

/** The same address without the launch parameters, for history.replaceState. */
export function stripLaunchParams(href: string): string {
  const url = new URL(href)
  for (const key of LAUNCH_KEYS) url.searchParams.delete(key)
  return `${url.pathname}${url.search}${url.hash}`
}
