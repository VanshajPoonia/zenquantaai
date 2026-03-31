'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS, Chat } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ZenquantaLogo,
  PlusIcon,
  SearchIcon,
  PinIcon,
  TrashIcon,
  SettingsIcon,
  UserIcon,
  SparklesIcon,
  BrainIcon,
  CodeIcon,
  XIcon,
  MessageIcon,
} from '@/components/icons'

interface SidebarProps {
  onOpenSettings: () => void
}

function getModeIcon(mode: string) {
  switch (mode) {
    case 'creative':
      return <SparklesIcon className="size-4" />
    case 'logic':
      return <BrainIcon className="size-4" />
    case 'code':
      return <CodeIcon className="size-4" />
    default:
      return <MessageIcon className="size-4" />
  }
}

function getModeColor(mode: string) {
  switch (mode) {
    case 'creative':
      return 'text-creative'
    case 'logic':
      return 'text-logic'
    case 'code':
      return 'text-code'
    default:
      return 'text-muted-foreground'
  }
}

function formatDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

function ChatItem({
  chat,
  isActive,
  onSelect,
  onPin,
  onDelete,
}: {
  chat: Chat
  isActive: boolean
  onSelect: () => void
  onPin: () => void
  onDelete: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-200',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
      )}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={cn('shrink-0', getModeColor(chat.mode))}>
        {getModeIcon(chat.mode)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{chat.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {MODE_CONFIGS[chat.mode].name} · {formatDate(chat.updatedAt)}
        </p>
      </div>
      {chat.isPinned && !showActions && (
        <PinIcon className="size-3 text-muted-foreground shrink-0" />
      )}
      {showActions && (
        <div className="flex items-center gap-1 shrink-0">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 hover:bg-secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onPin()
                  }}
                >
                  <PinIcon
                    className={cn(
                      'size-3',
                      chat.isPinned && 'text-primary'
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {chat.isPinned ? 'Unpin' : 'Pin'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 hover:bg-destructive/20 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <TrashIcon className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  )
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const {
    chats,
    currentChat,
    setCurrentChat,
    createNewChat,
    deleteChat,
    togglePinChat,
    searchQuery,
    setSearchQuery,
    isSidebarOpen,
  } = useChatContext()

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const query = searchQuery.toLowerCase()
    return chats.filter(
      (chat) =>
        chat.title.toLowerCase().includes(query) ||
        chat.messages.some((m) => m.content.toLowerCase().includes(query))
    )
  }, [chats, searchQuery])

  const pinnedChats = useMemo(
    () => filteredChats.filter((c) => c.isPinned),
    [filteredChats]
  )
  const recentChats = useMemo(
    () =>
      filteredChats
        .filter((c) => !c.isPinned)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [filteredChats]
  )

  if (!isSidebarOpen) return null

  return (
    <aside className="flex flex-col w-72 bg-sidebar border-r border-sidebar-border h-full">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <ZenquantaLogo className="size-8" />
          <span className="font-semibold text-lg text-sidebar-foreground">
            Zenquanta AI
          </span>
        </div>
        <Button
          onClick={createNewChat}
          className="w-full justify-start gap-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-accent-foreground"
        >
          <PlusIcon className="size-4" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-sidebar-border">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
          <Input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-sidebar-accent/50 border-sidebar-border focus-visible:ring-sidebar-ring"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-6"
              onClick={() => setSearchQuery('')}
            >
              <XIcon className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Pinned Section */}
          {pinnedChats.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
                Pinned
              </h3>
              <div className="space-y-1">
                {pinnedChats.map((chat) => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={currentChat?.id === chat.id}
                    onSelect={() => setCurrentChat(chat)}
                    onPin={() => togglePinChat(chat.id)}
                    onDelete={() => deleteChat(chat.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent Section */}
          {recentChats.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
                Recent
              </h3>
              <div className="space-y-1">
                {recentChats.map((chat) => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={currentChat?.id === chat.id}
                    onSelect={() => setCurrentChat(chat)}
                    onPin={() => togglePinChat(chat.id)}
                    onDelete={() => deleteChat(chat.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredChats.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageIcon className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchQuery ? 'No chats found' : 'No chats yet'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onOpenSettings}
          >
            <SettingsIcon className="size-4" />
            Settings
          </Button>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <UserIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Profile</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </aside>
  )
}
