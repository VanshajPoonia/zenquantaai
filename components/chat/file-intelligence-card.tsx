'use client'

import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCcw,
  Send,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileIntelligence, FileKnowledgeStatus } from '@/types'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function formatBytes(value: number | null | undefined): string {
  if (!value) return 'Size unknown'
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not yet'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function statusTone(status: FileKnowledgeStatus) {
  switch (status) {
    case 'indexed':
      return 'border-code/40 bg-code/10 text-code'
    case 'skipped':
      return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
    case 'unsupported':
      return 'border-muted-foreground/30 bg-muted/40 text-muted-foreground'
    case 'failed':
      return 'border-destructive/40 bg-destructive/10 text-destructive'
    case 'pending':
      return 'border-live/35 bg-live/10 text-live'
  }
}

function StatusIcon({ status }: { status: FileKnowledgeStatus }) {
  if (status === 'indexed') return <CheckCircle2 className="size-4" />
  if (status === 'failed') return <AlertCircle className="size-4" />
  if (status === 'pending') return <Loader2 className="size-4" />
  return <HelpCircle className="size-4" />
}

export function FileIntelligenceCard({
  file,
  compact = false,
  showScope = false,
  isWorking = false,
  onAsk,
  onReindex,
  onDelete,
}: {
  file: FileIntelligence
  compact?: boolean
  showScope?: boolean
  isWorking?: boolean
  onAsk?: (file: FileIntelligence) => void
  onReindex?: (file: FileIntelligence) => void
  onDelete?: (file: FileIntelligence) => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canAsk = file.knowledgeStatus === 'indexed'
  const canReindex = file.embeddingsAvailable && Boolean(file.viewUrl)

  return (
    <>
      <div
        className={cn(
          'rounded-2xl border border-border/60 bg-card/45 p-4',
          compact && 'p-3'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-border/60 bg-background/70 p-2 text-muted-foreground">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {file.fileName}
              </p>
              <Badge
                variant="outline"
                className={cn('rounded-full', statusTone(file.knowledgeStatus))}
              >
                <StatusIcon status={file.knowledgeStatus} />
                <span className="ml-1">{file.knowledgeStatusLabel}</span>
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {file.mimeType ?? 'Unknown type'} / {formatBytes(file.byteSize)} / Uploaded{' '}
              {formatDate(file.createdAt)}
            </p>
            {showScope ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {file.projectId ? `Project ${file.projectId}` : 'No project'} /{' '}
                {file.conversationId ? 'Conversation scoped' : 'No conversation'}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{file.chunkCount} chunks</span>
          {file.embeddingModel ? <span>{file.embeddingModel}</span> : null}
          {file.knowledgeUpdatedAt ? (
            <span>Indexed {formatDate(file.knowledgeUpdatedAt)}</span>
          ) : null}
        </div>

        {file.knowledgeReason ? (
          <p className="mt-3 rounded-xl border border-border/60 bg-background/45 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {file.knowledgeReason}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={!file.viewUrl}
            onClick={() => file.viewUrl && window.open(file.viewUrl, '_blank', 'noopener')}
          >
            <Eye className="mr-2 size-4" />
            View
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={!file.downloadUrl}
            onClick={() =>
              file.downloadUrl && window.open(file.downloadUrl, '_blank', 'noopener')
            }
          >
            <Download className="mr-2 size-4" />
            Download
          </Button>
          {onAsk ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl"
              disabled={!canAsk}
              onClick={() => onAsk(file)}
            >
              <Send className="mr-2 size-4" />
              Ask
            </Button>
          ) : null}
          {onReindex ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!canReindex || isWorking}
              onClick={() => onReindex(file)}
            >
              {isWorking ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 size-4" />
              )}
              Re-index
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl text-destructive hover:text-destructive"
              disabled={isWorking}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this file?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes private file access and its knowledge chunks. Chat
              history keeps the attachment name as a record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleteOpen(false)
                onDelete?.(file)
              }}
            >
              Remove file
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
