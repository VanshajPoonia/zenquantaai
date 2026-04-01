'use client'

import { useMemo, useRef, useState } from 'react'
import {
  FolderInput,
  FolderPlus,
  FolderTree,
  GripVertical,
  MoreHorizontal,
  PanelLeftClose,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { ConversationSummary, Project } from '@/lib/types'
import { ModeIcon, getModeAccentClass } from '@/lib/mode-utils'
import {
  formatEstimatedCostUsd,
  sumUsageEstimates,
} from '@/lib/utils/cost'
import { formatConversationDate } from '@/lib/utils/date'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

function getSidebarChatTitle(title: string): string {
  const trimmed = title.trim()
  if (trimmed.length <= 28) return trimmed
  return `${trimmed.slice(0, 28).trimEnd()}…`
}

function ChatItem({
  chat,
  isActive,
  onSelect,
  onPin,
  onDelete,
  onMoveToProject,
  projectLabel,
  projects,
}: {
  chat: ConversationSummary
  isActive: boolean
  onSelect: () => void
  onPin: () => void
  onDelete: () => void
  onMoveToProject: (projectId: string) => void
  projectLabel: string
  projects: Project[]
}) {
  return (
    <div
      className={cn(
        'group relative grid grid-cols-[2rem,minmax(0,1fr),2.75rem] items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground'
      )}
      onClick={onSelect}
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

      <div className="min-w-0 pr-1">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="cursor-pointer truncate text-sm font-medium" title={chat.title}>
                {getSidebarChatTitle(chat.title)}
              </p>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {chat.title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="mt-1 flex items-center gap-2 text-xs text-sidebar-foreground/50">
          {chat.isPinned && (
            <span className="inline-flex shrink-0 items-center">
              <PinIcon className="size-3 text-sidebar-primary" />
            </span>
          )}
          <p className="truncate">
            {projectLabel} • {formatConversationDate(chat.updatedAt)}
          </p>
        </div>
      </div>

      <div className="flex w-11 shrink-0 items-start justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title="Chat actions"
              aria-label="Chat actions"
              className={cn(
                'size-8 cursor-pointer rounded-lg border-sidebar-border bg-sidebar-accent text-sidebar-foreground shadow-sm transition-all hover:border-sidebar-primary/50 hover:bg-sidebar-primary/10 hover:text-sidebar-foreground',
                isActive && 'border-sidebar-primary/40 bg-sidebar-primary/10 text-sidebar-foreground'
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52 rounded-xl border-sidebar-border/70 bg-sidebar p-1.5 text-sidebar-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer rounded-lg">
                <FolderInput className="size-4" />
                Move to project
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48 rounded-xl border-sidebar-border/70 bg-sidebar p-1.5 text-sidebar-foreground">
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    className="cursor-pointer rounded-lg"
                    disabled={project.id === chat.projectId}
                    onClick={() => onMoveToProject(project.id)}
                  >
                    {project.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator className="bg-sidebar-border/70" />
            <DropdownMenuItem
              className="cursor-pointer rounded-lg"
              onClick={onPin}
            >
              <PinIcon className={cn('size-4', chat.isPinned && 'text-sidebar-primary')} />
              {chat.isPinned ? 'Unpin chat' : 'Pin chat'}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg"
              onClick={onDelete}
            >
              <TrashIcon className="size-4" />
              Delete chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
  onMoveChatToProject,
  projectLabelById,
  projects,
}: {
  title: string
  chats: ConversationSummary[]
  currentChatId?: string
  onSelectChat: (chat: ConversationSummary) => void
  onPinChat: (id: string) => void
  onDeleteChat: (id: string) => void
  onMoveChatToProject: (chatId: string, projectId: string) => void
  projectLabelById: Record<string, string>
  projects: Project[]
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
          onMoveToProject={(projectId) => onMoveChatToProject(chat.id, projectId)}
          projectLabel={projectLabelById[chat.projectId] ?? 'Inbox'}
          projects={projects}
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
    moveChatToProject,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    createProject,
    searchQuery,
    setSearchQuery,
    isSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    toggleSidebar,
    authState,
    signOut,
  } = useChatContext()
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const sidebarRef = useRef<HTMLElement | null>(null)

  const projectLabelById = useMemo(
    () =>
      Object.fromEntries(
        projects.map((project) => [project.id, project.name] as const)
      ),
    [projects]
  )

  const filteredChats = useMemo(() => {
    const projectScopedChats =
      selectedProjectId === 'all'
        ? chats
        : chats.filter((chat) => chat.projectId === selectedProjectId)

    if (!searchQuery.trim()) return projectScopedChats
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
          const projectName = (projectLabelById[conversation.projectId] ?? 'Inbox')
            .toLowerCase()

          return (
            conversation.title.toLowerCase().includes(query) ||
            conversation.preview.toLowerCase().includes(query) ||
            messageText.includes(query) ||
            attachmentNames.includes(query) ||
            projectName.includes(query)
          )
        })
        .map((conversation) => conversation.id)
    )

    return projectScopedChats.filter((chat) => matchingIds.has(chat.id))
  }, [chats, conversations, projectLabelById, searchQuery, selectedProjectId])

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

  const usageSummary = useMemo(
    () => sumUsageEstimates(conversations.map((conversation) => conversation.usage)),
    [conversations]
  )

  const currentChatUsage = currentChat?.usage
  const totalMessageCount = useMemo(
    () => conversations.reduce((count, conversation) => count + conversation.messageCount, 0),
    [conversations]
  )

  if (!isSidebarOpen) return null

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()

    const handlePointerMove = (moveEvent: MouseEvent) => {
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0
      setSidebarWidth(moveEvent.clientX - left)
    }

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
  }

  return (
    <aside
      ref={sidebarRef}
      style={{ width: `${sidebarWidth}px` }}
      className="relative flex h-full min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
    >
      {/* Header with logo and new chat */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goHome}
            className="flex cursor-pointer items-center gap-3 rounded-2xl p-1 text-left transition-colors hover:bg-sidebar-accent/40"
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

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  onClick={toggleSidebar}
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

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
      <div className="px-4 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <FolderTree className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
            <Select
              value={selectedProjectId}
              onValueChange={(value) => setSelectedProjectId(value)}
            >
              <SelectTrigger
                className={cn(
                  'h-9 rounded-xl border-sidebar-border/50 bg-sidebar-accent/50 pl-9',
                  'text-sidebar-foreground/80'
                )}
              >
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-xl bg-sidebar-accent/40 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() => setIsCreatingProject((previous) => !previous)}
          >
            <FolderPlus className="size-4" />
          </Button>
        </div>

        {isCreatingProject && (
          <div className="rounded-2xl border border-sidebar-border/60 bg-sidebar-accent/30 p-3 space-y-2">
            <Input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="New project name"
              className="h-9 rounded-xl border-sidebar-border/50 bg-sidebar/60"
              onKeyDown={async (event) => {
                if (event.key !== 'Enter') return
                const project = await createProject(newProjectName)
                if (!project) return
                setNewProjectName('')
                setIsCreatingProject(false)
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => {
                  setIsCreatingProject(false)
                  setNewProjectName('')
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 rounded-lg"
                disabled={!newProjectName.trim()}
                onClick={async () => {
                  const project = await createProject(newProjectName)
                  if (!project) return
                  setNewProjectName('')
                  setIsCreatingProject(false)
                }}
              >
                Create
              </Button>
            </div>
          </div>
        )}

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
      <ScrollArea className="min-h-0 flex-1 px-2">
        <div className="space-y-6 py-2 pr-5">
          <ChatSection
            title="Pinned"
            chats={pinnedChats}
            currentChatId={currentChat?.id}
            onSelectChat={setCurrentChat}
            onPinChat={togglePinChat}
            onDeleteChat={deleteChat}
            onMoveChatToProject={moveChatToProject}
            projectLabelById={projectLabelById}
            projects={projects}
          />

          <ChatSection
            title="Chats"
            chats={recentChats}
            currentChatId={currentChat?.id}
            onSelectChat={setCurrentChat}
            onPinChat={togglePinChat}
            onDeleteChat={deleteChat}
            onMoveChatToProject={moveChatToProject}
            projectLabelById={projectLabelById}
            projects={projects}
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
          <DropdownMenu>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    >
                      <UserIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Account
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Signed in
                </p>
                <p className="mt-1 truncate text-sm text-foreground">
                  {authState.user?.loginId ?? authState.user?.email ?? 'Zenquanta user'}
                </p>
              </div>
              <div className="px-3 pb-2">
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Usage
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Estimated spend</p>
                      <p className="mt-1 font-medium text-foreground">
                        {formatEstimatedCostUsd(usageSummary.estimatedCostUsd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Chats</p>
                      <p className="mt-1 font-medium text-foreground">
                        {conversations.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Messages</p>
                      <p className="mt-1 font-medium text-foreground">
                        {totalMessageCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Current chat</p>
                      <p className="mt-1 font-medium text-foreground">
                        {currentChatUsage
                          ? formatEstimatedCostUsd(currentChatUsage.estimatedCostUsd)
                          : 'No active chat'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <DropdownMenuItem onClick={() => void signOut()}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        className="absolute inset-y-0 right-0 z-20 flex w-3 translate-x-1/2 cursor-col-resize items-center justify-center"
        onMouseDown={handleResizeStart}
      >
        <div className="flex h-16 w-1.5 items-center justify-center rounded-full bg-sidebar-border/70 text-sidebar-foreground/30 transition-colors hover:bg-sidebar-primary/40 hover:text-sidebar-foreground/60">
          <GripVertical className="size-3.5" />
        </div>
      </div>
    </aside>
  )
}
