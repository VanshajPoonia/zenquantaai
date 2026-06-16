'use client'

import { useEffect, useState } from 'react'
import { ChatProvider, useChatContext } from '@/lib/chat-context'
import { AuthGate } from '@/components/auth/auth-gate'
import { Button } from '@/components/ui/button'
import { MenuIcon } from '@/components/icons'
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

      {!isSidebarOpen && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute left-3 top-3 z-40 size-8 rounded-lg border border-border/70 bg-card/90 shadow-lg backdrop-blur-sm sm:left-4 sm:top-4 sm:size-10 sm:rounded-xl"
          onClick={toggleSidebar}
        >
          <MenuIcon className="size-3.5 sm:size-4" />
        </Button>
      )}

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
