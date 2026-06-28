import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  ASSISTANT_PUBLIC_PAGES,
  PLAN_CONFIGS,
  TIER_ASSISTANT_NAMES,
} from '@/lib/config'
import { AssistantFamily } from '@/types'
import { requireServerUser } from '@/lib/auth/require-admin'
import {
  getPlanRequestStatusLabel,
  isUpgradeTier,
  sanitizePlanRequestAdminNote,
} from '@/lib/billing/upgrade-nudges'
import {
  neonPlanRequestsRepository,
  neonSubscriptionsRepository,
} from '@/lib/db/repositories'
import { requestPlanAction } from './actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

function getPlanRequestBannerClass(status: string) {
  switch (status) {
    case 'pending':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
    case 'approved':
    case 'activated':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
    case 'rejected':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-100'
    default:
      return 'border-border/70 bg-card/70 text-foreground'
  }
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user } = await requireServerUser()
  const subscription = await neonSubscriptionsRepository.ensureForUser(user)
  const pendingRequest =
    await neonPlanRequestsRepository.getLatestPendingForUser(user.id)
  const latestRequest =
    await neonPlanRequestsRepository.getLatestForUser(user.id)
  const params = await searchParams
  const requested = params.requested === '1'
  const error =
    typeof params.error === 'string'
      ? params.error
      : Array.isArray(params.error)
        ? params.error[0]
        : null

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Plans</p>
            <h1 className="mt-3 text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              Zenquanta plans and assistant tiers
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Request a higher plan manually for now. Your request will be reviewed
              and activated by the admin team.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="text-sm sm:text-right">
              <p className="eyebrow">Current plan</p>
              <p className="mt-1 font-medium text-foreground">
                {subscription.tier.toUpperCase()}
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>

        {requested ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
            Your request has been sent. Your plan will be activated soon.
          </div>
        ) : null}

        {error === 'already-covered' ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            Your current plan already covers this tier or higher. Choose a higher
            plan if you want to submit a new request.
          </div>
        ) : null}

        {pendingRequest ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Your plan request for {pendingRequest.requestedTier.toUpperCase()} is
            pending manual review. Duplicate requests are paused until an admin
            activates or closes it.
          </div>
        ) : null}

        {!latestRequest ? (
          <div className="rounded-2xl border border-border/70 bg-card/60 px-5 py-4 text-sm text-muted-foreground">
            No plan request is active right now. Choose a paid plan below to send
            a manual request for admin review.
          </div>
        ) : null}

        {latestRequest && latestRequest.status !== 'pending' ? (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm ${getPlanRequestBannerClass(
              latestRequest.status
            )}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  Latest request: {getPlanRequestStatusLabel(latestRequest.status)}
                </p>
                <p className="mt-1 opacity-85">
                  {latestRequest.status === 'activated'
                    ? `Your ${latestRequest.requestedTier.toUpperCase()} request was activated. Current plan: ${subscription.tier.toUpperCase()}.`
                    : latestRequest.status === 'approved'
                      ? `Your ${latestRequest.requestedTier.toUpperCase()} request was approved and is waiting for manual activation.`
                      : `Your ${latestRequest.requestedTier.toUpperCase()} request was not approved. You can submit a new request when you are ready.`}
                </p>
                {latestRequest.status === 'rejected' ? (
                  <p className="mt-2 text-xs opacity-80">
                    {sanitizePlanRequestAdminNote(latestRequest.adminNote) ??
                      'No additional admin note was provided.'}
                  </p>
                ) : null}
              </div>
              <Badge variant="outline" className="w-fit rounded-full bg-background/30">
                {latestRequest.status}
              </Badge>
            </div>
          </div>
        ) : null}

        <div className="grid divide-y divide-border/60 border-y border-border/60 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          {Object.values(PLAN_CONFIGS).map((plan) => {
            const canRequest = plan.tier !== 'free' && isUpgradeTier(subscription.tier, plan.tier)
            const requestDisabled = Boolean(pendingRequest) || !canRequest
            const buttonLabel = pendingRequest
              ? 'Request pending'
              : !canRequest
                ? subscription.tier === plan.tier
                  ? 'Current plan'
                  : 'Included'
                : 'Request Plan'
            const isCurrent = subscription.tier === plan.tier

            return (
              <div
                key={plan.tier}
                className={cn(
                  'flex flex-col gap-5 px-1 py-6 text-foreground lg:px-5',
                  isCurrent && 'bg-accent/30'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="eyebrow">
                    {plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1)}
                  </p>
                  {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                </div>
                <div>
                  <p className="text-3xl font-medium tracking-tight">
                    ${plan.priceUsd}
                  </p>
                  <p className="eyebrow mt-1">Monthly, manual activation</p>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{plan.coreTokens.toLocaleString()} core tokens</p>
                  <p>{plan.tierTokens.toLocaleString()} tier tokens</p>
                  <p>{plan.imageCredits.toLocaleString()} image credits</p>
                  <p>{plan.dailyMessageLimit.toLocaleString()} messages/day</p>
                  <p>{plan.maxImagesPerDay.toLocaleString()} images/day</p>
                </div>

                <div className="space-y-1 border-t border-border/60 pt-3">
                  {Object.entries(TIER_ASSISTANT_NAMES[plan.tier]).map(([family, name]) => (
                    <Link
                      key={name}
                      href={`/${ASSISTANT_PUBLIC_PAGES[family as AssistantFamily].slug}`}
                      className="block text-sm text-muted-foreground hover:text-foreground"
                    >
                      {name}
                    </Link>
                  ))}
                </div>

                {plan.tier === 'free' ? (
                  <Button className="w-full rounded-full" variant="outline" asChild>
                    <Link href="/dashboard">View dashboard</Link>
                  </Button>
                ) : (
                  <form action={requestPlanAction} className="space-y-3">
                    <input type="hidden" name="requestedTier" value={plan.tier} />
                    <Input name="contact" placeholder="Contact (optional)" />
                    <Textarea
                      name="note"
                      placeholder={`Optional note for ${plan.tier.toUpperCase()} request`}
                      className="min-h-24"
                    />
                    <Button
                      variant="cta"
                      className="w-full"
                      disabled={requestDisabled}
                    >
                      {buttonLabel}
                    </Button>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
