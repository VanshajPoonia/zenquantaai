import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { runSystemHealthChecks } from '@/lib/system-health/checks'
import { HealthCheck, HealthStatus } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'System Health — Admin — Zenquanta AI',
}

const CHECK_GROUPS: Array<{ label: string; ids: string[] }> = [
  {
    label: 'Database',
    ids: ['db_url', 'db_connect', 'db_schema', 'pgvector'],
  },
  {
    label: 'AI Services',
    ids: ['openrouter'],
  },
  {
    label: 'Web Search',
    ids: ['tavily'],
  },
  {
    label: 'RAG / Embeddings',
    ids: ['embeddings'],
  },
  {
    label: 'File Storage',
    ids: ['storage_provider', 'storage_creds'],
  },
  {
    label: 'Environment',
    ids: ['auth_security', 'app_url', 'deploy_env'],
  },
]

function statusIcon(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
    case 'degraded':
      return <AlertTriangle className="size-4 shrink-0 text-amber-400" />
    case 'missing':
      return <XCircle className="size-4 shrink-0 text-rose-400" />
    case 'unknown':
      return <HelpCircle className="size-4 shrink-0 text-muted-foreground" />
  }
}

function statusBadgeVariant(status: HealthStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'default'
    case 'degraded':
      return 'secondary'
    case 'missing':
      return 'destructive'
    case 'unknown':
      return 'outline'
  }
}

function statusLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'healthy'
    case 'degraded':
      return 'degraded'
    case 'missing':
      return 'missing'
    case 'unknown':
      return 'unknown'
  }
}

function rowBorderClass(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'border-emerald-500/20 bg-emerald-500/5'
    case 'degraded':
      return 'border-amber-500/30 bg-amber-500/8'
    case 'missing':
      return 'border-rose-500/30 bg-rose-500/8'
    case 'unknown':
      return 'border-border/60 bg-background/40'
  }
}

function CheckRow({ check }: { check: HealthCheck }) {
  return (
    <div
      className={`flex min-h-[3.5rem] items-start gap-3 rounded-2xl border px-4 py-3 ${rowBorderClass(check.status)}`}
    >
      <div className="mt-0.5">{statusIcon(check.status)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{check.label}</span>
          <Badge variant={statusBadgeVariant(check.status)} className="rounded-full text-[10px] px-2 py-0">
            {statusLabel(check.status)}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{check.message}</p>
        {check.detail ? (
          <p className="mt-1 text-xs text-muted-foreground/70">{check.detail}</p>
        ) : null}
      </div>
    </div>
  )
}

function SummaryChip({ count, label, tone }: { count: number; label: string; tone: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${tone}`}>
      <span className="text-lg font-semibold text-foreground">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function formatCheckedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default async function SystemHealthPage() {
  await requireAdmin()
  const report = await runSystemHealthChecks()

  const checkById = new Map(report.checks.map((c) => [c.id, c]))

  const overallStatus: HealthStatus =
    report.summary.missing > 0
      ? 'missing'
      : report.summary.degraded > 0
        ? 'degraded'
        : 'healthy'

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Admin · System Health
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Environment validator
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Checked at {formatCheckedAt(report.checkedAt)}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex items-center gap-2">
              {statusIcon(overallStatus)}
              <span className="text-sm font-medium capitalize text-foreground">{overallStatus}</span>
            </div>
            <Button asChild variant="secondary" className="rounded-xl" size="sm">
              <Link href="/admin">Back to admin</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryChip
            count={report.summary.healthy}
            label="healthy"
            tone="border-emerald-500/20 bg-emerald-500/5"
          />
          <SummaryChip
            count={report.summary.degraded}
            label="degraded"
            tone="border-amber-500/30 bg-amber-500/8"
          />
          <SummaryChip
            count={report.summary.missing}
            label="missing"
            tone="border-rose-500/30 bg-rose-500/8"
          />
          <SummaryChip
            count={report.summary.unknown}
            label="unknown"
            tone="border-border/60 bg-background/40"
          />
        </div>

        {CHECK_GROUPS.map((group) => {
          const groupChecks = group.ids
            .map((id) => checkById.get(id))
            .filter((c): c is HealthCheck => c !== undefined)

          if (groupChecks.length === 0) return null

          return (
            <Card key={group.label} className="rounded-3xl border-border/70 bg-card/70">
              <CardHeader>
                <CardTitle>{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupChecks.map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
              </CardContent>
            </Card>
          )
        })}

        <p className="text-center text-xs text-muted-foreground">
          Secret values are never shown. This page is admin-only and does not call paid AI APIs.
        </p>
      </div>
    </main>
  )
}
