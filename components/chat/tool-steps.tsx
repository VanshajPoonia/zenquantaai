'use client'

import { memo, useState } from 'react'
import {
  AlertCircle,
  Bookmark,
  Brain,
  ChevronDown,
  FileSearch,
  Globe,
  ImageIcon,
  Link2,
  Loader2,
  SquareArrowOutUpRight,
  Wrench,
} from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import type { MessagePart } from '@/types'
import { Button } from '@/components/ui/button'

type ToolCallPart = Extract<MessagePart, { type: 'tool_call' }>
type ToolResultPart = Extract<MessagePart, { type: 'tool_result' }>

interface ToolStep {
  call: ToolCallPart
  result?: ToolResultPart
}

const TOOL_ICONS: Record<string, typeof Globe> = {
  web_search: Globe,
  fetch_url: Link2,
  files_search: FileSearch,
  memory_search: Brain,
  save_artifact: Bookmark,
  make_image: ImageIcon,
}

export function getToolSteps(parts: MessagePart[] | undefined): ToolStep[] {
  if (!parts?.length) return []
  const results = new Map<string, ToolResultPart>()
  for (const part of parts) {
    if (part.type === 'tool_result') results.set(part.callId, part)
  }
  return parts
    .filter((part): part is ToolCallPart => part.type === 'tool_call')
    .map((call) => ({ call, result: results.get(call.callId) }))
}

function describeArgs(args: unknown): string | null {
  if (!args || typeof args !== 'object') return null
  const values = Object.values(args as Record<string, unknown>).filter(
    (value) => typeof value === 'string' && value.trim()
  ) as string[]
  return values[0]?.slice(0, 160) ?? null
}

// Reads the context here so the memoized cards above it stay stable.
function OpenArtifactButton({ artifactId, title }: { artifactId: string; title?: string }) {
  const { openWorkspaceTool } = useChatContext()

  return (
    <Button
      size="sm"
      variant="secondary"
      className="h-7 shrink-0 gap-1.5 rounded-full px-3 text-xs"
      aria-label={title ? `Open artifact ${title}` : 'Open artifact'}
      onClick={() => openWorkspaceTool({ tool: 'artifacts', artifactId })}
    >
      <SquareArrowOutUpRight className="size-3.5" />
      Open artifact
    </Button>
  )
}

const ToolStepCard = memo(function ToolStepCard({
  step,
  isStreaming,
  onCreateImage,
}: {
  step: ToolStep
  isStreaming: boolean
  onCreateImage?: (prompt: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = TOOL_ICONS[step.call.name] ?? Wrench
  const running = !step.result && isStreaming
  const failed = step.result && !step.result.ok
  const detail = describeArgs(step.call.args)
  const imagePrompt = step.result?.ok ? step.result.data?.imagePrompt : undefined
  const artifactId =
    step.call.name === 'save_artifact' && step.result?.ok
      ? step.result.data?.artifactId
      : undefined

  return (
    <div className="rounded-md border border-border bg-white/[0.02] text-[13px]">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        {running ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : failed ? (
          <AlertCircle className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <Icon className="size-3.5 shrink-0" />
        )}
        <span className="shrink-0 font-medium text-foreground/85">{step.call.label}</span>
        <span className="min-w-0 truncate">
          {step.result ? step.result.summary : detail ?? 'Working'}
        </span>
        <ChevronDown
          className={cn('ml-auto size-3.5 shrink-0 transition-transform', expanded && 'rotate-180')}
        />
      </button>
      {expanded ? (
        <div className="space-y-1.5 border-t border-border px-2.5 py-2 text-[12px] text-muted-foreground">
          {detail ? <p className="[overflow-wrap:anywhere]">Input: {detail}</p> : null}
          {step.result?.output ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] font-mono text-[11px] leading-5">
              {step.result.output}
            </pre>
          ) : null}
        </div>
      ) : null}
      {imagePrompt && onCreateImage ? (
        <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
          <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{imagePrompt}</p>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 shrink-0 gap-1.5 rounded-full px-3 text-xs"
            onClick={() => onCreateImage(imagePrompt)}
          >
            <ImageIcon className="size-3.5" />
            Create with Prism
          </Button>
        </div>
      ) : null}
      {artifactId ? (
        <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
          <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
            {step.result?.data?.artifactTitle ?? 'Saved to Artifact Studio'}
          </p>
          <OpenArtifactButton artifactId={artifactId} title={step.result?.data?.artifactTitle} />
        </div>
      ) : null}
    </div>
  )
})

export const ToolSteps = memo(function ToolSteps({
  parts,
  isStreaming,
  onCreateImage,
}: {
  parts: MessagePart[] | undefined
  isStreaming: boolean
  onCreateImage?: (prompt: string) => void
}) {
  const steps = getToolSteps(parts)
  if (steps.length === 0) return null

  return (
    <div className="mb-3 flex flex-col gap-1.5">
      {steps.map((step) => (
        <ToolStepCard
          key={step.call.callId}
          step={step}
          isStreaming={isStreaming}
          onCreateImage={onCreateImage}
        />
      ))}
    </div>
  )
})
