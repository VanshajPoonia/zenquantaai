import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminStore, planRequestsStore } from '@/lib/storage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updatePlanRequestStatusAction } from './actions'

export default async function AdminPage() {
  await requireAdmin()
  const [overview, userRows, requests] = await Promise.all([
    adminStore.getOverview(),
    adminStore.listUserRows(),
    planRequestsStore.list(),
  ])

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Admin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Zenquanta control room
            </h1>
          </div>
          <Button asChild variant="secondary" className="rounded-xl">
            <Link href="/">Back to app</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active users" value={String(overview.activeUsers)} />
          <MetricCard label="Pending requests" value={String(overview.pendingPlanRequests)} />
          <MetricCard label="Raw total cost" value={`$${overview.totalRawCostUsd.toFixed(2)}`} />
          <MetricCard
            label="Displayed total"
            value={`$${overview.totalDisplayedCostUsd.toFixed(2)}`}
          />
          <MetricCard
            label="Revenue"
            value={`$${overview.estimatedSubscriptionRevenueUsd.toFixed(2)}`}
          />
          <MetricCard
            label="Gross margin"
            value={`$${overview.estimatedGrossMarginUsd.toFixed(2)}`}
          />
          <MetricCard label="Requests today" value={String(overview.requestsToday)} />
          <MetricCard label="Prime users" value={String(overview.usersByTier.prime)} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {userRows.map((row) => (
                <div
                  key={row.subscription.userId}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/40 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {row.profile?.email ?? row.profile?.loginId ?? row.subscription.userId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.subscription.tier.toUpperCase()} · {row.subscription.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      ${row.displayedCostUsd.toFixed(2)}
                    </Badge>
                    <Badge variant="outline">
                      {row.remainingDisplayedCredits} credits left
                    </Badge>
                    <Button asChild variant="secondary" size="sm" className="rounded-lg">
                      <Link href={`/admin/users/${row.subscription.userId}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Plan requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-border/60 bg-background/40 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {request.requestedTier.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Current: {request.currentTier.toUpperCase()}
                      </p>
                    </div>
                    <Badge variant={request.status === 'pending' ? 'secondary' : 'outline'}>
                      {request.status}
                    </Badge>
                  </div>
                  {request.note ? (
                    <p className="mt-3 text-sm text-muted-foreground">{request.note}</p>
                  ) : null}
                  <form action={updatePlanRequestStatusAction} className="mt-4 grid gap-2">
                    <input type="hidden" name="requestId" value={request.id} />
                    <Input name="adminNote" placeholder="Admin note (optional)" />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        name="status"
                        value="approved"
                        size="sm"
                        variant="secondary"
                        className="rounded-lg"
                      >
                        Approve
                      </Button>
                      <Button
                        name="status"
                        value="rejected"
                        size="sm"
                        variant="destructive"
                        className="rounded-lg"
                      >
                        Reject
                      </Button>
                      <Button
                        name="status"
                        value="activated"
                        size="sm"
                        className="rounded-lg"
                      >
                        Activate
                      </Button>
                    </div>
                  </form>
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
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
