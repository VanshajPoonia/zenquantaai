'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ChatMessage } from './message'
import { EmptyState } from './empty-state'
import { Composer } from './composer'
import { ModeSwitcherCompact } from './mode-switcher'

export function ChatArea() {
  const {
    currentChat,
    sendMessage,
    regenerateLastResponse,
    retryLastMessage,
    editLastUserMessage,
    streamingState,
  } = useChatContext()
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentChat?.messages])

  const lastAssistantId = useMemo(
    () =>
      [...(currentChat?.messages ?? [])]
        .reverse()
        .find((message) => message.role === 'assistant')?.id,
    [currentChat?.messages]
  )

  const lastUserId = useMemo(
    () =>
      [...(currentChat?.messages ?? [])]
        .reverse()
        .find((message) => message.role === 'user')?.id,
    [currentChat?.messages]
  )

  const handleSendMessage = async (content: string) => {
    setSelectedPrompt('')
    await sendMessage(content)
  }

  const showEmptyState = !currentChat || currentChat.messages.length === 0

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {showEmptyState ? (
        <div className="flex-1 overflow-y-auto">
          <EmptyState onPromptSelect={setSelectedPrompt} />
        </div>
      ) : (
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex justify-center mb-6">
              <ModeSwitcherCompact />
            </div>

            {streamingState.status === 'error' && (
              <Alert className="mb-6 border-destructive/40 bg-destructive/10 text-destructive">
                <AlertTitle>Last response needs attention</AlertTitle>
                <AlertDescription>
                  {streamingState.error ?? 'The last generation did not finish cleanly.'}
                </AlertDescription>
              </Alert>
            )}

            {currentChat?.messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLastAssistant={message.id === lastAssistantId}
                isLastUser={message.id === lastUserId}
                onRegenerate={regenerateLastResponse}
                onRetry={retryLastMessage}
                onEdit={editLastUserMessage}
              />
            ))}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      )}

      <Composer onSend={handleSendMessage} initialValue={selectedPrompt} />
    </div>
  )
}
