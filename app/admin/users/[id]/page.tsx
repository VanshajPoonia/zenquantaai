import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminStore } from '@/lib/storage'
import { updateUserAdminAction } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const detail = await adminStore.getUserDetail(id)

  if (!detail) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Admin user
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {detail.profile?.email ?? detail.profile?.loginId ?? detail.subscription.userId}
            </h1>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="secondary" className="rounded-xl">
              <Link href="/">Back to home</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/admin">Back to admin</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-3xl border-border/70 bg-card/70">
            <CardHeader>
              <CardTitle>Subscription controls</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateUserAdminAction} className="space-y-4">
                <input type="hidden" name="targetUserId" value={detail.subscription.userId} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input name="tier" defaultValue={detail.subscription.tier} />
                  <Input name="status" defaultValue={detail.subscription.status} />
                  <Input name="role" defaultValue={detail.profile?.role ?? 'user'} />
                  <Input
                    name="coreTokensIncluded"
                    defaultValue={String(
                      detail.override?.coreTokensIncluded ??
                        detail.subscription.coreTokensIncluded
                    )}
                  />
                  <Input
                    name="tierTokensIncluded"
                    defaultValue={String(
                      detail.override?.tierTokensIncluded ??
                        detail.subscription.tierTokensIncluded
                    )}
                  />
                  <Input
                    name="imageCreditsIncluded"
                    defaultValue={String(
                      detail.override?.imageCreditsIncluded ??
                        detail.subscription.imageCreditsIncluded
                    )}
                  />
                  <Input
                    name="dailyMessageLimit"
                    defaultValue={String(
                      detail.override?.dailyMessageLimit ??
                        detail.subscription.dailyMessageLimit
                    )}
                  />
                  <Input
                    name="maxImagesPerDay"
                    defaultValue={String(
                      detail.override?.maxImagesPerDay ??
                        detail.subscription.maxImagesPerDay
                    )}
                  />
                  <Input
                    name="maxInputTokensPerRequest"
                    defaultValue={String(
                      detail.override?.maxInputTokensPerRequest ??
                        detail.subscription.maxInputTokensPerRequest
                    )}
                  />
                  <Input
                    name="maxOutputTokensPerRequest"
                    defaultValue={String(
                      detail.override?.maxOutputTokensPerRequest ??
                        detail.subscription.maxOutputTokensPerRequest
                    )}
                  />
                </div>
                <Input
                  name="allowedModelOverrides"
                  defaultValue={detail.override?.allowedModelOverrides?.join(', ') ?? ''}
                  placeholder="Comma-separated allowed models override"
                />
                <Textarea
                  name="note"
                  placeholder="Admin note"
                  defaultValue={detail.override?.notes ?? detail.subscription.notes ?? ''}
                  className="min-h-28"
                />
                <Button className="rounded-xl">Save changes</Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-3xl border-border/70 bg-card/70">
              <CardHeader>
                <CardTitle>Usage summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Metric label="Raw text cost" value={`$${detail.usageEvents.reduce((t, e) => t + e.rawCostUsd, 0).toFixed(2)}`} />
                <Metric label="Displayed text cost" value={`$${detail.usageEvents.reduce((t, e) => t + e.displayedCostUsd, 0).toFixed(2)}`} />
                <Metric label="Raw image cost" value={`$${detail.imageEvents.reduce((t, e) => t + e.rawCostUsd, 0).toFixed(2)}`} />
                <Metric label="Displayed image cost" value={`$${detail.imageEvents.reduce((t, e) => t + e.displayedCostUsd, 0).toFixed(2)}`} />
                <Metric label="Core usage" value={detail.subscription.coreTokensUsed.toLocaleString()} />
                <Metric label="Tier usage" value={detail.subscription.tierTokensUsed.toLocaleString()} />
                <Metric label="Image credits used" value={detail.subscription.imageCreditsUsed.toLocaleString()} />
                <Metric label="Conversations" value={String(detail.conversations.length)} />
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70 bg-card/70">
              <CardHeader>
                <CardTitle>Assistant usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {detail.assistantBreakdown.map((item) => (
                  <div
                    key={item.family}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 px-4 py-3"
                  >
                    <p className="capitalize text-foreground">{item.family}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.events} · ${item.displayedCostUsd.toFixed(2)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}
