// Each chat has its own address so Back, refresh, bookmarks and new tabs
// work. Home and the tools live at "/". Pages such as /dashboard share the
// same layout but show their own content instead of the chat.
const CHAT_PATH_PATTERN = /^\/c\/([^/]+)\/?$/

export function getChatPath(chatId: string) {
  return `/c/${encodeURIComponent(chatId)}`
}

export function getChatIdFromPath(pathname: string) {
  const match = CHAT_PATH_PATTERN.exec(pathname)
  if (!match) return null

  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export function isWorkspacePath(pathname: string) {
  return pathname === '/' || getChatIdFromPath(pathname) !== null
}
