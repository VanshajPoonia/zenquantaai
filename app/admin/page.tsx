import Link from 'next/link'
import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminStore, planRequestsStore } from '@/lib/storage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updatePlanRequestStatusAction, updateUserAdminAction } from './actions'

const USER_GRID_COLUMNS =
  'grid-cols-[minmax(19rem,2.5fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_minmax(8rem,0.9fr)_minmax(8rem,0.9fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(10rem,1fr)]'

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const params = searchParams ? await searchParams : {}
  const [overview, userRows, requests] = await Promise.all([
    adminStore.getOverview(),
    adminStore.listUserRows(),
    planRequestsStore.list(),
  ])
  const updated = params?.updated === '1'

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[112rem] flex-col gap-8">
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

        {updated ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Admin changes were saved successfully.
          </div>
        ) : null}

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

        <Card className="rounded-3xl border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-6">
            <div className="overflow-x-auto px-6">
              <div className="min-w-[104rem] space-y-3">
                <div className={`grid ${USER_GRID_COLUMNS} gap-3 px-4 pb-1`}>
                  <ColumnHeader>User</ColumnHeader>
                  <ColumnHeader>Displayed</ColumnHeader>
                  <ColumnHeader>Credits Left</ColumnHeader>
                  <ColumnHeader>Tier</ColumnHeader>
                  <ColumnHeader>Status</ColumnHeader>
                  <ColumnHeader>Role</ColumnHeader>
                  <ColumnHeader>Core Tokens</ColumnHeader>
                  <ColumnHeader>Tier Tokens</ColumnHeader>
                  <ColumnHeader>Image Credits</ColumnHeader>
                  <ColumnHeader>Daily Msg</ColumnHeader>
                  <ColumnHeader>Images/Day</ColumnHeader>
                  <ColumnHeader>Actions</ColumnHeader>
                </div>

                {userRows.map((row) => (
                  <form
                    key={row.subscription.userId}
                    action={updateUserAdminAction}
                    className={`grid ${USER_GRID_COLUMNS} items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-4`}
                  >
                    <input type="hidden" name="targetUserId" value={row.subscription.userId} />
                    <input type="hidden" name="returnTo" value="admin" />

                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-foreground">
                        {row.profile?.email ?? row.profile?.loginId ?? row.subscription.userId}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{row.subscription.tier.toUpperCase()}</span>
                        <span className="size-1 rounded-full bg-border" />
                        <span>{row.subscription.status}</span>
                        {row.profile?.role === 'admin' ? (
                          <>
                            <span className="size-1 rounded-full bg-border" />
                            <span className="font-medium text-amber-200">Admin</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <StaticMetricCell value={`$${row.displayedCostUsd.toFixed(2)}`} />
                    <StaticMetricCell value={String(row.remainingDisplayedCredits)} />

                    <CompactFieldSelect
                      name="tier"
                      defaultValue={row.subscription.tier}
                      options={['free', 'basic', 'pro', 'ultra', 'prime']}
                    />
                    <CompactFieldSelect
                      name="status"
                      defaultValue={row.subscription.status}
                      options={['active', 'paused', 'cancelled']}
                    />
                    <CompactFieldSelect
                      name="role"
                      defaultValue={row.profile?.role ?? 'user'}
                      options={['user', 'admin']}
                    />

                    <CompactFieldInput
                      name="coreTokensIncluded"
                      defaultValue={String(
                        row.override?.coreTokensIncluded ??
                          row.subscription.coreTokensIncluded
                      )}
                    />
                    <CompactFieldInput
                      name="tierTokensIncluded"
                      defaultValue={String(
                        row.override?.tierTokensIncluded ??
                          row.subscription.tierTokensIncluded
                      )}
                    />
                    <CompactFieldInput
                      name="imageCreditsIncluded"
                      defaultValue={String(
                        row.override?.imageCreditsIncluded ??
                          row.subscription.imageCreditsIncluded
                      )}
                    />
                    <CompactFieldInput
                      name="dailyMessageLimit"
                      defaultValue={String(
                        row.override?.dailyMessageLimit ??
                          row.subscription.dailyMessageLimit
                      )}
                    />
                    <CompactFieldInput
                      name="maxImagesPerDay"
                      defaultValue={String(
                        row.override?.maxImagesPerDay ??
                          row.subscription.maxImagesPerDay
                      )}
                    />

                    <div className="flex flex-col gap-2">
                      <Button type="submit" size="sm" className="w-full rounded-lg">
                        Save
                      </Button>
                      <Button asChild variant="secondary" size="sm" className="w-full rounded-lg">
                        <Link href={`/admin/users/${row.subscription.userId}`}>Open</Link>
                      </Button>
                    </div>
                  </form>
                ))}
              </div>
            </div>
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
                <form action={updatePlanRequestStatusAction} className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <input type="hidden" name="requestId" value={request.id} />
                  <Input name="adminNote" placeholder="Admin note (optional)" />
                  <div className="flex flex-wrap gap-2 md:justify-end">
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

function ColumnHeader({ children }: { children: ReactNode }) {
  return (
    <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  )
}

function StaticMetricCell({ value }: { value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm font-medium text-foreground">
      {value}
    </div>
  )
}

function CompactFieldInput({
  name,
  defaultValue,
}: {
  name: string
  defaultValue: string
}) {
  return (
    <Input
      name={name}
      defaultValue={defaultValue}
      className="h-10 rounded-xl border-border/60 bg-background/50 text-sm"
    />
  )
}

function CompactFieldSelect({
  name,
  defaultValue,
  options,
}: {
  name: string
  defaultValue: string
  options: string[]
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="flex h-10 w-full rounded-xl border border-border/60 bg-background/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
