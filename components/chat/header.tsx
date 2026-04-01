'use client'

import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
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
}

export function Header({ onOpenSettings, onOpenAssistantHelp }: HeaderProps) {
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
    <div className="px-3 pt-3">
      <header className="h-14 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 shadow-sm">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        {!isSidebarOpen && (
          <>
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <MenuIcon className="size-5" />
            </Button>
            <button
              type="button"
              onClick={goHome}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-accent/40"
            >
              <ZenquantaLogo className="size-6" />
              <span className="font-semibold text-foreground hidden sm:inline">
                Zenquanta AI
              </span>
            </button>
          </>
        )}
        {isSidebarOpen && (
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <MenuIcon className="size-5" />
          </Button>
        )}
      </div>

      {/* Center Section - Mode & Status Info */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300',
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
          className="text-[11px] px-2.5"
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {isAdmin ? (
          <Button asChild variant="secondary" size="sm" className="rounded-xl">
            <Link href="/admin">Admin</Link>
          </Button>
        ) : null}

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onOpenAssistantHelp}>
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
            <Button variant="ghost" size="icon">
              <ShareIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled={!currentChat}>
              <ShareIcon className="size-4 mr-2" />
              Share Chat
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!currentChat}
              onClick={() => exportCurrentChat('markdown')}
            >
              <DownloadIcon className="size-4 mr-2" />
              Export as Markdown
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!currentChat}
              onClick={() => exportCurrentChat('json')}
            >
              <DownloadIcon className="size-4 mr-2" />
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onOpenSettings}>
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
