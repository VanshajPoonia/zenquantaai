'use client'

import Link from 'next/link'
import { CircleHelp, Search, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { ModeIcon, getModeAccentClass, getModeTintClass } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ZenquantaLogo,
  MenuIcon,
  ShareIcon,
  DownloadIcon,
  SettingsIcon,
  SlidersIcon,
} from '@/components/icons'

interface HeaderProps {
  onOpenSettings: () => void
  onOpenAssistantHelp: () => void
  onOpenCommandPalette: () => void
}

export function Header({
  onOpenSettings,
  onOpenAssistantHelp,
  onOpenCommandPalette,
}: HeaderProps) {
  const {
    currentMode,
    authState,
    currentChat,
    exportCurrentChat,
    goHome,
    toggleSidebar,
    isSidebarOpen,
    isSettingsPanelOpen,
    toggleSettingsPanel,
    statusLabel,
  } = useChatContext()

  const isAdmin = authState.user?.role === 'admin'

  return (
    <div className="px-2 pt-2 sm:px-3 sm:pt-3">
      <header className="flex h-12 items-center justify-between rounded-xl border border-border/70 bg-card/60 px-2 shadow-sm backdrop-blur-sm sm:h-14 sm:rounded-2xl sm:px-4">
        {/* Left Section */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          {!isSidebarOpen && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg sm:size-9 sm:rounded-xl"
                onClick={toggleSidebar}
              >
                <MenuIcon className="size-4 sm:size-5" />
              </Button>
              <button
                type="button"
                onClick={goHome}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-accent/40"
              >
                <ZenquantaLogo className="size-5 sm:size-6" />
                <span className="hidden font-semibold text-foreground sm:inline">
                  Zenquanta AI
                </span>
              </button>
            </>
          )}
          {isSidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg sm:size-9 sm:rounded-xl"
              onClick={toggleSidebar}
            >
              <MenuIcon className="size-4 sm:size-5" />
            </Button>
          )}
        </div>

        {/* Center Section - Mode & Status Info */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border px-2 py-1 transition-all duration-300 sm:px-3 sm:py-1.5',
              getModeAccentClass(currentMode, 'text'),
              `${getModeAccentClass(currentMode, 'border')}/30`,
              getModeTintClass(currentMode, 'subtle')
            )}
            title="Current assistant"
          >
            <ModeIcon mode={currentMode} size="sm" />
          </div>
          <Badge
            variant={statusLabel === 'Streaming' ? 'default' : 'secondary'}
            className="hidden px-2.5 text-[11px] sm:inline-flex"
          >
            {statusLabel}
          </Badge>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 sm:gap-2">
          {isAdmin ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="hidden gap-2 rounded-xl px-3 sm:inline-flex"
            >
              <Link href="/admin">
                <Shield className="size-3.5" />
                <span>Admin</span>
              </Link>
            </Button>
          ) : null}

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 sm:size-9"
                  onClick={onOpenCommandPalette}
                >
                  <Search className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search workspace</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden size-8 sm:inline-flex sm:size-9"
                  onClick={onOpenAssistantHelp}
                >
                  <CircleHelp className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Assistant guide</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-8 sm:size-9',
                    isSettingsPanelOpen && 'bg-accent text-accent-foreground'
                  )}
                  onClick={toggleSettingsPanel}
                >
                  <SlidersIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Session Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-8 sm:inline-flex sm:size-9"
              >
                <ShareIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled={!currentChat}>
                <ShareIcon className="mr-2 size-4" />
                Share Chat
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!currentChat}
                onClick={() => exportCurrentChat('markdown')}
              >
                <DownloadIcon className="mr-2 size-4" />
                Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!currentChat}
                onClick={() => exportCurrentChat('json')}
              >
                <DownloadIcon className="mr-2 size-4" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 sm:size-9"
                  onClick={onOpenSettings}
                >
                  <SettingsIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>
    </div>
  )
}
