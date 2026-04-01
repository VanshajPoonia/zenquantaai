import Link from 'next/link'
import { PLAN_CONFIGS, TIER_ASSISTANT_NAMES } from '@/lib/config'
import { requireServerUser } from '@/lib/auth/require-admin'
import { planRequestsStore, subscriptionsStore } from '@/lib/storage'
import { requestPlanAction } from './actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user } = await requireServerUser()
  const subscription = await subscriptionsStore.ensureForUser(user)
  const pendingRequest = await planRequestsStore.getLatestPendingForUser(user.id)
  const params = await searchParams
  const requested = params.requested === '1'

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Plans
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Zenquanta plans and assistant tiers
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Request a higher plan manually for now. Your request will be reviewed
              and activated by the admin team.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Current plan
            </p>
            <p className="mt-1 font-medium text-foreground">
              {subscription.tier.toUpperCase()}
            </p>
          </div>
        </div>

        {requested ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
            Your request has been sent. Your plan will be activated soon.
          </div>
        ) : null}

        {pendingRequest ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Your plan request for {pendingRequest.requestedTier.toUpperCase()} is
            pending and will be activated soon.
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-5">
          {Object.values(PLAN_CONFIGS).map((plan) => (
            <Card
              key={plan.tier}
              className="rounded-3xl border-border/70 bg-card/70 text-foreground"
            >
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl">
                    {plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1)}
                  </CardTitle>
                  {subscription.tier === plan.tier ? (
                    <Badge variant="secondary">Current</Badge>
                  ) : null}
                </div>
                <div>
                  <p className="text-3xl font-semibold tracking-tight">
                    ${plan.priceUsd}
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Monthly, manual activation
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{plan.coreTokens.toLocaleString()} core tokens</p>
                  <p>{plan.tierTokens.toLocaleString()} tier tokens</p>
                  <p>{plan.imageCredits.toLocaleString()} image credits</p>
                  <p>{plan.dailyMessageLimit.toLocaleString()} messages/day</p>
                  <p>{plan.maxImagesPerDay.toLocaleString()} images/day</p>
                </div>
                <div className="space-y-2">
                  {Object.values(TIER_ASSISTANT_NAMES[plan.tier]).map((name) => (
                    <div
                      key={name}
                      className="rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm"
                    >
                      {name}
                    </div>
                  ))}
                </div>
                {plan.tier === 'free' ? (
                  <Button className="w-full rounded-xl" variant="secondary" asChild>
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
                      className="w-full rounded-xl"
                      disabled={Boolean(pendingRequest)}
                    >
                      Request Plan
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
