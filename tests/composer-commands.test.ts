import { describe, expect, it } from 'vitest'
import type { AIMode, CustomAssistant, PromptLibraryItem, PromptWorkflow } from '@/types'
import {
  buildMentionTargets,
  buildSlashItems,
  filterMentionTargets,
  filterSlashItems,
  matchRank,
  mentionPrefixFor,
  oneLine,
  parseComposerTrigger,
  parseLeadingMention,
  parseSlashSubmission,
  toMentionHandle,
  WORKSPACE_TOOL_COMMANDS,
} from '@/lib/chat/commands'

const ROLES: Record<AIMode, string> = {
  general: 'Everyday',
  creative: 'Writing',
  logic: 'Reasoning',
  code: 'Code',
  live: 'Research',
  image: 'Images',
}

function prompt(id: string, title: string, content = `${title} body`): PromptLibraryItem {
  return { id, title, content, mode: 'any', createdAt: '', updatedAt: '' }
}

function playbook(id: string, title: string, steps = 2): PromptWorkflow {
  return {
    id,
    title,
    metadata: {} as PromptWorkflow['metadata'],
    variables: [],
    steps: Array.from({ length: steps }, () => ({}) as PromptWorkflow['steps'][number]),
    createdAt: '',
    updatedAt: '',
  }
}

function customAssistant(input: Partial<CustomAssistant> & { id: string; name: string }): CustomAssistant {
  return {
    userId: 'user',
    description: '',
    iconEmoji: '🦊',
    color: '',
    baseMode: 'creative',
    systemInstructions: '',
    defaultModelOverride: 'auto',
    defaultSettings: {},
    metadata: {},
    isEnabled: true,
    createdAt: '',
    updatedAt: '',
    ...input,
  } as CustomAssistant
}

describe('composer triggers', () => {
  it('opens on a leading slash or at sign until the first space', () => {
    expect(parseComposerTrigger('/')).toEqual({ type: 'slash', query: '' })
    expect(parseComposerTrigger('/res')).toEqual({ type: 'slash', query: 'res' })
    expect(parseComposerTrigger('@fo')).toEqual({ type: 'mention', query: 'fo' })
    expect(parseComposerTrigger('/res ')).toBeNull()
    expect(parseComposerTrigger('/res\n')).toBeNull()
  })

  it('ignores slashes and at signs later in the draft', () => {
    expect(parseComposerTrigger('')).toBeNull()
    expect(parseComposerTrigger('hi /res')).toBeNull()
    expect(parseComposerTrigger(' @forge')).toBeNull()
    expect(parseComposerTrigger('a/b')).toBeNull()
  })
})

describe('slash items', () => {
  const items = buildSlashItems({
    prompts: [prompt('p1', 'Summarize meeting'), prompt('p2', 'Research brief')],
    playbooks: [playbook('w1', 'Weekly report', 3), playbook('w2', 'Launch check', 1)],
    canExport: true,
  })

  it('lists groups in order with every tool and chat action', () => {
    const groups = [...new Set(filterSlashItems(items, '').map((item) => item.group))]
    expect(groups).toEqual(['prompts', 'playbooks', 'tools', 'chat'])
    const names = items.filter((item) => item.name).map((item) => item.name)
    expect(names).toEqual(['image', 'artifacts', 'memory', 'research', 'files', 'compare', 'new', 'export'])
  })

  it('maps tools to the shared workspace list', () => {
    const research = items.find((item) => item.name === 'research')
    expect(research?.action).toEqual({ type: 'tool', tool: 'pulse-research-room' })
    expect(items.find((item) => item.name === 'compare')?.action).toEqual({ type: 'compare' })
    expect(items.find((item) => item.name === 'image')?.action).toEqual({ type: 'image' })
    const slashTools = WORKSPACE_TOOL_COMMANDS.filter((command) => command.slash).length
    expect(items.filter((item) => item.action.type === 'tool')).toHaveLength(slashTools - 1)
  })

  it('carries prompt text and playbook ids', () => {
    expect(items[0].action).toEqual({ type: 'prompt', content: 'Summarize meeting body' })
    expect(items.find((item) => item.id === 'playbook:w2')?.hint).toBe('1 step')
    expect(items.find((item) => item.id === 'playbook:w1')?.hint).toBe('3 steps')
  })

  it('leaves out export when the chat is empty', () => {
    const empty = buildSlashItems({ prompts: [], playbooks: [], canExport: false })
    expect(empty.some((item) => item.name === 'export')).toBe(false)
    expect(empty.some((item) => item.name === 'new')).toBe(true)
  })

  it('filters by name, label word and substring, best match first', () => {
    expect(filterSlashItems(items, 'res').map((item) => item.id)).toEqual([
      'prompt:p2',
      'tool:research',
    ])
    expect(filterSlashItems(items, 'meet').map((item) => item.id)).toEqual(['prompt:p1'])
    expect(filterSlashItems(items, 'EXP').map((item) => item.id)).toEqual(['chat:export'])
    expect(filterSlashItems(items, 'zzz')).toEqual([])
  })

  it('ranks the command name above a label match', () => {
    expect(matchRank('re', 'research', 'Pulse Research Room')).toBe(0)
    expect(matchRank('pul', 'research', 'Pulse Research Room')).toBe(1)
    expect(matchRank('room', 'research', 'Pulse Research Room')).toBe(2)
    expect(matchRank('ear', 'research', 'Pulse Research Room')).toBe(3)
    expect(matchRank('x', 'research', 'Pulse Research Room')).toBeNull()
  })

  it('caps long prompt lists', () => {
    const many = buildSlashItems({
      prompts: Array.from({ length: 40 }, (_, index) => prompt(`p${index}`, `Prompt ${index}`)),
      playbooks: [],
      canExport: false,
    })
    expect(filterSlashItems(many, '').filter((item) => item.group === 'prompts')).toHaveLength(20)
  })
})

