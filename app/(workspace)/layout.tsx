import { ChatLayout } from '@/components/chat'

// Chats, Home, Dashboard, Files and Plans share this layout, so the sidebar
// and workspace state stay mounted while moving between them.
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ChatLayout>{children}</ChatLayout>
}
