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

/**
 * `ZQ_MODEL_API`: `on` opens the hosted zq models to every plan. Anything
 * else keeps them admin-only until OpenRouter confirms resale terms
 * (see docs/launch/NEEDS_YOU.md); zq then uses the user's own OpenRouter key.
 */
export function isModelApiEnabledFor(user: { role?: string | null }): boolean {
  const value = process.env.ZQ_MODEL_API?.trim().toLowerCase()
  if (value === 'on' || value === 'true') return true
  return user.role === 'admin'
}

/**
 * `CLI_APPROVALS`: `on` lets zq ask for approvals on the web. Keep it off
 * until neon/migrations/20261201_zenquanta_cli_approvals.sql is applied.
 */
export function isCliApprovalsEnabled(): boolean {
  const value = process.env.CLI_APPROVALS?.trim().toLowerCase()
  return value === 'on' || value === 'true'
}
