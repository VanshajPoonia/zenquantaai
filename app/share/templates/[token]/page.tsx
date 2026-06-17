import type { Metadata } from 'next'
import Link from 'next/link'
import { BookText, Globe, Lock, Play } from 'lucide-react'
import { neonTemplateSharesRepository } from '@/lib/db/repositories'
import { PublicPlaybookShare, PublicPromptShare, PublicTemplateShare } from '@/types'
import { CopyToWorkspaceButton } from './copy-button'

export const runtime = 'nodejs'

const ASSISTANT_NAMES: Record<string, string> = {
  nova: 'Nova',
  velora: 'Velora',
  axiom: 'Axiom',
  forge: 'Forge',
  pulse: 'Pulse',
  prism: 'Prism',
}

const MODE_LABELS: Record<string, string> = {
  any: 'Any mode',
  general: 'General',
  creative: 'Creative',
  logic: 'Analysis',
  code: 'Code',
  live: 'Live',
  image: 'Image',
}

function isValidToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{40,60}$/.test(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  if (!isValidToken(token)) return { title: 'Not found — Zenquanta AI' }

  const result = await neonTemplateSharesRepository.getPublicByToken(token)
  if (!result) return { title: 'Not found — Zenquanta AI' }

  const typeLabel = result.template.type === 'prompt' ? 'prompt' : 'AI Playbook'
  return {
    title: `${result.template.title} — Zenquanta AI`,
    description: `Shared ${typeLabel} template from Zenquanta AI`,
    robots: result.share.visibility === 'public_link' ? 'index, follow' : 'noindex, nofollow',
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function NotFoundView() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/40 p-8 text-center">
        <BookText className="mx-auto mb-4 size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This share link may have expired, been revoked, or never existed.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          Go to Zenquanta AI
        </Link>
      </div>
    </div>
  )
}

function ShareHeader({
  result,
  token,
}: {
  result: PublicTemplateShare
  token: string
}) {
  const { share, template } = result
  const typeLabel = template.type === 'prompt' ? 'Prompt template' : 'AI Playbook'

  return (
    <div className="mb-6 rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{template.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
              {typeLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
              {share.visibility === 'public_link' ? (
                <>
                  <Globe className="size-3" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="size-3" />
                  Private link
                </>
              )}
            </span>
            <span>Shared {formatDate(share.createdAt)}</span>
            {share.expiresAt ? (
              <span>Expires {formatDate(share.expiresAt)}</span>
            ) : null}
          </div>
        </div>
        <Link href="/" className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
          Zenquanta AI
        </Link>
      </div>
      <div className="mt-4">
        <CopyToWorkspaceButton token={token} templateType={template.type} title={template.title} />
      </div>
    </div>
  )
}

function PromptView({ result }: { result: PublicPromptShare }) {
  const { template } = result
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border/60 px-2 py-0.5">
          {MODE_LABELS[template.mode] ?? template.mode}
        </span>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/35 p-4">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-6 text-foreground">
          {template.content}
        </pre>
      </div>
    </div>
  )
}

function PlaybookView({ result }: { result: PublicPlaybookShare }) {
  const { template } = result
  return (
    <div className="space-y-4">
      {template.description ? (
        <p className="text-sm text-muted-foreground">{template.description}</p>
      ) : null}

      {template.variables.length > 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Variables</p>
          <div className="flex flex-wrap gap-1.5">
            {template.variables.map((variable) => (
              <span
                key={variable.name}
                className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {`{{${variable.name}}}`}
                {variable.label && variable.label !== variable.name
                  ? ` — ${variable.label}`
                  : ''}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {template.steps.map((step, index) => (
          <div
            key={`step-${index}`}
            className="rounded-2xl border border-border/60 bg-card/35 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {step.order}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Play className="size-3" />
                <span>{ASSISTANT_NAMES[step.assistantFamily] ?? step.assistantFamily}</span>
                {step.title ? (
                  <>
                    <span>·</span>
                    <span className="font-medium text-foreground">{step.title}</span>
                  </>
                ) : null}
              </div>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm leading-6 text-foreground">
              {step.template}
            </pre>
            {step.variableNames.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {step.variableNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-border/60 px-1.5 py-0 text-[10px] text-muted-foreground"
                  >
                    {`{{${name}}}`}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function ShareTemplatePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  if (!isValidToken(token)) return <NotFoundView />

  const result = await neonTemplateSharesRepository.getPublicByToken(token)
  if (!result) return <NotFoundView />

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <ShareHeader result={result} token={token} />

        {result.template.type === 'prompt' ? (
          <PromptView result={result as PublicPromptShare} />
        ) : (
          <PlaybookView result={result as PublicPlaybookShare} />
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Shared via{' '}
          <Link href="/" className="hover:text-foreground">
            Zenquanta AI
          </Link>{' '}
          &middot; Read-only template preview
        </p>
      </div>
    </div>
  )
}
