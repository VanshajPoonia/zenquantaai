import Link from 'next/link'
import { MessageSquareOff } from 'lucide-react'

export default function SharedChatNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/40 p-8 text-center">
        <MessageSquareOff className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold text-foreground">This link is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The person who shared it may have turned it off, or the chat was deleted.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Go to Zenquanta AI
        </Link>
      </div>
    </div>
  )
}
