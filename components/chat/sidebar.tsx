'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { ConversationSummary } from '@/lib/types'
import { ModeIcon, getModeAccentClass } from '@/lib/mode-utils'
import { formatConversationDate } from '@/lib/utils/date'
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
  XIcon,
  MessageIcon,
} from '@/components/icons'

interface SidebarProps {
  onOpenSettings: () => void
}

function ChatItem({
  chat,
  isActive,
  onSelect,
  onPin,
  onDelete,
}: {
  chat: ConversationSummary
  isActive: boolean
  onSelect: () => void
  onPin: () => void
  onDelete: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground'
      )}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Mode indicator */}
      <div
        className={cn(
          'flex items-center justify-center shrink-0 size-8 rounded-lg transition-colors',
          isActive ? 'bg-sidebar-accent' : 'bg-sidebar-accent/50',
          getModeAccentClass(chat.mode, 'text')
        )}
      >
        <ModeIcon mode={chat.mode} size="sm" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{chat.title}</p>
        <p className="text-xs text-sidebar-foreground/50 truncate">
          {formatConversationDate(chat.updatedAt)}
        </p>
      </div>

      {/* Pin icon or actions */}
      {chat.isPinned && !showActions && (
        <PinIcon className="size-3 text-sidebar-foreground/40 shrink-0" />
      )}

      {showActions && (
        <div className="flex items-center gap-0.5 shrink-0 animate-in fade-in duration-150">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 hover:bg-sidebar-accent"
                  onClick={(e) => {
                    e.stopPropagation()
                    onPin()
                  }}
                >
                  <PinIcon
                    className={cn(
                      'size-3',
                      chat.isPinned && 'text-sidebar-primary'
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {chat.isPinned ? 'Unpin' : 'Pin'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 hover:bg-destructive/20 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <TrashIcon className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Delete
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  )
}

function ChatSection({
  title,
  chats,
  currentChatId,
  onSelectChat,
  onPinChat,
  onDeleteChat,
}: {
  title: string
  chats: ConversationSummary[]
  currentChatId?: string
  onSelectChat: (chat: ConversationSummary) => void
  onPinChat: (id: string) => void
  onDeleteChat: (id: string) => void
}) {
  if (chats.length === 0) return null

  return (
    <div className="space-y-1">
      <h3 className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-2">
        {title}
      </h3>
      {chats.map((chat) => (
        <ChatItem
          key={chat.id}
          chat={chat}
          isActive={currentChatId === chat.id}
          onSelect={() => onSelectChat(chat)}
          onPin={() => onPinChat(chat.id)}
          onDelete={() => onDeleteChat(chat.id)}
        />
      ))}
    </div>
  )
}

function EmptyChatState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="size-12 rounded-xl bg-sidebar-accent/50 flex items-center justify-center mb-3">
        <MessageIcon className="size-5 text-sidebar-foreground/40" />
      </div>
      <p className="text-sm font-medium text-sidebar-foreground/60">
        {hasSearch ? 'No chats found' : 'No chats yet'}
      </p>
      <p className="text-xs text-sidebar-foreground/40 mt-1">
        {hasSearch ? 'Try a different search' : 'Start a new conversation'}
      </p>
    </div>
  )
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const {
    conversations,
    chats,
    currentChat,
    goHome,
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
    const matchingIds = new Set(
      conversations
        .filter((conversation) => {
          const messageText = conversation.messages
            .map((message) => message.content)
            .join(' ')
            .toLowerCase()
          const attachmentNames = (conversation.attachments ?? [])
            .map((attachment) => attachment.name)
            .join(' ')
            .toLowerCase()

          return (
            conversation.title.toLowerCase().includes(query) ||
            conversation.preview.toLowerCase().includes(query) ||
            messageText.includes(query) ||
            attachmentNames.includes(query)
          )
        })
        .map((conversation) => conversation.id)
    )

    return chats.filter((chat) => matchingIds.has(chat.id))
  }, [chats, conversations, searchQuery])

  const pinnedChats = useMemo(
    () => filteredChats.filter((c) => c.isPinned),
    [filteredChats]
  )

  const recentChats = useMemo(
    () =>
      filteredChats
        .filter((c) => !c.isPinned)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [filteredChats]
  )

  if (!isSidebarOpen) return null

  return (
    <aside className="flex flex-col w-72 bg-sidebar border-r border-sidebar-border h-full">
      {/* Header with logo and new chat */}
      <div className="p-4 space-y-4">
        <button
          type="button"
          onClick={goHome}
          className="flex items-center gap-3 rounded-2xl p-1 text-left transition-colors hover:bg-sidebar-accent/40"
        >
          <ZenquantaLogo className="size-9" />
          <div>
            <span className="font-bold text-lg text-sidebar-foreground tracking-tight">
              Zenquanta
            </span>
            <span className="ml-1.5 text-xs font-medium px-1.5 py-0.5 rounded bg-sidebar-primary/20 text-sidebar-primary">
              AI
            </span>
          </div>
        </button>

        <Button
          onClick={createNewChat}
          className={cn(
            'w-full justify-center gap-2 h-10 rounded-xl font-semibold',
            'bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground',
            'shadow-lg shadow-sidebar-primary/20 transition-all duration-200',
            'hover:shadow-xl hover:shadow-sidebar-primary/30 hover:scale-[1.02]'
          )}
        >
          <PlusIcon className="size-4" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 size-4" />
          <Input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'pl-9 h-9 rounded-xl bg-sidebar-accent/50 border-sidebar-border/50',
              'placeholder:text-sidebar-foreground/30',
              'focus-visible:ring-sidebar-primary/50 focus-visible:border-sidebar-primary/30'
            )}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-7 hover:bg-sidebar-accent"
              onClick={() => setSearchQuery('')}
            >
              <XIcon className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1 px-2">
        <div className="py-2 space-y-6">
          <ChatSection
            title="Pinned"
            chats={pinnedChats}
            currentChatId={currentChat?.id}
            onSelectChat={setCurrentChat}
            onPinChat={togglePinChat}
            onDeleteChat={deleteChat}
          />

          <ChatSection
            title="Recent"
            chats={recentChats}
            currentChatId={currentChat?.id}
            onSelectChat={setCurrentChat}
            onPinChat={togglePinChat}
            onDeleteChat={deleteChat}
          />

          {filteredChats.length === 0 && (
            <EmptyChatState hasSearch={!!searchQuery} />
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-xl"
            onClick={onOpenSettings}
          >
            <SettingsIcon className="size-4" />
            <span>Settings</span>
          </Button>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-xl"
                >
                  <UserIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Profile
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </aside>
  )
}
