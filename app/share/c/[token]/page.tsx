import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { isChatSharingEnabled } from '@/lib/config/features'
import { neonConversationSharesRepository } from '@/lib/db/repositories'
import { isValidShareToken } from '@/lib/share/conversation-shares'
import { SharedChatView } from '@/components/share/shared-chat-view'

export const runtime = 'nodejs'
// A revoked link has to stop working at once, so nothing here is cached.
export const dynamic = 'force-dynamic'

const NO_INDEX = { index: false, follow: false }

const loadShare = cache(async (token: string) => {
  if (!isChatSharingEnabled() || !isValidShareToken(token)) return null
  return await neonConversationSharesRepository.getPublicByToken(token)
})

function formatSharedDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const share = await loadShare(token)
  if (!share) return { title: 'Link not available · Zenquanta AI', robots: NO_INDEX }

  const title = `${share.snapshot.title} · Shared chat`
  const description = 'A read-only chat shared from Zenquanta AI.'
  return {
    title,
    description,
    robots: NO_INDEX,
    openGraph: { title, description, siteName: 'Zenquanta AI', type: 'article' },
  }
}

export default async function SharedChatPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const share = await loadShare(token)
  if (!share) notFound()

  return (
    <SharedChatView
      token={token}
      snapshot={share.snapshot}
      sharedOn={formatSharedDate(share.createdAt)}
    />
  )
}
