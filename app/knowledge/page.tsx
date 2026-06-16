import Link from 'next/link'
import { requireServerUser } from '@/lib/auth/require-admin'
import { neonProjectsRepository } from '@/lib/db/repositories'
import { Button } from '@/components/ui/button'
import { KnowledgeLibraryClient } from './knowledge-library-client'

export default async function KnowledgePage() {
  const { user } = await requireServerUser()
  const projects = await neonProjectsRepository.list(user.id, { limit: 100 })

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Knowledge Library
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Your uploaded knowledge
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Browse, filter, and manage all files you have uploaded or imported
              across projects. Re-index files, assign them to projects, or remove
              them from the knowledge base.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="secondary" className="rounded-xl">
              <Link href="/">Open workspace</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>

        <KnowledgeLibraryClient projects={projects} />
      </div>
    </main>
  )
}
