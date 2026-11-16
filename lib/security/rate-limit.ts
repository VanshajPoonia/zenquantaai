import 'server-only'

import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { getNeonSql } from '@/lib/db/client'

/** The client IP as appended by Vercel's proxy (rightmost x-forwarded-for entry). */
export function getClientIp(request: Pick<NextRequest, 'headers'>): string {
  return (
    request.headers
      .get('x-forwarded-for')
      ?.split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .pop() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

/**
 * Fixed-window counter in Neon. Returns true while the key is within `limit`
 * hits per `windowSeconds`. Keys are hashed so raw IPs and tokens are not stored.
 */
export async function hitRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const hashedKey = createHash('sha256').update(key).digest('hex')
  const rows = (await getNeonSql().query(
    `
      insert into public.zen_rate_limits as r (key, window_started_at, count)
      values ($1, now(), 1)
      on conflict (key) do update set
        count = case
          when r.window_started_at < now() - make_interval(secs => $2) then 1
          else r.count + 1
        end,
        window_started_at = case
          when r.window_started_at < now() - make_interval(secs => $2) then now()
          else r.window_started_at
        end
      returning count
    `,
    [hashedKey, windowSeconds]
  )) as Array<{ count: number }>

  return (rows[0]?.count ?? 0) <= limit
}
