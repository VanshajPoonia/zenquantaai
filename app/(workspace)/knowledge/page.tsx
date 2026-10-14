import type { Metadata } from 'next'
import { requireServerUser } from '@/lib/auth/require-admin'
import { neonProjectsRepository } from '@/lib/db/repositories'
import { KnowledgeLibraryClient } from './knowledge-library-client'

export const metadata: Metadata = { title: 'Files · Zenquanta AI' }

export default async function KnowledgePage() {
  const { user } = await requireServerUser()
  const projects = await neonProjectsRepository.list(user.id, { limit: 100 })

  return (
    <main className="bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Files
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Your files
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Everything you have uploaded or imported, across projects. Ask a
              question about your files, re-index them, move them to a project,
              or remove them.
            </p>
          </div>
        </div>

        <KnowledgeLibraryClient projects={projects} />
      </div>
    </main>
  )
}
