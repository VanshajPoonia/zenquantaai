'use client'

import { useState } from 'react'
import { ChatProvider, useChatContext } from '@/lib/chat-context'
import { AuthGate } from '@/components/auth/auth-gate'
import { Button } from '@/components/ui/button'
import { MenuIcon } from '@/components/icons'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { ChatArea } from './chat-area'
import { SettingsPanel } from './settings-panel'
import { SettingsModal } from './settings-modal'

function LoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="rounded-3xl border border-border/70 bg-card/60 px-6 py-4 text-sm text-muted-foreground shadow-xl shadow-black/20">
        Restoring your Zenquanta workspace…
      </div>
    </div>
  )
}

function ChatShell({
  isSettingsModalOpen,
  setIsSettingsModalOpen,
}: {
  isSettingsModalOpen: boolean
  setIsSettingsModalOpen: (value: boolean) => void
}) {
  const { authState, isSidebarOpen, toggleSidebar } = useChatContext()

  if (authState.status === 'loading') {
    return <LoadingScreen />
  }

  if (authState.status !== 'authenticated') {
    return <AuthGate />
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onOpenSettings={() => setIsSettingsModalOpen(true)} />

      {!isSidebarOpen && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute left-4 top-4 z-40 size-10 rounded-xl border border-border/70 bg-card/90 shadow-lg backdrop-blur-sm"
          onClick={toggleSidebar}
        >
          <MenuIcon className="size-4" />
        </Button>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header onOpenSettings={() => setIsSettingsModalOpen(true)} />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ChatArea />
          <SettingsPanel />
        </div>
      </div>

      <SettingsModal
        open={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
      />
    </div>
  )
}

export function ChatLayout() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  return (
    <ChatProvider>
      <ChatShell
        isSettingsModalOpen={isSettingsModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
      />
    </ChatProvider>
  )
}
