export function formatConversationDate(dateValue: string): string {
  const date = new Date(dateValue)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatMessageTime(dateValue: string): string {
  return new Date(dateValue).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}
