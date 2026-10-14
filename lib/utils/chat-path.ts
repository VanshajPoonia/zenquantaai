// Each chat has its own address so Back, refresh, bookmarks and new tabs
// work. Everything else in the workspace lives at "/".
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
