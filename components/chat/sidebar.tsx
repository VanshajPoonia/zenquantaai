'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  Brain,
  ChevronDown,
  ChevronsUpDown,
  FolderInput,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Images,
  Layers,
  LayoutDashboard,
  MoreHorizontal,
  PanelLeftClose,
  SquarePen,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { ConversationSummary, Project } from '@/lib/types'
import { ModeIcon, getModeAccentClass } from '@/lib/mode-utils'
import { getChatPath } from '@/lib/utils/chat-path'
import { useIsMobile } from '@/components/ui/use-mobile'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  SearchIcon,
  PinIcon,
  TrashIcon,
  SettingsIcon,
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
  onMoveToProject,
  projects,
}: {
  chat: ConversationSummary
  isActive: boolean
  onSelect: () => void
  onPin: () => void
  onDelete: () => void
  onMoveToProject: (projectId: string) => void
  projects: Project[]
}) {
  return (
    <div
      className={cn(
        'group relative flex h-8 items-center gap-2 rounded-md pr-1 pl-2 text-[13px] transition-colors duration-150 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-sidebar-ring',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
      )}
    >
      {/* A real link, stretched over the row, so the chat can be opened in a
          new tab or copied. A plain click opens it in place. */}
      <a
        href={getChatPath(chat.id)}
        aria-current={isActive ? 'page' : undefined}
        aria-label={chat.title}
        title={chat.title}
        className="absolute inset-0 z-[1] rounded-md outline-none"
        onClick={(event) => {
          if (!isPlainClick(event)) return
          event.preventDefault()
          onSelect()
        }}
      />

      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center transition-opacity',
          getModeAccentClass(chat.mode, 'text'),
          !isActive && 'opacity-75 group-hover:opacity-100'
        )}
      >
        <ModeIcon mode={chat.mode} size="sm" className="size-3.5" />
      </span>

      <span className="min-w-0 flex-1 truncate">{chat.title}</span>

      {chat.isPinned ? (
        <PinIcon
          aria-label="Pinned"
          className="size-3 shrink-0 text-sidebar-foreground/40 group-hover:hidden group-has-[[data-state=open]]:hidden"
        />
      ) : null}

      <div className="relative z-10 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Chat actions"
              aria-label="Chat actions"
              className="size-6 rounded-md text-sidebar-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="size-4" />
                Move to project
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    disabled={project.id === chat.projectId}
                    onClick={() => onMoveToProject(project.id)}
                  >
                    {project.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPin}>
              <PinIcon className={cn('size-4', chat.isPinned && 'text-sidebar-primary')} />
              {chat.isPinned ? 'Unpin chat' : 'Pin chat'}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <TrashIcon className="size-4" />
              Delete chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// Recent chats, grouped the way people remember them.
function groupChatsByDate(chats: ConversationSummary[]) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = 24 * 60 * 60 * 1000
  const groups: { title: string; chats: ConversationSummary[] }[] = [
    { title: 'Today', chats: [] },
    { title: 'Yesterday', chats: [] },
    { title: 'Previous 7 days', chats: [] },
    { title: 'Previous 30 days', chats: [] },
    { title: 'Older', chats: [] },
  ]
  for (const chat of chats) {
    const time = new Date(chat.updatedAt).getTime()
    const index =
      time >= startOfToday
        ? 0
        : time >= startOfToday - day
          ? 1
          : time >= startOfToday - 7 * day
            ? 2
            : time >= startOfToday - 30 * day
              ? 3
              : 4
    groups[index].chats.push(chat)
  }
  return groups.filter((group) => group.chats.length > 0)
}

function ChatSection({
  title,
  chats,
  currentChatId,
  onSelectChat,
  onPinChat,
  onDeleteChat,
  onMoveChatToProject,
  projects,
}: {
  title: string
  chats: ConversationSummary[]
  currentChatId?: string
  onSelectChat: (chat: ConversationSummary) => void
  onPinChat: (id: string) => void
  onDeleteChat: (id: string) => void
  onMoveChatToProject: (chatId: string, projectId: string) => void
  projects: Project[]
}) {
  if (chats.length === 0) return null

  return (
    <div className="space-y-px">
      <h3 className="mb-1 px-2 text-[12px] font-medium text-sidebar-foreground/45">
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
          projects={projects}
        />
      ))}
    </div>
  )
}

