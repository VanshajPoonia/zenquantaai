'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Mic } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getSpeechRecognition,
  joinDictation,
  SpeechRecognitionLike,
  speechErrorMessage,
  transcriptFromResults,
} from '@/lib/chat/dictation'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const subscribeToNothing = () => () => {}

// Dictation into the composer through the browser's own speech service.
export function useDictation(onText: (text: string) => void, resetKey?: string | null) {
  const supported = useSyncExternalStore(
    subscribeToNothing,
    () => getSpeechRecognition() !== null,
    () => false
  )
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const start = useCallback(
    (baseText: string) => {
      const Recognition = getSpeechRecognition()
      if (!Recognition || recognitionRef.current) return

      const recognition = new Recognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = navigator.language || 'en-US'
      recognition.onresult = (event) => {
        onText(joinDictation(baseText, transcriptFromResults(event.results)))
      }
      recognition.onerror = (event) => {
        const message = speechErrorMessage(event.error)
        if (message) toast.error(message)
      }
      recognition.onend = () => {
        recognitionRef.current = null
        setListening(false)
      }

      recognitionRef.current = recognition
      try {
        recognition.start()
        setListening(true)
      } catch {
        recognitionRef.current = null
        toast.error('Dictation could not start. Tap the mic to try again.')
      }
    },
    [onText]
  )

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // Drops any words still on their way, for example once the message is sent.
  const cancel = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    recognition.onresult = null
    recognition.abort()
  }, [])

  // Stops listening when the open chat changes or the composer goes away.
  useEffect(() => cancel, [cancel, resetKey])

  return { supported, listening, start, stop, cancel }
}

export type Dictation = ReturnType<typeof useDictation>

export function VoiceInputButton({
  dictation,
  draft,
  disabled,
}: {
  dictation: Dictation
  draft: string
  disabled?: boolean
}) {
  if (!dictation.supported) return null

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-pressed={dictation.listening}
            aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
            className={cn(
              'size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground',
              dictation.listening && 'bg-red-500/15 text-red-300 hover:bg-red-500/20 hover:text-red-200'
            )}
            onClick={() =>
              dictation.listening ? dictation.stop() : dictation.start(draft)
            }
          >
            <Mic className={cn('size-4', dictation.listening && 'animate-pulse')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {dictation.listening ? 'Listening. Tap to stop.' : 'Your browser turns speech into text.'}
        </TooltipContent>
      </Tooltip>
      <span role="status" className="sr-only">
        {dictation.listening ? 'Listening' : ''}
      </span>
    </>
  )
}
