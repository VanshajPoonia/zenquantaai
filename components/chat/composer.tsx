'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { MODE_CONFIGS } from '@/lib/types'
import { getModeAccentClass, getModeGlow } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SendIcon, StopIcon, PaperclipIcon } from '@/components/icons'
import { ModeSwitcherCompact } from './mode-switcher'

interface ComposerProps {
  onSend: (content: string) => void
  disabled?: boolean
  initialValue?: string
}

export function Composer({ onSend, disabled, initialValue = '' }: ComposerProps) {
  const { currentMode, isStreaming, stopStreaming } = useChatContext()
  const [value, setValue] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const modeConfig = MODE_CONFIGS[currentMode]

  // Update value when initialValue changes (e.g., from suggested prompt)
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue)
      textareaRef.current?.focus()
    }
  }, [initialValue])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [value])

  const handleSubmit = () => {
    if (!value.trim() || disabled || isStreaming) return
    onSend(value.trim())
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleStop = () => {
    stopStreaming()
  }

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-sm p-4">
      <div className="max-w-4xl mx-auto">
        <div
          className={cn(
            'relative rounded-2xl border bg-card/80 backdrop-blur-sm transition-all duration-300',
            'focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-background',
            'focus-within:border-opacity-50',
            getModeAccentClass(currentMode, 'ring').replace('ring-', 'focus-within:ring-') + '/50',
            getModeAccentClass(currentMode, 'border').replace('border-', 'focus-within:border-') + '/50'
          )}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={modeConfig.placeholder}
            disabled={disabled || isStreaming}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-4 pt-4 pb-14 text-foreground placeholder:text-muted-foreground',
              'focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[60px] max-h-[200px]'
            )}
          />

          {/* Bottom Bar */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            {/* Left Actions */}
            <div className="flex items-center gap-2">
              <ModeSwitcherCompact />
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={disabled || isStreaming}
                    >
                      <PaperclipIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {isStreaming ? (
                <Button
                  onClick={handleStop}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  <StopIcon className="size-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!value.trim() || disabled}
                  className={cn(
                    'transition-all duration-300 text-white disabled:opacity-50',
                    getModeAccentClass(currentMode, 'bg'),
                    `hover:opacity-90`,
                    getModeGlow(currentMode)
                  )}
                >
                  <SendIcon className="size-4 mr-2" />
                  Send
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground text-center mt-3">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Enter</kbd> to send,{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">Shift + Enter</kbd> for new line
        </p>
      </div>
    </div>
  )
}
