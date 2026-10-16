'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChatProvider, useChatContext } from '@/lib/chat-context'
import { isWorkspacePath } from '@/lib/utils/chat-path'
import { hasSessionHint } from '@/lib/utils/session-hint'
import { cn } from '@/lib/utils'
import { AuthGate } from '@/components/auth/auth-gate'
import { ZenquantaLogo } from '@/components/icons'
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

// Signed-out visitors at "/" get the landing page. It carries three.js, so it
// loads in its own chunk and never reaches signed-in users.
const LandingPage = dynamic(() => import('@/components/landing/landing-page'), {
  loading: () => <div className="min-h-screen bg-[#08090a]" />,
})

function LoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div role="status" className="animate-arrive flex flex-col items-center gap-4">
        <ZenquantaLogo className="size-9 rounded-lg opacity-90" />
        <p className="text-shimmer text-[13px]">Restoring your workspace</p>
      </div>
    </div>
  )
}

// Pages that share the workspace layout. Their content comes from the route;
// the sidebar and header stay in place around it.
const SHELL_PAGES: Record<string, { title: string; requiresAccount: boolean }> = {
  '/dashboard': { title: 'Usage & plan', requiresAccount: true },
  '/knowledge': { title: 'Files', requiresAccount: true },
  '/pricing': { title: 'Plans', requiresAccount: false },
}

// Opens whatever a link's query string names (?tool=..., ?conversationId=...).
// useSearchParams needs its own Suspense boundary so "/" can still prerender.
function WorkspaceDeepLinks() {
  const searchParams = useSearchParams()
  const { authState, hasLoadedWorkspaceData, handleWorkspaceDeepLink } = useChatContext()

  useEffect(() => {
    handleWorkspaceDeepLink()
  }, [authState.status, hasLoadedWorkspaceData, handleWorkspaceDeepLink, searchParams])

  return null
}

function ChatShell({
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  children,
}: {
  isSettingsModalOpen: boolean
  setIsSettingsModalOpen: (value: boolean) => void
  children: React.ReactNode
}) {
  const [isAssistantHelpOpen, setIsAssistantHelpOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const { authState, isSidebarOpen, toggleSidebar, workspaceSearchRequest } = useChatContext()
  const hasAppliedMobileSidebarDefault = useRef(false)
  const pathname = usePathname()
  const isWorkspaceView = isWorkspacePath(pathname)
  const page = isWorkspaceView ? null : SHELL_PAGES[pathname] ?? null
  // The chat is mounted the first time it is shown and then kept, hidden,
  // while a page is open, so drafts, scroll position and streams survive.
  const [hasShownWorkspace, setHasShownWorkspace] = useState(isWorkspaceView)
  if (isWorkspaceView && !hasShownWorkspace) setHasShownWorkspace(true)
  // Read after mount: "/" is prerendered, so the first render cannot know.
  // null means not read yet.
  const [isLikelySignedOut, setIsLikelySignedOut] = useState<boolean | null>(null)
  useEffect(() => {
    setIsLikelySignedOut(!hasSessionHint(document.cookie))
  }, [])

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

  if (!isWorkspaceView) {
    const isSignedIn = authState.status === 'authenticated'
    const isLoadingAccountPage = authState.status === 'loading' && page?.requiresAccount

    // Signed-out visitors (on Plans) see the page on its own.
    if (!isSignedIn && !isLoadingAccountPage) {
      return <div className="min-h-screen bg-background">{children}</div>
    }

    // While the session restores on an account page, show the page with an
    // empty sidebar column so nothing jumps when the sidebar arrives.
    if (!isSignedIn) {
      return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <div
            aria-hidden
            className="hidden h-full w-[288px] shrink-0 border-r border-sidebar-border bg-sidebar md:block"
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div aria-hidden className="h-12 shrink-0 border-b border-border" />
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      )
    }
  }

  // A browser that has never been signed in skips the restore screen and sees
  // the landing page while the session check finishes.
  if (authState.status === 'loading') {
    // Until the cookie is read, show nothing rather than a restore message
    // that a new visitor would see flash before the landing page.
    if (isLikelySignedOut === null) {
      return <div className="h-screen w-full bg-background" />
    }
    return pathname === '/' && isLikelySignedOut ? <LandingPage /> : <LoadingScreen />
  }

  if (authState.status !== 'authenticated') {
    return pathname === '/' ? <LandingPage /> : <AuthGate />
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onOpenSettings={() => setIsSettingsModalOpen(true)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header
          pageTitle={isWorkspaceView ? undefined : (page?.title ?? '')}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        {hasShownWorkspace ? (
          <div
            className={cn('flex min-h-0 flex-1 overflow-hidden', !isWorkspaceView && 'hidden')}
          >
            <ChatArea onOpenAssistantHelp={() => setIsAssistantHelpOpen(true)} />
            <SettingsPanel />
          </div>
        ) : null}

        {!isWorkspaceView ? (
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        ) : null}
      </div>

      <Suspense fallback={null}>
        <WorkspaceDeepLinks />
      </Suspense>

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

export function ChatLayout({ children }: { children?: React.ReactNode }) {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  return (
    <ChatProvider>
      <ChatShell
        isSettingsModalOpen={isSettingsModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
      >
        {children}
      </ChatShell>
    </ChatProvider>
  )
}
