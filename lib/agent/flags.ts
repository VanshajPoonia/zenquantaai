/**
 * `AGENT_LOOP`: `on` for everyone, `admins` for admin accounts only, anything
 * else keeps the plain chat path.
 */
export function isAgentLoopEnabledFor(user: { role?: string | null }): boolean {
  const value = process.env.AGENT_LOOP?.trim().toLowerCase()
  if (value === 'on' || value === 'true') return true
  if (value === 'admins') return user.role === 'admin'
  return false
}
