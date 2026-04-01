import Link from 'next/link'
import { requireServerUser } from '@/lib/auth/require-admin'
import {
  conversationStore,
  imageGenerationEventsStore,
  planRequestsStore,
  subscriptionsStore,
  usageEventsStore,
} from '@/lib/storage'
import {
  getAssistantUsageBreakdown,
  getDisplayedCreditsSnapshot,
} from '@/lib/billing/costs'
import { usdToDisplayedCredits } from '@/lib/config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const { user } = await requireServerUser()
  const [subscription, usageEvents, imageEvents, requests, conversations] =
    await Promise.all([
      subscriptionsStore.ensureForUser(user),
      usageEventsStore.listByUser(user.id),
      imageGenerationEventsStore.listByUser(user.id),
      planRequestsStore.listByUser(user.id),
      conversationStore.list(user.id),
    ])

  const displayedTextCostUsd = usageEvents.reduce(
    (total, event) => total + event.displayedCostUsd,
    0
  )
  const displayedImageCostUsd = imageEvents.reduce(
    (total, event) => total + event.displayedCostUsd,
    0
  )
  const totalDisplayedCostUsd = displayedTextCostUsd + displayedImageCostUsd
  const displayedBudget = getDisplayedCreditsSnapshot(subscription)
  const usedDisplayedCredits = usdToDisplayedCredits(totalDisplayedCostUsd)
  const assistantBreakdown = getAssistantUsageBreakdown({
    textEvents: usageEvents,
    imageEvents,
  })
  const pendingRequest =
    requests.find((request) => request.status === 'pending') ?? null

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
          </div>
        </div>

        {pendingRequest ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Your {pendingRequest.requestedTier.toUpperCase()} plan request has been
            received and will be activated soon.
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
                    <p className="font-medium capitalize text-foreground">
                      {item.family}
                    </p>
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

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="rounded-3xl border-border/70 bg-card/70">
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
                    <p className="truncate font-medium text-foreground">
                      {conversation.title}
                    </p>
                    <Badge variant="outline" className="capitalize">
                      {conversation.mode}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-card/70">
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
                    <p className="truncate font-medium text-foreground">
                      {event.prompt}
                    </p>
                    <Badge variant="secondary">
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
