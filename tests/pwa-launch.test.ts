import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import manifest from '@/app/manifest'
import { GET as shareTarget } from '@/app/share-target/route'
import {
  SHARED_PROMPT_MAX,
  buildSharedPrompt,
  readLaunchParams,
  stripLaunchParams,
} from '@/lib/pwa/launch-params'

describe('share to Zenquanta', () => {
  it('joins title, text and link without repeating the link', () => {
    expect(
      buildSharedPrompt({ title: 'Great read', text: 'Look at this https://a.example/post', url: 'https://a.example/post' })
    ).toBe('Great read\n\nLook at this https://a.example/post')
    expect(buildSharedPrompt({ title: 'Docs', url: 'https://a.example' })).toBe('Docs\n\nhttps://a.example')
    expect(buildSharedPrompt({ text: '  ', url: null })).toBe('')
  })

  it('keeps a shared prompt within 4,000 characters', () => {
    const prompt = buildSharedPrompt({ title: 'T', text: 'x'.repeat(10_000), url: 'https://a.example' })
    expect(prompt.length).toBe(SHARED_PROMPT_MAX)
  })

  it('redirects the share sheet to a new chat with the draft', async () => {
    const response = shareTarget(
      new NextRequest('http://localhost/share-target?title=Hi&text=Summarize%20this&url=https%3A%2F%2Fa.example')
    )
    expect(response.status).toBe(303)
    const location = response.headers.get('location') ?? ''
    expect(location.startsWith('/?')).toBe(true)
    expect(readLaunchParams(location.slice(1))).toEqual({
      prompt: 'Hi\n\nSummarize this\n\nhttps://a.example',
      mode: null,
      newChat: true,
    })
  })

  it('opens a plain new chat when nothing was shared', () => {
    const response = shareTarget(new NextRequest('http://localhost/share-target'))
    expect(response.headers.get('location')).toBe('/?new=1')
  })
})

describe('launch parameters', () => {
  it('reads the assistant and the prompt', () => {
    expect(readLaunchParams('?new=1&assistant=Pulse&prompt=%20What%20changed%3F')).toEqual({
      prompt: 'What changed?',
      mode: 'live',
      newChat: true,
    })
    expect(readLaunchParams('?assistant=prism')?.mode).toBe('image')
  })

  it('ignores unknown assistants and addresses without launch parameters', () => {
    expect(readLaunchParams('?assistant=constructor')?.mode).toBeNull()
    expect(readLaunchParams('?assistant=__proto__')?.mode).toBeNull()
    expect(readLaunchParams('?tool=artifacts')).toBeNull()
    expect(readLaunchParams('')).toBeNull()
  })

  it('bounds a prompt passed in the address', () => {
    expect(readLaunchParams(`?prompt=${'y'.repeat(9_000)}`)?.prompt?.length).toBe(SHARED_PROMPT_MAX)
  })

  it('cleans only its own parameters from the address', () => {
    expect(stripLaunchParams('https://zq.example/?new=1&prompt=hi&assistant=nova&tool=artifacts#top')).toBe(
      '/?tool=artifacts#top'
    )
    expect(stripLaunchParams('https://zq.example/?new=1')).toBe('/')
  })
})

describe('installed app manifest', () => {
  it('accepts shares and offers shortcuts the workspace understands', () => {
    const app = manifest()
    expect(app.share_target).toEqual({
      action: '/share-target',
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' },
    })
    const shortcuts = app.shortcuts ?? []
    expect(shortcuts.map((shortcut) => shortcut.name)).toEqual(['New chat', 'Research with Pulse', 'Make an image'])
    expect(shortcuts.map((shortcut) => readLaunchParams(new URL(shortcut.url, 'https://zq.example').search)?.mode)).toEqual([
      null,
      'live',
      'image',
    ])
  })
})