describe('slash submissions', () => {
  it('reads /compare and /image with their prompt', () => {
    expect(parseSlashSubmission('/compare why is the sky blue')).toEqual({
      command: 'compare',
      rest: 'why is the sky blue',
    })
    expect(parseSlashSubmission('/image  a red fox\nat dusk ')).toEqual({
      command: 'image',
      rest: 'a red fox\nat dusk',
    })
    expect(parseSlashSubmission('/compare')).toEqual({ command: 'compare', rest: '' })
  })

  it('leaves other slash text alone', () => {
    expect(parseSlashSubmission('/research quantum')).toBeNull()
    expect(parseSlashSubmission('/images of cats')).toBeNull()
    expect(parseSlashSubmission('please /compare')).toBeNull()
  })
})

describe('assistant mentions', () => {
  const targets = buildMentionTargets(ROLES, [
    customAssistant({ id: 'c1', name: 'Story Fox' }),
    customAssistant({ id: 'c2', name: 'Forge' }),
    customAssistant({ id: 'c3', name: 'Off', isEnabled: false }),
    customAssistant({ id: 'c4', name: '!!!' }),
  ])

  it('offers the six assistants then usable custom ones', () => {
    expect(targets.map((target) => target.handle)).toEqual([
      'nova',
      'velora',
      'axiom',
      'forge',
      'pulse',
      'prism',
      'story-fox',
    ])
    expect(targets.at(-1)).toMatchObject({ mode: 'creative', customAssistantId: 'c1' })
  })

  it('turns names into handles', () => {
    expect(toMentionHandle('  Story Fox! v2 ')).toBe('story-fox-v2')
    expect(toMentionHandle('***')).toBe('')
  })

  it('filters by handle or name', () => {
    expect(filterMentionTargets(targets, '').length).toBe(7)
    expect(filterMentionTargets(targets, 'p').map((target) => target.handle)).toEqual([
      'pulse',
      'prism',
    ])
    expect(filterMentionTargets(targets, 'fox').map((target) => target.handle)).toEqual([
      'story-fox',
    ])
  })

  it('needs a known handle and a space', () => {
    expect(parseLeadingMention('@forge fix this', targets)).toMatchObject({
      target: { mode: 'code', customAssistantId: null },
      rest: 'fix this',
    })
    expect(parseLeadingMention('@FORGE  fix', targets)?.rest).toBe('fix')
    expect(parseLeadingMention('@forge ', targets)?.rest).toBe('')
    expect(parseLeadingMention('@forge', targets)).toBeNull()
    expect(parseLeadingMention('@bob hello', targets)).toBeNull()
    expect(parseLeadingMention('hey @forge do it', targets)).toBeNull()
  })

  it('rebuilds a mention for a queued message', () => {
    expect(mentionPrefixFor(targets, 'code', null)).toBe('@forge ')
    expect(mentionPrefixFor(targets, 'creative', 'c1')).toBe('@story-fox ')
    expect(mentionPrefixFor(targets, 'creative', 'gone')).toBe('')
  })
})

describe('one line previews', () => {
  it('collapses whitespace and trims long text', () => {
    expect(oneLine('  a\n\n b  ')).toBe('a b')
    expect(oneLine('x'.repeat(100), 10)).toBe('xxxxxxx...')
  })
})
