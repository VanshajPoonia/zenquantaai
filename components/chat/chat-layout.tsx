'use client'

import { useState } from 'react'
import { ChatProvider } from '@/lib/chat-context'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { ChatArea } from './chat-area'
import { SettingsPanel } from './settings-panel'
import { SettingsModal } from './settings-modal'

export function ChatLayout() {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  return (
    <ChatProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Left Sidebar */}
        <Sidebar onOpenSettings={() => setIsSettingsModalOpen(true)} />

        {/* Main Content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <Header onOpenSettings={() => setIsSettingsModalOpen(true)} />

          {/* Chat Area + Settings Panel */}
          <div className="flex flex-1 overflow-hidden">
            <ChatArea />
            <SettingsPanel />
          </div>
        </div>

        {/* Settings Modal */}
        <SettingsModal
          open={isSettingsModalOpen}
          onOpenChange={setIsSettingsModalOpen}
        />
      </div>
    </ChatProvider>
  )
}
