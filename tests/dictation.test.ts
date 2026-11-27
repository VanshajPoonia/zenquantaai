import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSpeechRecognition,
  joinDictation,
  speechErrorMessage,
  transcriptFromResults,
} from '@/lib/chat/dictation'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('dictation helpers', () => {
  it('joins every result, final or not, into one line', () => {
    expect(transcriptFromResults([[{ transcript: 'hello' }], [{ transcript: ' there  friend' }]])).toBe(
      'hello there friend'
    )
    expect(transcriptFromResults([])).toBe('')
  })

  it('adds spoken words after the draft with one space', () => {
    expect(joinDictation('', 'hello')).toBe('hello')
    expect(joinDictation('Draft', 'hello')).toBe('Draft hello')
    expect(joinDictation('Draft\n', 'hello')).toBe('Draft\nhello')
    expect(joinDictation('Draft', '')).toBe('Draft')
  })

  it('explains blocked microphones and stays quiet on a planned stop', () => {
    expect(speechErrorMessage('not-allowed')).toMatch(/Microphone access is blocked/)
    expect(speechErrorMessage('service-not-allowed')).toMatch(/Microphone access is blocked/)
    expect(speechErrorMessage('aborted')).toBeNull()
    expect(speechErrorMessage('something-new')).toMatch(/Dictation stopped/)
  })

  it('finds the standard or the webkit constructor', () => {
    expect(getSpeechRecognition()).toBeNull()
    class Webkit {}
    vi.stubGlobal('window', { webkitSpeechRecognition: Webkit })
    expect(getSpeechRecognition()).toBe(Webkit)
    class Standard {}
    vi.stubGlobal('window', { SpeechRecognition: Standard, webkitSpeechRecognition: Webkit })
    expect(getSpeechRecognition()).toBe(Standard)
  })
})
