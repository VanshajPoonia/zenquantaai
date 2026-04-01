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
    askAnotherMode,
    streamingState,
  } = useChatContext()
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousMessageCountRef = useRef(0)
  const previousChatIdRef = useRef<string | null>(null)

  useEffect(() => {
    const messageCount = currentChat?.messages.length ?? 0
    const isChatSwitch = currentChat?.id !== previousChatIdRef.current
    previousChatIdRef.current = currentChat?.id ?? null
    previousMessageCountRef.current = messageCount

    const viewport = scrollAreaRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLDivElement | null

    if (!viewport || !messagesEndRef.current) return

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    const shouldFollow =
      streamingState.status === 'streaming' || distanceFromBottom < 160 || isChatSwitch

    if (!shouldFollow) return

    messagesEndRef.current.scrollIntoView({
      behavior: streamingState.status === 'streaming' ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [currentChat?.id, currentChat?.messages, streamingState.status])

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

  const handleSendMessage = async (input: {
    content: string
    attachments?: Parameters<typeof sendMessage>[0]['attachments']
    kind?: Parameters<typeof sendMessage>[0]['kind']
    modeOverride?: Parameters<typeof sendMessage>[0]['modeOverride']
  }) => {
    setSelectedPrompt('')
    await sendMessage(input)
  }

  const showEmptyState = !currentChat || currentChat.messages.length === 0

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      {showEmptyState ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <EmptyState onPromptSelect={setSelectedPrompt} />
        </div>
      ) : (
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
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
                isStreamingMessage={
                  message.id === streamingState.messageId &&
                  streamingState.status === 'streaming'
                }
                workingTitle={
                  message.id === streamingState.messageId
                    ? streamingState.workingTitle
                    : undefined
                }
                workingNotes={
                  message.id === streamingState.messageId
                    ? streamingState.workingNotes
                    : undefined
                }
                isLastAssistant={message.id === lastAssistantId}
                isLastUser={message.id === lastUserId}
                onRegenerate={regenerateLastResponse}
                onRetry={retryLastMessage}
                onEdit={editLastUserMessage}
                onAskAnotherMode={askAnotherMode}
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
