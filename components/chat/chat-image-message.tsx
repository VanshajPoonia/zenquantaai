'use client'

import { Download, ExternalLink } from 'lucide-react'
import { Attachment } from '@/types'
import { Button } from '@/components/ui/button'

interface ChatImageMessageProps {
  attachment: Attachment
  onOpen: (attachment: Attachment) => void
  onDownload: (attachment: Attachment) => void
}

export function ChatImageMessage({
  attachment,
  onOpen,
  onDownload,
}: ChatImageMessageProps) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-background/80">
      <button
        type="button"
        className="block w-full cursor-pointer"
        onClick={() => onOpen(attachment)}
      >
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="max-h-[360px] w-full object-cover"
        />
      </button>
      <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
        <span>{attachment.textContent ? 'Generated visual' : 'Image attachment'}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-full px-2.5 text-xs text-foreground"
            onClick={() => onOpen(attachment)}
          >
            View
            <ExternalLink className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-full px-2.5 text-xs text-foreground"
            onClick={() => onDownload(attachment)}
          >
            Download
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
