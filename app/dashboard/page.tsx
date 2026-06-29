import Link from 'next/link'
import { requireServerUser } from '@/lib/auth/require-admin'
import {
  DEFAULT_ACTIVITY_LIMIT,
  isWorkspaceActivityType,
  WORKSPACE_ACTIVITY_TYPES,
} from '@/lib/activity/timeline'
import {
  neonActivityRepository,
  neonConversationRepository,
  neonImageGenerationEventsRepository,
  neonPlanRequestsRepository,
  neonProjectsRepository,
  neonSubscriptionsRepository,
  neonUsageEventsRepository,
} from '@/lib/db/repositories'
import {
  filterEventsForSubscriptionPeriod,
  getAssistantUsageBreakdown,
  getDisplayedCreditsSnapshot,
} from '@/lib/billing/costs'
import {
  getPlanRequestStatusLabel,
  sanitizePlanRequestAdminNote,
} from '@/lib/billing/upgrade-nudges'
import {
  ASSISTANT_FAMILY_COPY,
  ASSISTANT_PUBLIC_PAGES,
  usdToDisplayedCredits,
} from '@/lib/config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  WorkspaceActivityItem,
  WorkspaceActivityType,
} from '@/types'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user, profile } = await requireServerUser()
  const params = await searchParams
  const adminRequired = params.admin === 'required'
  const requestedActivityProjectId = firstParam(params.activityProjectId)
  const requestedActivityType = firstParam(params.activityType)
  const activityType = isWorkspaceActivityType(requestedActivityType)
    ? requestedActivityType
    : null
  const subscription = await neonSubscriptionsRepository.ensureForUser(user)
  const periodStart = new Date(subscription.currentPeriodStartedAt)
  const periodEnd = new Date(subscription.currentPeriodEndsAt)
  const projects = await neonProjectsRepository.list(user.id, { limit: 100 })
  const activityProjectId = projects.some(
    (project) => project.id === requestedActivityProjectId
  )
    ? requestedActivityProjectId
    : null
  const [usageEvents, imageEvents, requests, conversations, activity] = await Promise.all([
    neonUsageEventsRepository.listByUser(user.id, {
      from: periodStart,
      to: periodEnd,
    }),
    neonImageGenerationEventsRepository.listByUser(user.id, {
      from: periodStart,
      to: periodEnd,
    }),
    neonPlanRequestsRepository.listByUser(user.id),
    neonConversationRepository.list(user.id, { limit: 8 }),
    neonActivityRepository.list(user.id, {
      limit: DEFAULT_ACTIVITY_LIMIT,
      projectId: activityProjectId,
      type: activityType,
    }),
  ])

  const periodUsageEvents = filterEventsForSubscriptionPeriod(
    usageEvents,
    subscription
  )
  const periodImageEvents = filterEventsForSubscriptionPeriod(
    imageEvents,
    subscription
  )

  const displayedTextCostUsd = periodUsageEvents.reduce(
    (total, event) => total + event.displayedCostUsd,
    0
  )
  const displayedImageCostUsd = periodImageEvents.reduce(
    (total, event) => total + event.displayedCostUsd,
    0
  )
  const totalDisplayedCostUsd = displayedTextCostUsd + displayedImageCostUsd
  const displayedBudget = getDisplayedCreditsSnapshot(subscription)
  const usedDisplayedCredits = usdToDisplayedCredits(totalDisplayedCostUsd)
  const assistantBreakdown = getAssistantUsageBreakdown({
    textEvents: periodUsageEvents,
    imageEvents: periodImageEvents,
  })
  const pendingRequest =
    requests.find((request) => request.status === 'pending') ?? null
  const latestRequest = requests[0] ?? null

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Your Zenquanta usage
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Track displayed credits, text usage, image usage, recent activity,
              and any pending plan requests.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="secondary" className="rounded-xl">
              <Link href="/">Back to app</Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link href="/pricing">View plans</Link>
            </Button>
            {profile?.role === 'admin' ? (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/admin">Open admin</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {adminRequired ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Admin access is enabled only for accounts with the admin role. If you
            just updated your role, refresh this page and try again.
          </div>
        ) : null}

        {latestRequest ? (
          <div className="rounded-2xl border border-border/70 bg-card/70 px-5 py-4 text-sm text-foreground">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Plan request
                </p>
                <p className="mt-1 font-medium">
                  {getPlanRequestStatusLabel(latestRequest.status)} ·{' '}
                  {latestRequest.requestedTier.toUpperCase()}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {latestRequest.status === 'pending'
                    ? 'Your request is waiting for manual admin review and activation.'
                    : latestRequest.status === 'activated'
                      ? `Your request was activated. Current plan: ${subscription.tier.toUpperCase()}.`
                      : latestRequest.status === 'approved'
                        ? 'Your request was approved and is waiting for manual activation.'
                        : 'Your request was not approved. You can submit another manual request from pricing.'}
                </p>
                {latestRequest.status === 'rejected' ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {sanitizePlanRequestAdminNote(latestRequest.adminNote) ??
                      'No additional admin note was provided.'}
                  </p>
                ) : null}
              </div>
              <Button asChild variant="secondary" className="rounded-xl">
                <Link href="/pricing">
                  {pendingRequest ? 'Review pending request' : 'View pricing'}
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Current plan" value={subscription.tier.toUpperCase()} />
          <MetricCard
            label="Displayed credits"
            value={displayedBudget.totalDisplayedCredits.toLocaleString()}
          />
          <MetricCard
            label="Used credits"
            value={usedDisplayedCredits.toLocaleString()}
          />
          <MetricCard
            label="Remaining credits"
            value={Math.max(
              0,
              displayedBudget.totalDisplayedCredits - usedDisplayedCredits
            ).toLocaleString()}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Usage overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <MetricBlock label="Text usage" value={`$${displayedTextCostUsd.toFixed(2)}`} />
              <MetricBlock label="Image usage" value={`$${displayedImageCostUsd.toFixed(2)}`} />
              <MetricBlock label="Total displayed" value={`$${totalDisplayedCostUsd.toFixed(2)}`} />
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Assistant breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assistantBreakdown.map((item) => (
                <div
                  key={item.family}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/${ASSISTANT_PUBLIC_PAGES[item.family].slug}`}
                      className="font-medium capitalize text-foreground transition-colors hover:text-primary"
                    >
                      {ASSISTANT_FAMILY_COPY[item.family].shortName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.events} requests
                    </p>
                  </div>
                  <Badge variant="secondary">
                    ${item.displayedCostUsd.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-border/70 bg-card/70">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Activity timeline</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Recent workspace changes from conversations, projects, files,
                  artifacts, playbooks, Prism, Model Duel, assistants, and plan
                  requests.
                </p>
              </div>
              <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Project
                  <select
                    name="activityProjectId"
                    defaultValue={activityProjectId ?? ''}
                    className="h-10 rounded-xl border border-border/70 bg-background/70 px-3 text-sm normal-case tracking-normal text-foreground outline-none transition focus:border-primary"
                  >
                    <option value="">All projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Type
                  <select
                    name="activityType"
                    defaultValue={activityType ?? ''}
                    className="h-10 rounded-xl border border-border/70 bg-background/70 px-3 text-sm normal-case tracking-normal text-foreground outline-none transition focus:border-primary"
                  >
                    <option value="">All activity</option>
                    {WORKSPACE_ACTIVITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {activityTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <Button type="submit" className="h-10 rounded-xl">
                    Apply
                  </Button>
                  {activityProjectId || activityType ? (
                    <Button asChild type="button" variant="secondary" className="h-10 rounded-xl">
                      <Link href="/dashboard">Reset</Link>
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {activity.items.length > 0 ? (
              <div className="space-y-3">
                {activity.items.map((item) => (
                  <ActivityTimelineItem key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-5 py-8 text-center">
                <p className="font-medium text-foreground">No activity yet</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  New workspace activity will appear here after you create chats,
                  files, artifacts, images, playbooks, or plan requests.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          <Card className="min-w-0 rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Recent conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {conversations.slice(0, 8).map((conversation) => (
                <div
                  key={conversation.id}
                  className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-medium text-foreground">
                      {conversation.title}
                    </p>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {conversation.mode}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Recent image generations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {imageEvents.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-border/60 bg-background/40 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-medium text-foreground">
                      {event.prompt}
                    </p>
                    <Badge variant="secondary" className="shrink-0">
                      {event.imageCreditsConsumed} credits
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function activityTypeLabel(type: WorkspaceActivityType): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function activityTimeLabel(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function ActivityTimelineItem({ item }: { item: WorkspaceActivityItem }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{activityTypeLabel(item.type)}</Badge>
            <span className="text-xs text-muted-foreground">
              {activityTimeLabel(item.occurredAt)}
            </span>
            {item.projectName ? (
              <Badge variant="outline">{item.projectName}</Badge>
            ) : null}
          </div>
          <div>
            <p className="truncate font-medium text-foreground">{item.title}</p>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 rounded-xl">
          <Link href={item.href}>Open</Link>
        </Button>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-3xl border-border/70 bg-card/70">
      <CardContent className="space-y-2 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}
