import Link from 'next/link'
import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth/require-admin'
import {
  neonAdminRepository,
  neonPlanRequestsRepository,
} from '@/lib/db/repositories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CompactPlanLimitFields } from '@/components/admin/plan-limit-fields'
import { updatePlanRequestStatusAction, updateUserAdminAction } from './actions'

const USER_GRID_COLUMNS =
  'grid-cols-[minmax(19rem,2.5fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_minmax(8rem,0.9fr)_minmax(8rem,0.9fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(10rem,1fr)]'

const PLAN_TIERS = ['free', 'basic', 'pro', 'ultra', 'prime']
const ASSISTANT_FAMILIES = ['nova', 'velora', 'axiom', 'forge', 'pulse', 'prism']

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const params = searchParams ? await searchParams : {}
  const filterInput = {
    from: getParam(params.from),
    to: getParam(params.to),
    tier: getParam(params.tier),
    assistant: getParam(params.assistant),
    user: getParam(params.user),
  }
  const normalizedFilters =
    neonAdminRepository.normalizeAnalyticsFilters(filterInput)
  const [overview, userRows, requests] = await Promise.all([
    neonAdminRepository.getOverview(filterInput),
    neonAdminRepository.listUserRows(filterInput),
    neonPlanRequestsRepository.list(),
  ])
  const updated = getParam(params?.updated) === '1'
  const selectedPeriodLabel = formatPeriodLabel(normalizedFilters)

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
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/admin/system-health">System health</Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-xl">
              <Link href="/">Back to app</Link>
            </Button>
          </div>
        </div>

        {updated ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Admin changes were saved successfully.
          </div>
        ) : null}

        <Card className="rounded-3xl border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle>Analytics filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
              <FilterField label="From">
                <Input
                  type="date"
                  name="from"
                  defaultValue={normalizedFilters.from}
                  className="rounded-xl"
                />
              </FilterField>
              <FilterField label="To">
                <Input
                  type="date"
                  name="to"
                  defaultValue={normalizedFilters.to}
                  className="rounded-xl"
                />
              </FilterField>
              <FilterField label="Plan">
                <select
                  name="tier"
                  defaultValue={normalizedFilters.tier ?? ''}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All plans</option>
                  {PLAN_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Assistant">
                <select
                  name="assistant"
                  defaultValue={normalizedFilters.assistant ?? ''}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All assistants</option>
                  {ASSISTANT_FAMILIES.map((assistant) => (
                    <option key={assistant} value={assistant}>
                      {assistant}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="User">
                <Input
                  name="user"
                  defaultValue={normalizedFilters.user ?? ''}
                  placeholder="ID, email, or login"
                  className="rounded-xl"
                />
              </FilterField>
              <div className="flex gap-2">
                <Button type="submit" className="rounded-xl">
                  Apply
                </Button>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/admin">Reset</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active users" value={String(overview.activeUsers)} />
          <MetricCard label="Pending requests" value={String(overview.pendingPlanRequests)} />
          <MetricCard
            label="Raw model cost"
            value={formatCurrency(overview.totalRawCostUsd)}
            detail={selectedPeriodLabel}
          />
          <MetricCard
            label="Displayed usage"
            value={formatCurrency(overview.totalDisplayedCostUsd)}
            detail={selectedPeriodLabel}
          />
          <MetricCard
            label="Estimated revenue"
            value={formatCurrency(overview.estimatedSubscriptionRevenueUsd)}
            detail="Active manual plan state, not payments"
          />
          <MetricCard
            label="Estimated gross margin"
            value={formatCurrency(overview.estimatedGrossMarginUsd)}
            detail="Estimated revenue minus raw cost"
          />
          <MetricCard label="Requests today" value={String(overview.requestsToday)} />
          <MetricCard label="Prime users" value={String(overview.usersByTier.prime)} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <AnalyticsCard title="Activation funnel">
            {overview.productAnalytics.activationFunnel.length ? (
              overview.productAnalytics.activationFunnel.map((item) => (
                <InsightRow
                  key={item.id}
                  label={item.label}
                  value={item.count.toLocaleString()}
                  detail={`${formatPercent(item.rate)} of filtered users · ${item.detail}`}
                />
              ))
            ) : (
              <EmptyAnalyticsState label="No activation data for this filter." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Feature adoption">
            {overview.productAnalytics.featureAdoption.length ? (
              overview.productAnalytics.featureAdoption.map((item) => (
                <InsightRow
                  key={item.id}
                  label={item.label}
                  value={item.value.toLocaleString()}
                  detail={item.detail}
                />
              ))
            ) : (
              <EmptyAnalyticsState label="No feature adoption data for this filter." />
            )}
          </AnalyticsCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <AnalyticsCard title="File indexing outcomes">
            <InsightRow
              label="Indexed"
              value={overview.productAnalytics.fileIndexing.indexed.toLocaleString()}
              detail="Files with searchable uploaded-file knowledge."
            />
            <InsightRow
              label="Skipped"
              value={overview.productAnalytics.fileIndexing.skipped.toLocaleString()}
              detail="Files skipped because extraction was empty or embeddings were unavailable."
            />
            <InsightRow
              label="Unsupported"
              value={overview.productAnalytics.fileIndexing.unsupported.toLocaleString()}
              detail="Files not supported by the current text extraction pipeline."
            />
            <InsightRow
              label="Failed or pending"
              value={(
                overview.productAnalytics.fileIndexing.failed +
                overview.productAnalytics.fileIndexing.pending
              ).toLocaleString()}
              detail={`${overview.productAnalytics.fileIndexing.failed.toLocaleString()} failed · ${overview.productAnalytics.fileIndexing.pending.toLocaleString()} pending.`}
            />
          </AnalyticsCard>

          <AnalyticsCard title="Feedback signals">
            <InsightRow
              label="Total feedback"
              value={overview.productAnalytics.feedback.total.toLocaleString()}
              detail={`${overview.productAnalytics.feedback.ratings.up.toLocaleString()} up · ${overview.productAnalytics.feedback.ratings.down.toLocaleString()} down · ${overview.productAnalytics.feedback.ratings.neutral.toLocaleString()} neutral.`}
            />
            <InsightRow
              label="Downvote rate"
              value={formatPercent(overview.productAnalytics.feedback.downvoteRate)}
              detail="Computed from captured feedback events in the selected period."
              tone={
                overview.productAnalytics.feedback.downvoteRate >= 0.25 &&
                overview.productAnalytics.feedback.ratings.down >= 5
                  ? 'warning'
                  : 'neutral'
              }
            />
            {overview.productAnalytics.feedback.byEntityType.slice(0, 4).map((item) => (
              <InsightRow
                key={item.entityType}
                label={item.entityType.replace(/_/g, ' ')}
                value={item.total.toLocaleString()}
                detail={`${item.up} up · ${item.down} down · ${item.neutral} neutral.`}
                tone={item.down > item.up && item.down >= 3 ? 'warning' : 'neutral'}
              />
            ))}
          </AnalyticsCard>

          <AnalyticsCard title="Operational signals">
            {overview.productAnalytics.operationalSignals.length ? (
              overview.productAnalytics.operationalSignals.map((item) => (
                <InsightRow
                  key={item.id}
                  label={item.label}
                  value={item.value.toLocaleString()}
                  detail={item.detail}
                  tone={item.tone}
                />
              ))
            ) : (
              <EmptyAnalyticsState label="No operational signals for this filter." />
            )}
          </AnalyticsCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <AnalyticsCard title="Text vs image cost split">
            <InsightRow
              label="Text"
              value={formatCurrency(overview.textVsImageCostSplit.textRawCostUsd)}
              detail={`${overview.textVsImageCostSplit.textEvents.toLocaleString()} events · ${formatCurrency(overview.textVsImageCostSplit.textDisplayedCostUsd)} displayed`}
            />
            <InsightRow
              label="Image"
              value={formatCurrency(overview.textVsImageCostSplit.imageRawCostUsd)}
              detail={`${overview.textVsImageCostSplit.imageCount.toLocaleString()} images · ${formatCurrency(overview.textVsImageCostSplit.imageDisplayedCostUsd)} displayed`}
            />
          </AnalyticsCard>

          <AnalyticsCard title="Estimated margin by plan">
            {overview.marginByPlan.some(
              (item) => item.activeUsers > 0 || item.rawCostUsd > 0
            ) ? (
              overview.marginByPlan.map((item) => (
                <InsightRow
                  key={item.tier}
                  label={item.tier.toUpperCase()}
                  value={formatCurrency(item.estimatedGrossMarginUsd)}
                  detail={`${item.activeUsers} active · ${formatCurrency(item.estimatedRevenueUsd)} est revenue · ${formatCurrency(item.rawCostUsd)} raw · ${formatMarginRate(item.marginRate)} margin · ${formatCurrency(item.rawCostPerActiveUserUsd)} raw/user`}
                />
              ))
            ) : (
              <EmptyAnalyticsState label="No plan margin data for this filter." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Users close to limits">
            {overview.usersCloseToLimits.length ? (
              overview.usersCloseToLimits.map((user) => (
                <InsightRow
                  key={user.userId}
                  label={getDisplayUser(user)}
                  value={formatPercent(user.highestUsageRatio)}
                  detail={`${user.tier.toUpperCase()} · ${user.limits
                    .map(formatLimitDetail)
                    .join(' · ')}`}
                  href={`/admin/users/${user.userId}`}
                />
              ))
            ) : (
              <EmptyAnalyticsState label="No users are at or above 80% of tracked limits." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="High raw-cost users">
            {overview.mostExpensiveUsers.length ? (
              overview.mostExpensiveUsers.map((user) => (
                <InsightRow
                  key={user.userId}
                  label={getDisplayUser(user)}
                  value={formatCurrency(user.rawCostUsd)}
                  detail={`${formatCurrency(user.displayedCostUsd)} displayed${user.isUnusuallyHigh ? ' · unusually high' : ''}`}
                  href={`/admin/users/${user.userId}`}
                />
              ))
            ) : (
              <EmptyAnalyticsState label="No raw cost has been recorded for this filter." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Most expensive models">
            {overview.mostExpensiveModels.length ? (
              overview.mostExpensiveModels.map((model) => (
                <InsightRow
                  key={model.model}
                  label={model.model}
                  value={formatCurrency(model.rawCostUsd)}
                  detail={`${model.events.toLocaleString()} events · ${formatCurrency(model.displayedCostUsd)} displayed`}
                />
              ))
            ) : (
              <EmptyAnalyticsState label="No model usage has been recorded for this filter." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Most used assistants">
            {overview.mostUsedAssistants.length ? (
              overview.mostUsedAssistants.map((assistant) => (
                <InsightRow
                  key={assistant.family}
                  label={assistant.family.toUpperCase()}
                  value={assistant.events.toLocaleString()}
                  detail={`${formatCurrency(assistant.rawCostUsd ?? 0)} raw · ${formatCurrency(assistant.displayedCostUsd)} displayed`}
                />
              ))
            ) : (
              <EmptyAnalyticsState label="No assistant usage has been recorded for this filter." />
            )}
          </AnalyticsCard>
        </div>

        <Card className="rounded-3xl border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-6">
            <div className="overflow-x-auto px-6">
              <div className="min-w-[112rem] space-y-3">
                <div className={`grid ${USER_GRID_COLUMNS} gap-3 px-4 pb-1`}>
                  <ColumnHeader>User</ColumnHeader>
                  <ColumnHeader>Displayed</ColumnHeader>
                  <ColumnHeader>Raw</ColumnHeader>
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

                {userRows.length ? (
                  userRows.map((row) => (
                    <form
                      key={row.subscription.userId}
                      action={updateUserAdminAction}
                      className={`grid ${USER_GRID_COLUMNS} items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-4`}
                    >
                      <input type="hidden" name="targetUserId" value={row.subscription.userId} />
                      <input type="hidden" name="returnTo" value="admin" />

                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-foreground">
                          {row.profile
                            ? getDisplayUser({
                                userId: row.subscription.userId,
                                displayName: row.profile.displayName,
                                email: row.profile.email,
                                loginId: row.profile.loginId,
                              })
                            : row.subscription.userId}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{row.subscription.tier.toUpperCase()}</span>
                          <span className="size-1 rounded-full bg-border" />
                          <span>{row.subscription.status}</span>
                          {row.highestUsageRatio >= 0.8 ? (
                            <>
                              <span className="size-1 rounded-full bg-border" />
                              <span>{formatPercent(row.highestUsageRatio)} highest limit use</span>
                            </>
                          ) : null}
                          {row.profile?.role === 'admin' ? (
                            <>
                              <span className="size-1 rounded-full bg-border" />
                              <span className="font-medium text-amber-200">Admin</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <StaticMetricCell value={`$${row.displayedCostUsd.toFixed(2)}`} />
                      <StaticMetricCell value={`$${row.rawCostUsd.toFixed(2)}`} />
                      <StaticMetricCell value={String(row.remainingDisplayedCredits)} />

                      <CompactPlanLimitFields
                        initialTier={row.subscription.tier}
                        initialStatus={row.subscription.status}
                        initialRole={row.profile?.role ?? 'user'}
                        initialValues={{
                          coreTokensIncluded:
                            row.override?.coreTokensIncluded ??
                            row.subscription.coreTokensIncluded,
                          tierTokensIncluded:
                            row.override?.tierTokensIncluded ??
                            row.subscription.tierTokensIncluded,
                          imageCreditsIncluded:
                            row.override?.imageCreditsIncluded ??
                            row.subscription.imageCreditsIncluded,
                          dailyMessageLimit:
                            row.override?.dailyMessageLimit ??
                            row.subscription.dailyMessageLimit,
                          maxImagesPerDay:
                            row.override?.maxImagesPerDay ??
                            row.subscription.maxImagesPerDay,
                        }}
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
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-4 py-6 text-sm text-muted-foreground">
                    No users match the current filters.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle>Plan requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.length ? (
              requests.map((request) => (
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
              ))
            ) : (
              <EmptyAnalyticsState label="No manual plan requests have been submitted yet." />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <Card className="rounded-3xl border-border/70 bg-card/70">
      <CardContent className="space-y-2 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {detail ? (
          <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
        ) : null}
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

function FilterField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function AnalyticsCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Card className="rounded-3xl border-border/70 bg-card/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function InsightRow({
  label,
  value,
  detail,
  href,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  href?: string
  tone?: 'neutral' | 'warning' | 'critical'
}) {
  const content = (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="truncate text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  )

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${getInsightToneClass(
        tone
      )}`}
    >
      {href ? (
        <Link href={href} className="min-w-0 flex-1 hover:text-primary">
          {content}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{content}</div>
      )}
      <p className="shrink-0 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function getInsightToneClass(tone: 'neutral' | 'warning' | 'critical'): string {
  switch (tone) {
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10'
    case 'critical':
      return 'border-rose-500/30 bg-rose-500/10'
    case 'neutral':
      return 'border-border/60 bg-background/40'
  }
}

function EmptyAnalyticsState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-4 py-6 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatMarginRate(value: number | null): string {
  return value === null ? 'n/a' : formatPercent(value)
}

function formatCompactNumber(value: number): string {
  return Intl.NumberFormat('en', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPeriodLabel(filters: { from: string; to: string }): string {
  if (filters.from === filters.to) return `Selected period: ${filters.from}`
  return `Selected period: ${filters.from} to ${filters.to}`
}

function formatLimitDetail(limit: {
  label: string
  used: number
  limit: number
  remaining: number
  ratio: number
}): string {
  return `${limit.label}: ${formatPercent(limit.ratio)} used (${formatCompactNumber(limit.used)}/${formatCompactNumber(limit.limit)}, ${formatCompactNumber(limit.remaining)} left)`
}

function getDisplayUser(user: {
  userId: string
  displayName?: string | null
  email: string | null
  loginId: string | null
}): string {
  return user.displayName ?? user.email ?? user.loginId ?? user.userId
}
