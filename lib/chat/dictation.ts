// The Web Speech API is not in TypeScript's DOM types, so the parts we use are typed here.

export interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

export function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export function transcriptFromResults(
  results: ArrayLike<ArrayLike<{ transcript: string }>>
): string {
  return Array.from(results, (result) => result[0]?.transcript ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function joinDictation(base: string, spoken: string): string {
  if (!spoken) return base
  if (!base) return spoken
  return /\s$/.test(base) ? `${base}${spoken}` : `${base} ${spoken}`
}

// Null means the stop was expected and needs no message.
export function speechErrorMessage(error: string): string | null {
  switch (error) {
    case 'aborted':
      return null
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it in your browser to dictate.'
    case 'audio-capture':
      return 'No microphone was found.'
    case 'no-speech':
      return 'No speech was heard. Tap the mic to try again.'
    case 'network':
      return "Dictation needs your browser's speech service, which is not reachable."
    case 'language-not-supported':
      return 'Dictation does not support your browser language.'
    default:
      return 'Dictation stopped. Tap the mic to try again.'
  }
}
