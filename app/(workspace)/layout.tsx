import { ChatLayout } from '@/components/chat'

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ChatLayout />
      {children}
    </>
  )
}