type LibraryTool = 'artifacts' | 'prism-studio' | 'playbooks' | 'memory-vault' | 'pulse-research-room'

// Everything you make or keep in the workspace, one click from the sidebar.
// Tools open over the current view; Files is its own page.
const LIBRARY_ITEMS: Array<
  { label: string; icon: typeof Layers } & ({ tool: LibraryTool } | { href: string })
> = [
  { label: 'Artifacts', icon: Layers, tool: 'artifacts' },
  { label: 'Images', icon: Images, tool: 'prism-studio' },
  { label: 'Playbooks', icon: BookOpen, tool: 'playbooks' },
  { label: 'Files', icon: FolderOpen, href: '/knowledge' },
  { label: 'Memory', icon: Brain, tool: 'memory-vault' },
  { label: 'Research', icon: Zap, tool: 'pulse-research-room' },
]

const LIBRARY_OPEN_STORAGE_KEY = 'zenquanta-sidebar-library-open'

function isPlainClick(event: React.MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

function LibrarySection({
  onOpenTool,
  onNavigate,
}: {
  onOpenTool: (tool: LibraryTool) => void
  onNavigate: () => void
}) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return window.localStorage.getItem(LIBRARY_OPEN_STORAGE_KEY) !== 'false'
    } catch {
      return true
    }
  })

  const toggle = () => {
    setIsOpen((previous) => {
      try {
        window.localStorage.setItem(LIBRARY_OPEN_STORAGE_KEY, String(!previous))
      } catch {
        // Remembering the choice is a convenience only.
      }
      return !previous
    })
  }

  const rowClassName =
    'group/row flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-sidebar-foreground/75 outline-none transition-colors duration-150 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring'

  return (
    <nav aria-label="Library" className="px-2 pb-2">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={toggle}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-sidebar-foreground/45 outline-none transition-colors hover:text-sidebar-foreground/75 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        Library
        <ChevronDown
          className={cn('size-3 transition-transform', !isOpen && '-rotate-90')}
        />
      </button>
      {isOpen ? (
        <ul className="mt-0.5 space-y-px">
          {LIBRARY_ITEMS.map((item) => {
            const Icon = item.icon
            const content = (
              <>
                <Icon className="size-4 shrink-0 text-sidebar-foreground/45 transition-colors group-hover/row:text-sidebar-foreground/75" />
                <span className="truncate">{item.label}</span>
              </>
            )

            if ('href' in item) {
              const isActive = pathname === item.href
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      rowClassName,
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                    )}
                    onClick={(event) => {
                      if (isPlainClick(event)) onNavigate()
                    }}
                  >
                    {content}
                  </Link>
                </li>
              )
            }

            const tool = item.tool
            return (
              <li key={item.label}>
                {/* A link so the tool can be opened in a new tab; a plain
                    click opens it over the current view. */}
                <a
                  href={`/?tool=${tool}`}
                  className={rowClassName}
                  onClick={(event) => {
                    if (!isPlainClick(event)) return
                    event.preventDefault()
                    onOpenTool(tool)
                  }}
                >
                  {content}
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}
    </nav>
  )
}

function EmptyChatState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg border border-sidebar-border">
        <MessageIcon className="size-4 text-sidebar-foreground/40" />
      </div>
      <p className="text-[13px] font-medium text-sidebar-foreground/60">
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
    openProjectHome,
    createProject,
    searchQuery,
    setSearchQuery,
    isSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    toggleSidebar,
    authState,
    signOut,
    openWorkspaceTool,
  } = useChatContext()
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [pendingDeleteChat, setPendingDeleteChat] =
    useState<ConversationSummary | null>(null)
  const [isDeletingChat, setIsDeletingChat] = useState(false)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const isMobile = useIsMobile()

  const closeOnMobile = () => {
    if (isMobile) toggleSidebar()
  }

  const runChatAction = async (action: () => Promise<void>, failureMessage: string) => {
    try {
      await action()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failureMessage)
    }
  }

  const handleConfirmDeleteChat = async () => {
    if (!pendingDeleteChat) return
    setIsDeletingChat(true)
    try {
      await deleteChat(pendingDeleteChat.id)
      toast.success('Chat deleted')
      setPendingDeleteChat(null)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not delete the chat. Please try again.'
      )
    } finally {
      setIsDeletingChat(false)
    }
  }

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
          const attachmentNames = (conversation.attachments ?? [])
            .map((attachment) => attachment.name)
            .join(' ')
            .toLowerCase()
          const projectName = (projectLabelById[conversation.projectId] ?? 'Inbox')
            .toLowerCase()

          return (
            conversation.title.toLowerCase().includes(query) ||
            conversation.preview.toLowerCase().includes(query) ||
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

  const totalMessageCount = useMemo(
    () => conversations.reduce((count, conversation) => count + conversation.messageCount, 0),
    [conversations]
  )

  if (!isSidebarOpen && !isMobile) return null

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

  const accountName = authState.user?.loginId ?? authState.user?.email ?? 'Zenquanta user'
  const recentGroups = groupChatsByDate(recentChats)
  const selectChat = (chat: ConversationSummary) => {
    setCurrentChat(chat)
    closeOnMobile()
  }
  const pinChat = (id: string) =>
    void runChatAction(() => togglePinChat(id), 'Could not update the pin.')
  const askDeleteChat = (id: string) =>
    setPendingDeleteChat(filteredChats.find((chat) => chat.id === id) ?? null)
  const moveChat = (chatId: string, projectId: string) =>
    void runChatAction(() => moveChatToProject(chatId, projectId), 'Could not move the chat.')

  const sidebarBody = (
    <>
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={() => {
            goHome()
            closeOnMobile()
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-sidebar-accent/70"
        >
          <ZenquantaLogo className="size-6 shrink-0 rounded-md" />
          <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-sidebar-foreground">
            Zenquanta
          </span>
        </button>

        {/* The mobile drawer has its own close button, so only show this on desktop. */}
        {!isMobile ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Collapse sidebar"
                  className="size-8 rounded-md text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
        ) : null}
      </div>

      <div className="space-y-2 px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            createNewChat()
            closeOnMobile()
          }}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-white/[0.03] px-2 text-[13px] font-medium text-sidebar-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)] transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none active:scale-[0.99]"
        >
          <SquarePen className="size-3.5 text-sidebar-foreground/70" />
          New chat
        </button>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/40" />
          <Input
            type="text"
            aria-label="Search chats"
            placeholder="Search chats"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'h-8 rounded-md border-transparent bg-sidebar-accent/70 pl-8 text-[13px] shadow-none',
              'placeholder:text-sidebar-foreground/40',
              'focus-visible:border-sidebar-border focus-visible:ring-2 focus-visible:ring-sidebar-ring/40'
            )}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              className="absolute top-1/2 right-1 size-6 -translate-y-1/2 rounded hover:bg-sidebar-accent"
              onClick={() => setSearchQuery('')}
            >
              <XIcon className="size-3" />
            </Button>
          )}
        </div>
      </div>

      <LibrarySection
        onOpenTool={(tool) => {
          closeOnMobile()
          openWorkspaceTool(tool)
        }}
        onNavigate={closeOnMobile}
      />

      <div className="space-y-2 px-3 pb-2">
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <FolderTree className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-sidebar-foreground/45" />
            <Select
              value={selectedProjectId}
              onValueChange={(value) => setSelectedProjectId(value)}
            >
              <SelectTrigger
                aria-label="Filter chats by project"
                className="h-8 w-full rounded-md border-transparent bg-transparent pl-8 text-[13px] text-sidebar-foreground/80 shadow-none hover:bg-sidebar-accent/70"
              >
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Open project home"
                  className="size-8 rounded-md text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  disabled={selectedProjectId === 'all'}
                  onClick={() => {
                    if (selectedProjectId !== 'all') {
                      openProjectHome(selectedProjectId)
                    }
                  }}
                >
                  <LayoutDashboard className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Project home
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="New project"
                  aria-expanded={isCreatingProject}
                  className="size-8 rounded-md text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  onClick={() => setIsCreatingProject((previous) => !previous)}
                >
                  <FolderPlus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                New project
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {isCreatingProject && (
          <div className="animate-arrive space-y-2 rounded-lg border border-sidebar-border bg-white/[0.02] p-2">
            <Input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Project name"
              aria-label="New project name"
              autoFocus
              className="h-8 rounded-md text-[13px]"
              onKeyDown={async (event) => {
                if (event.key === 'Escape') {
                  setIsCreatingProject(false)
                  setNewProjectName('')
                  return
                }
                if (event.key !== 'Enter') return
                const project = await createProject(newProjectName)
                if (!project) return
                setNewProjectName('')
                setIsCreatingProject(false)
              }}
            />
            <div className="flex justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-md px-2.5 text-[12.5px]"
                onClick={() => {
                  setIsCreatingProject(false)
                  setNewProjectName('')
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 rounded-md px-2.5 text-[12.5px]"
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
      </div>

      {/* Chat list */}
      <ScrollArea className="min-h-0 flex-1 px-2 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="space-y-5 pt-1 pb-4">
          <ChatSection
            title="Pinned"
            chats={pinnedChats}
            currentChatId={currentChat?.id}
            onSelectChat={selectChat}
            onPinChat={pinChat}
            onDeleteChat={askDeleteChat}
            onMoveChatToProject={moveChat}
            projects={projects}
          />

          {recentGroups.map((group) => (
            <ChatSection
              key={group.title}
              title={group.title}
              chats={group.chats}
              currentChatId={currentChat?.id}
              onSelectChat={selectChat}
              onPinChat={pinChat}
              onDeleteChat={askDeleteChat}
              onMoveChatToProject={moveChat}
              projects={projects}
            />
          ))}

          {filteredChats.length === 0 && (
            <EmptyChatState hasSearch={!!searchQuery} />
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none data-[state=open]:bg-sidebar-accent"
              >
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-sidebar-foreground uppercase shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.08)]"
                >
                  {accountName.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-sidebar-foreground/85">
                  {accountName}
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-60">
              <div className="px-2 py-1.5">
                <p className="eyebrow">Signed in as</p>
                <p className="mt-0.5 truncate text-sm text-foreground">{accountName}</p>
                {authState.user?.role === 'admin' ? (
                  <p className="mt-0.5 text-[12px] text-sidebar-primary">Admin access enabled</p>
                ) : null}
              </div>
              <p className="px-2 pb-1.5 text-xs text-muted-foreground">
                {conversations.length.toLocaleString()} chats ·{' '}
                {totalMessageCount.toLocaleString()} messages
              </p>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild onSelect={closeOnMobile}>
                <Link href="/dashboard">Usage & plan</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild onSelect={closeOnMobile}>
                <Link href="/pricing">Plans</Link>
              </DropdownMenuItem>
              {authState.user?.role === 'admin' ? (
                <DropdownMenuItem asChild>
                  <Link href="/admin">Admin</Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Settings"
                  className="size-8 rounded-md text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  onClick={onOpenSettings}
                >
                  <SettingsIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Settings
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  )

  const deleteChatDialog = (
    <AlertDialog
      open={Boolean(pendingDeleteChat)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isDeletingChat) setPendingDeleteChat(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{pendingDeleteChat?.title}&quot; and all of its messages will be
            permanently deleted. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingChat}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeletingChat}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault()
              void handleConfirmDeleteChat()
            }}
          >
            <TrashIcon className="mr-2 size-4" />
            {isDeletingChat ? 'Deleting…' : 'Delete chat'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (isMobile) {
    return (
      <>
        <Sheet
          open={isSidebarOpen}
          onOpenChange={(open) => {
            if (!open) toggleSidebar()
          }}
        >
          <SheetContent
            side="left"
            className="w-[86vw] max-w-sm gap-0 border-sidebar-border bg-sidebar p-0 sm:max-w-sm"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-full min-h-0 flex-col">{sidebarBody}</div>
          </SheetContent>
        </Sheet>
        {deleteChatDialog}
      </>
    )
  }

  return (
    <>
      <aside
        ref={sidebarRef}
        style={{ width: `min(${sidebarWidth}px, calc(100vw - 48px))` }}
        className="relative flex h-full min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
      >
        {sidebarBody}

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          className="group/resize absolute inset-y-0 right-0 z-20 w-2 translate-x-1/2 cursor-col-resize"
          onMouseDown={handleResizeStart}
        >
          <div className="mx-auto h-full w-px bg-transparent transition-colors duration-200 group-hover/resize:bg-sidebar-primary/70 group-active/resize:bg-sidebar-primary" />
        </div>
      </aside>
      {deleteChatDialog}
    </>
  )
}
