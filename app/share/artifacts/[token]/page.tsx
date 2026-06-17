import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Globe, Lock } from 'lucide-react'
import { neonArtifactSharesRepository } from '@/lib/db/repositories'
import { ArtifactType, PublicArtifactShare } from '@/types'

export const runtime = 'nodejs'

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  document: 'Document',
  code: 'Code',
  table: 'Table',
  image_prompt: 'Image prompt',
  research_report: 'Research report',
  brand_asset: 'Brand asset',
  checklist: 'Checklist',
  workflow_output: 'Workflow output',
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
  if (!isValidToken(token)) {
    return { title: 'Not found — Zenquanta AI' }
  }

  const result = await neonArtifactSharesRepository.getPublicByToken(token)
  if (!result) {
    return { title: 'Not found — Zenquanta AI' }
  }

  return {
    title: `${result.artifact.title} — Zenquanta AI`,
    description: `Shared ${ARTIFACT_TYPE_LABELS[result.artifact.artifactType].toLowerCase()} from Zenquanta AI`,
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
        <FileText className="mx-auto mb-4 size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This share link may have expired, been revoked, or never existed.
        </p>
      </div>
    </div>
  )
}

function SharedArtifactView({ result }: { result: PublicArtifactShare }) {
  const { share, artifact } = result

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">{artifact.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
                  {ARTIFACT_TYPE_LABELS[artifact.artifactType]}
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
                      Private
                    </>
                  )}
                </span>
                <span>Shared {formatDate(share.createdAt)}</span>
                {share.expiresAt ? (
                  <span>Expires {formatDate(share.expiresAt)}</span>
                ) : null}
              </div>
            </div>
            <Link
              href="/"
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Zenquanta AI
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/35 p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm leading-6 text-foreground">
            {artifact.content}
          </pre>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Shared via{' '}
          <Link href="/" className="hover:text-foreground">
            Zenquanta AI
          </Link>{' '}
          &middot; Read-only view
        </p>
      </div>
    </div>
  )
}

export default async function ShareArtifactPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  if (!isValidToken(token)) {
    return <NotFoundView />
  }

  const result = await neonArtifactSharesRepository.getPublicByToken(token)
  if (!result) {
    return <NotFoundView />
  }

  return <SharedArtifactView result={result} />
}
