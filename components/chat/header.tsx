'use client'

import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS } from '@/lib/types'
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
  SparklesIcon,
  BrainIcon,
  CodeIcon,
} from '@/components/icons'

interface HeaderProps {
  onOpenSettings: () => void
}

function getModeIcon(mode: string, className?: string) {
  switch (mode) {
    case 'creative':
      return <SparklesIcon className={cn('size-5', className)} />
    case 'logic':
      return <BrainIcon className={cn('size-5', className)} />
    case 'code':
      return <CodeIcon className={cn('size-5', className)} />
    default:
      return null
  }
}

export function Header({ onOpenSettings }: HeaderProps) {
  const {
    currentMode,
    toggleSidebar,
    isSidebarOpen,
    isSettingsPanelOpen,
    toggleSettingsPanel,
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

      {/* Center Section - Mode & Model Info */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors',
            currentMode === 'creative' &&
              'border-creative/30 bg-creative/10 text-creative',
            currentMode === 'logic' &&
              'border-logic/30 bg-logic/10 text-logic',
            currentMode === 'code' && 'border-code/30 bg-code/10 text-code'
          )}
        >
          {getModeIcon(currentMode)}
          <span className="text-sm font-medium hidden sm:inline">
            {modeConfig.name}
          </span>
        </div>
        <Badge variant="secondary" className="text-xs font-mono">
          {modeConfig.model}
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
            <DropdownMenuItem>
              <ShareIcon className="size-4 mr-2" />
              Share Chat
            </DropdownMenuItem>
            <DropdownMenuItem>
              <DownloadIcon className="size-4 mr-2" />
              Export as Markdown
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
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
