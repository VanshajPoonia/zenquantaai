import Link from 'next/link'
import type { ReactNode } from 'react'
import { ZenquantaLogo } from '@/components/icons'

/** Plain reading layout for terms, privacy and docs pages. */
export function StaticPage({
  title,
  updated,
  children,
}: {
  title: string
  updated?: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ZenquantaLogo className="size-6 rounded-md" />
          Zenquanta AI
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {updated ? <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p> : null}
        <div className="mt-8 space-y-6 text-[15px] leading-7 text-foreground/85 [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-white/[0.02] [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-6 [&_table]:w-full [&_table]:text-left [&_table]:text-[14px] [&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_th]:py-2 [&_th]:pr-3 [&_th]:font-medium">
          {children}
        </div>
        <footer className="mt-16 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/docs/cli">zq docs</Link>
          <Link href="/pricing">Plans</Link>
        </footer>
      </div>
    </main>
  )
}
