'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import { AssistantHandoffTarget } from '@/lib/config/assistant-handoffs'
import {
  AssistantQualityAction,
  resolveQualityActionMode,
} from '@/lib/config/assistant-quality-actions'
import { ArtifactSourceType, ArtifactType, Message } from '@/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ChatMessage } from './message'
import { EmptyState } from './empty-state'
import { Composer } from './composer'
import { ModeSwitcherCompact } from './mode-switcher'
import { ProjectHome } from './project-home'

export function ChatArea() {
  const {
    currentChat,
    activeProjectHomeId,
    sendMessage,
    regenerateLastResponse,
    retryLastMessage,
    editLastUserMessage,
    askAnotherMode,
    saveArtifact,
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

  const getArtifactTitle = (content: string) => {
    const heading =
      content
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('# '))
        ?.replace(/^#+\s*/, '') ??
      content
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean) ??
      'Saved artifact'

    return heading.length > 80 ? `${heading.slice(0, 77).trimEnd()}...` : heading
  }

  const inferArtifactType = (message: Message): ArtifactType => {
    if (message.mode === 'image') return 'image_prompt'
    if (message.sources?.some((source) => source.kind === 'web')) {
      return 'research_report'
    }
    if (/```[\s\S]+```/.test(message.content)) return 'code'
    if (/^\s*\|.+\|\s*$/m.test(message.content)) return 'table'
    if (/^\s*[-*]\s+\[[ xX]\]/m.test(message.content)) return 'checklist'
    return 'document'
  }

  const inferSourceType = (message: Message): ArtifactSourceType => {
    if (message.mode === 'image') return 'prism_prompt'
    if (message.mode === 'live' || message.sources?.some((source) => source.kind === 'web')) {
      return 'pulse_report'
    }
    return 'chat_message'
  }

  const handleSaveMessageArtifact = async (message: Message) => {
    if (!currentChat || message.role !== 'assistant' || !message.content.trim()) {
      return
    }

    await saveArtifact({
      title: getArtifactTitle(message.content),
      content: message.content,
      artifactType: inferArtifactType(message),
      sourceType: inferSourceType(message),
      projectId: currentChat.projectId,
      conversationId: currentChat.id,
      sourceMessageId: message.id,
      metadata: {
        savedFrom: 'assistant_message',
        assistantFamily: message.assistantFamily ?? null,
        mode: message.mode,
        model: message.model ?? null,
        provider: message.provider ?? null,
        sourceCount: message.sources?.length ?? 0,
      },
    })
  }

  const handleHandoffMessage = async (
    message: Message,
    target: AssistantHandoffTarget,
    prompt: string
  ) => {
    if (
      !currentChat ||
      message.role !== 'assistant' ||
      !currentChat.messages.some((item) => item.id === message.id)
    ) {
      return
    }

    await sendMessage({
      content: prompt,
      kind: target.mode === 'image' ? 'image' : 'chat',
      modeOverride: target.mode,
      customAssistantId: null,
    })
  }

  const handleQualityActionMessage = async (
    message: Message,
    action: AssistantQualityAction,
    prompt: string
  ) => {
    if (
      !currentChat ||
      message.role !== 'assistant' ||
      !currentChat.messages.some((item) => item.id === message.id)
    ) {
      return
    }

    const targetMode = resolveQualityActionMode(action, message)

    await sendMessage({
      content: prompt,
      kind: action.kind === 'image' || targetMode === 'image' ? 'image' : 'chat',
      modeOverride: targetMode,
      customAssistantId: null,
    })
  }

  const showProjectHome = !currentChat && Boolean(activeProjectHomeId)
  const showEmptyState = !currentChat || currentChat.messages.length === 0

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      {showProjectHome && activeProjectHomeId ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ProjectHome projectId={activeProjectHomeId} />
        </div>
      ) : showEmptyState ? (
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
              <div
                key={message.id}
                id={`message-${message.id}`}
                className="scroll-mt-24"
              >
                <ChatMessage
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
                  errorOverride={
                    message.id === streamingState.messageId &&
                    streamingState.status === 'error'
                      ? streamingState.error
                      : undefined
                  }
                  isLastAssistant={message.id === lastAssistantId}
                  isLastUser={message.id === lastUserId}
                  onRegenerate={regenerateLastResponse}
                  onRetry={retryLastMessage}
                  onEdit={editLastUserMessage}
                  onAskAnotherMode={askAnotherMode}
                  onSaveArtifact={handleSaveMessageArtifact}
                  onHandoff={handleHandoffMessage}
                  onQualityAction={handleQualityActionMessage}
                />
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      )}

      <Composer onSend={handleSendMessage} initialValue={selectedPrompt} />
    </div>
  )
}
