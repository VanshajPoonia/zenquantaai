'use client'

import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS } from '@/lib/types'
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
}

export function Header({ onOpenSettings }: HeaderProps) {
  const {
    currentMode,
    currentChat,
    exportCurrentChat,
    toggleSidebar,
    isSidebarOpen,
    isSettingsPanelOpen,
    toggleSettingsPanel,
    statusLabel,
  } = useChatContext()

  const modeConfig = MODE_CONFIGS[currentMode]

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        {!isSidebarOpen && (
          <>
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <MenuIcon className="size-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ZenquantaLogo className="size-6" />
              <span className="font-semibold text-foreground hidden sm:inline">
                Zenquanta AI
              </span>
            </div>
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
        >
          <ModeIcon mode={currentMode} size="sm" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-sm font-medium">{modeConfig.name}</span>
            <span className="text-[11px] text-muted-foreground">
              Zenquanta AI
            </span>
          </div>
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
  )
}
