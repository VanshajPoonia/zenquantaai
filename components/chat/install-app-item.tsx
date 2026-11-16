'use client'

import { useEffect, useState } from 'react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosSafari(): boolean {
  const agent = navigator.userAgent
  return /iPad|iPhone|iPod/.test(agent) && /Safari/.test(agent) && !/CriOS|FxiOS/.test(agent)
}

/** "Install app" in the account menu. Shows only where the browser can install. */
export function InstallAppItem() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [installed, setInstalled] = useState(true)

  useEffect(() => {
    setInstalled(isStandalone())
    setShowIosHint(isIosSafari())
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  if (prompt) {
    return (
      <DropdownMenuItem
        onClick={() => {
          void prompt.prompt()
          void prompt.userChoice.then(() => setPrompt(null))
        }}
      >
        Install app
      </DropdownMenuItem>
    )
  }

  if (showIosHint) {
    return (
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        To install, tap Share, then Add to Home Screen.
      </p>
    )
  }

  return null
}
