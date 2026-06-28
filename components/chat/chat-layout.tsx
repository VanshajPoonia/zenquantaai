'use client'

import { useEffect, useRef, useState } from 'react'
import { ChatProvider, useChatContext } from '@/lib/chat-context'
import { AuthGate } from '@/components/auth/auth-gate'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { ChatArea } from './chat-area'
import { SettingsPanel } from './settings-panel'
import { SettingsModal } from './settings-modal'
import { AssistantHelpDialog } from './assistant-help-dialog'
import { CommandPalette } from './command-palette'
import { OnboardingDialog } from './onboarding-dialog'
import { ArtifactStudio } from './artifact-studio'
import { PlaybookStudio } from './playbook-studio'
import { MemoryVault } from './memory-vault'
import { PrismStudio } from './prism-studio'
import { PulseResearchRoom } from './pulse-research-room'
import { AskFilesPanel } from './ask-files-panel'
import { GitHubIntegrationPanel } from './github-integration-panel'

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
  const [isAssistantHelpOpen, setIsAssistantHelpOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const { authState, isSidebarOpen, toggleSidebar, workspaceSearchRequest, openWorkspaceTool } =
    useChatContext()
  const hasAppliedMobileSidebarDefault = useRef(false)

  // Default the sidebar closed on phones so first load shows the chat, not a
  // full-screen drawer. Reads window width directly (once, on mount) instead
  // of useIsMobile's async-determined value, which starts at `false` either
  // way and would race this one-time check.
  useEffect(() => {
    if (hasAppliedMobileSidebarDefault.current) return
    hasAppliedMobileSidebarDefault.current = true
    if (window.innerWidth < 768 && isSidebarOpen) {
      toggleSidebar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!workspaceSearchRequest) return
    setIsCommandPaletteOpen(true)
  }, [workspaceSearchRequest])

  useEffect(() => {
    if (authState.status !== 'authenticated') return
    const params = new URLSearchParams(window.location.search)
    const fileId = params.get('openAskFiles')
    if (!fileId) return
    params.delete('openAskFiles')
    const newSearch = params.toString()
    window.history.replaceState(null, '', newSearch ? `?${newSearch}` : window.location.pathname)
    openWorkspaceTool({ tool: 'ask-files', fileId })
  }, [authState.status, openWorkspaceTool])

  if (authState.status === 'loading') {
    return <LoadingScreen />
  }

  if (authState.status !== 'authenticated') {
    return <AuthGate />
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onOpenSettings={() => setIsSettingsModalOpen(true)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenAssistantHelp={() => setIsAssistantHelpOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ChatArea />
          <SettingsPanel />
        </div>
      </div>

      <AssistantHelpDialog
        open={isAssistantHelpOpen}
        onOpenChange={setIsAssistantHelpOpen}
      />

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
      />

      <OnboardingDialog />

      <ArtifactStudio />
      <PlaybookStudio />
      <MemoryVault />
      <PrismStudio />
      <PulseResearchRoom />
      <AskFilesPanel />
      <GitHubIntegrationPanel />

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
