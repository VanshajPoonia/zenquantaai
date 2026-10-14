'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  Pencil,
  Pin,
  PinOff,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { Button } from '@/components/ui/button'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ZenquantaLogo,
  MenuIcon,
  DownloadIcon,
  SettingsIcon,
} from '@/components/icons'

interface HeaderProps {
  // Set on pages such as Dashboard, which show their name instead of a chat.
  pageTitle?: string
  onOpenSettings: () => void
  onOpenCommandPalette: () => void
}

function HeaderIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label={label}
            onClick={onClick}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ChatTitle() {
  const {
    currentChat,
    isNewChatDraft,
    renameChat,
    togglePinChat,
    deleteChat,
    exportCurrentChat,
    toggleSettingsPanel,
  } = useChatContext()
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) inputRef.current?.select()
  }, [isRenaming])

  // Leaving a chat mid-rename should not carry the edit over.
  useEffect(() => {
    setIsRenaming(false)
  }, [currentChat?.id])

  if (!currentChat) {
    return isNewChatDraft ? (
      <span className="truncate px-2 text-sm text-muted-foreground">New chat</span>
    ) : null
  }

  const chatId = currentChat.id
  const title = currentChat.title || 'Untitled chat'

  const commitRename = async () => {
    setIsRenaming(false)
    const nextTitle = draftTitle.trim()
    if (!nextTitle || nextTitle === currentChat.title) return

    try {
      await renameChat(chatId, nextTitle)
    } catch {
      toast.error('Could not rename the chat. Please try again.')
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteChat(chatId)
      setConfirmDelete(false)
      toast.success('Chat deleted')
    } catch {
      toast.error('Could not delete the chat. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isRenaming) {
    return (
      <input
        ref={inputRef}
        value={draftTitle}
        aria-label="Chat name"
        maxLength={120}
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={() => void commitRename()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void commitRename()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setIsRenaming(false)
          }
        }}
        className="h-9 w-full min-w-0 max-w-md rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-foreground/30"
      />
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 min-w-0 max-w-full gap-1 rounded-lg px-2.5 text-sm font-medium text-foreground"
            aria-label={`Chat options for ${title}`}
          >
            {currentChat.isPinned ? (
              <Pin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
            <span className="truncate">{title}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem
            onSelect={() => {
              setDraftTitle(currentChat.title)
              setIsRenaming(true)
            }}
          >
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void togglePinChat(chatId).catch(() =>
                toast.error('Could not update the pin. Please try again.')
              )
            }}
          >
            {currentChat.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            {currentChat.isPinned ? 'Unpin' : 'Pin to top'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleSettingsPanel}>
            <SlidersHorizontal className="size-4" />
            Chat settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => exportCurrentChat('markdown')}>
            <DownloadIcon className="size-4" />
            Export as Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportCurrentChat('json')}>
            <DownloadIcon className="size-4" />
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            Delete chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!isDeleting) setConfirmDelete(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{title}&rdquo; and its messages will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete chat'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function Header({ pageTitle, onOpenSettings, onOpenCommandPalette }: HeaderProps) {
  const { authState, goHome, toggleSidebar, isSidebarOpen } = useChatContext()
  const isAdmin = authState.user?.role === 'admin'

  return (
    <div className="px-2 pt-2 sm:px-3 sm:pt-3">
      <header className="flex h-12 items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-1.5 shadow-sm backdrop-blur-sm sm:h-14 sm:rounded-2xl sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-xl"
            aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            onClick={toggleSidebar}
          >
            <MenuIcon className="size-4 sm:size-5" />
          </Button>
          {!isSidebarOpen ? (
            <button
              type="button"
              onClick={goHome}
              aria-label="Zenquanta AI home"
              className="hidden shrink-0 items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-accent/40 sm:flex"
            >
              <ZenquantaLogo className="size-6" />
              <span className="font-display hidden text-lg text-foreground lg:inline">
                Zenquanta AI
              </span>
            </button>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center">
            {pageTitle === undefined ? (
              <ChatTitle />
            ) : (
              <p className="truncate px-2 text-sm font-medium text-foreground">{pageTitle}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {isAdmin ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden gap-2 rounded-xl px-3 text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Link href="/admin">
                <Shield className="size-3.5" />
                <span>Admin</span>
              </Link>
            </Button>
          ) : null}
          <HeaderIconButton label="Search" onClick={onOpenCommandPalette}>
            <Search className="size-4" />
          </HeaderIconButton>
          {/* The open sidebar already has Settings in its footer. */}
          {!isSidebarOpen ? (
            <HeaderIconButton label="Settings" onClick={onOpenSettings}>
              <SettingsIcon className="size-4" />
            </HeaderIconButton>
          ) : null}
        </div>
      </header>
    </div>
  )
}
