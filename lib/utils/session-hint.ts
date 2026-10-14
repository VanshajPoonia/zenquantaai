// A non-secret cookie that only says "this browser was signed in last time".
// It lets "/" show the landing page straight away for new visitors instead of
// waiting on the session check. It grants nothing: the real session cookie is
// httpOnly and checked by the server, so a wrong hint only costs a brief
// loading screen or a brief landing page before the check corrects it.

export const SESSION_HINT_COOKIE = 'zq_signed_in'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export function hasSessionHint(cookie: string): boolean {
  return cookie
    .split(';')
    .some((part) => part.trim() === `${SESSION_HINT_COOKIE}=1`)
}

export function sessionHintCookie(signedIn: boolean, secure: boolean): string {
  const attributes = ['Path=/', 'SameSite=Lax', `Max-Age=${signedIn ? ONE_YEAR_SECONDS : 0}`]
  if (secure) attributes.push('Secure')
  return `${SESSION_HINT_COOKIE}=${signedIn ? '1' : ''}; ${attributes.join('; ')}`
}
