'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BotIcon,
  CopyIcon,
  FlaskConicalIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import { MODE_CONFIGS } from '@/lib/types'
import {
  CustomAssistant,
  CustomAssistantInput,
  CustomAssistantTestResponse,
  ModelOverrideOption,
  ResponseStyle,
  TextAIMode,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const TEXT_MODES: TextAIMode[] = ['general', 'creative', 'logic', 'code', 'live']
const MODEL_OVERRIDES: ModelOverrideOption[] = [
  'auto',
  'gemini',
  'claude',
  'gpt',
  'deepseek',
  'qwen',
]
const RESPONSE_STYLES: ResponseStyle[] = ['balanced', 'concise', 'detailed']
const COLORS = ['general', 'creative', 'logic', 'code', 'live', 'image']

const DEFAULT_FORM: CustomAssistantInput = {
  name: '',
  description: '',
  iconEmoji: '✨',
  color: 'general',
  baseMode: 'general',
  systemInstructions: '',
  defaultModelOverride: 'auto',
  defaultSettings: {
    temperature: 0.7,
    maxTokens: 1400,
    topP: 0.9,
    tools: {
      webSearch: false,
      memory: true,
      fileContext: false,
    },
  },
  metadata: {
    version: 2,
    tone: '',
    responseStyle: 'balanced',
    suggestedUseCases: [],
    isPinned: false,
    starterPromptIds: [],
  },
  isEnabled: true,
}

function toForm(
  assistant?: CustomAssistant | null
): CustomAssistantInput & { id?: string } {
  if (!assistant) return structuredClone(DEFAULT_FORM)

  return {
    id: assistant.id,
    name: assistant.name,
    description: assistant.description,
    iconEmoji: assistant.iconEmoji,
    color: assistant.color,
    baseMode: assistant.baseMode,
    systemInstructions: assistant.systemInstructions,
    defaultModelOverride: assistant.defaultModelOverride,
    defaultSettings: {
      ...DEFAULT_FORM.defaultSettings,
      ...assistant.defaultSettings,
      tools: {
        ...DEFAULT_FORM.defaultSettings?.tools,
        ...assistant.defaultSettings.tools,
      },
    },
    metadata: {
      ...DEFAULT_FORM.metadata,
      ...assistant.metadata,
      suggestedUseCases: assistant.metadata.suggestedUseCases ?? [],
      starterPromptIds: assistant.metadata.starterPromptIds ?? [],
    },
    isEnabled: assistant.isEnabled,
  }
}

function formLabel(assistant: CustomAssistant | null): string {
  if (!assistant) return 'Private assistants'
  return `${assistant.iconEmoji} ${assistant.name}`
}

function useCasesToText(input: CustomAssistantInput): string {
  return input.metadata?.suggestedUseCases?.join(', ') ?? ''
}

function parseUseCases(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function copyAssistantInput(
  assistant: CustomAssistant
): CustomAssistantInput {
  const form = toForm(assistant)
  const input: CustomAssistantInput = { ...form }
  delete (input as CustomAssistantInput & { id?: string }).id

  return {
    ...input,
    name: `${assistant.name} Copy`.slice(0, 60),
    metadata: {
      ...input.metadata,
      isPinned: false,
    },
    isEnabled: true,
  }
}

export function CustomAssistantButton() {
  const {
    customAssistants,
    currentCustomAssistantId,
    setCurrentCustomAssistant,
    saveCustomAssistant,
    deleteCustomAssistant,
    testCustomAssistant,
    promptLibrary,
    workspaceToolRequest,
    clearWorkspaceToolRequest,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CustomAssistantInput & { id?: string }>(
    structuredClone(DEFAULT_FORM)
  )
  const [isSaving, setIsSaving] = useState(false)
  const [testPrompt, setTestPrompt] = useState(
    'Reply to a user who asks for help planning their next step.'
  )
  const [testResult, setTestResult] =
    useState<CustomAssistantTestResponse | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const activeAssistant = useMemo(
    () =>
      customAssistants.find(
        (assistant) => assistant.id === currentCustomAssistantId
      ) ?? null,
    [customAssistants, currentCustomAssistantId]
  )
  const editingAssistant = useMemo(
    () => customAssistants.find((assistant) => assistant.id === editingId) ?? null,
    [customAssistants, editingId]
  )
  const attachedPromptIds = form.metadata?.starterPromptIds ?? []

  useEffect(() => {
    if (workspaceToolRequest?.tool !== 'custom-assistants') return

    setOpen(true)
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [clearWorkspaceToolRequest, workspaceToolRequest])

  const startCreate = () => {
    setEditingId(null)
    setForm(toForm(null))
    setTestResult(null)
    setTestError(null)
  }

  const startEdit = (assistant: CustomAssistant) => {
    setEditingId(assistant.id)
    setForm(toForm(assistant))
    setTestResult(null)
    setTestError(null)
  }

  const updateForm = (patch: Partial<CustomAssistantInput>) => {
    setForm((previous) => ({
      ...previous,
      ...patch,
      defaultSettings: {
        ...previous.defaultSettings,
        ...patch.defaultSettings,
        tools: {
          ...previous.defaultSettings?.tools,
          ...patch.defaultSettings?.tools,
        },
      },
      metadata: {
        ...previous.metadata,
        ...patch.metadata,
      },
    }))
  }

  const saveForm = async () => {
    setIsSaving(true)
    try {
      const assistant = await saveCustomAssistant(form)
      if (!assistant) return
      setEditingId(assistant.id)
      setForm(toForm(assistant))
    } finally {
      setIsSaving(false)
    }
  }

  const duplicateAssistant = async (assistant: CustomAssistant) => {
    const duplicate = await saveCustomAssistant(copyAssistantInput(assistant))
    if (!duplicate) return
    startEdit(duplicate)
  }

  const togglePinned = async (assistant: CustomAssistant) => {
    await saveCustomAssistant({
      id: assistant.id,
      name: assistant.name,
      description: assistant.description,
      iconEmoji: assistant.iconEmoji,
      color: assistant.color,
      baseMode: assistant.baseMode,
      systemInstructions: assistant.systemInstructions,
      defaultModelOverride: assistant.defaultModelOverride,
      defaultSettings: assistant.defaultSettings,
      metadata: {
        ...assistant.metadata,
        isPinned: !assistant.metadata.isPinned,
      },
      isEnabled: assistant.isEnabled,
    })
  }

  const runTest = async () => {
    setIsTesting(true)
    setTestError(null)
    setTestResult(null)

    try {
      const result = await testCustomAssistant({
        assistant: form,
        prompt: testPrompt,
      })
      setTestResult(result)
    } catch (error) {
      setTestError(
        error instanceof Error
          ? error.message
          : 'Unable to test this assistant right now.'
      )
    } finally {
      setIsTesting(false)
    }
  }

  const toggleAttachedPrompt = (promptId: string) => {
    const nextIds = attachedPromptIds.includes(promptId)
      ? attachedPromptIds.filter((id) => id !== promptId)
      : [...attachedPromptIds, promptId].slice(0, 12)

    updateForm({
      metadata: {
        starterPromptIds: nextIds,
      },
    })
  }

  return (
    <>
      <Button
        type="button"
        variant={activeAssistant ? 'secondary' : 'ghost'}
        size="icon"
        className={cn('size-9 rounded-lg', activeAssistant && 'border border-border/60')}
        onClick={() => setOpen(true)}
        title={formLabel(activeAssistant)}
      >
        {activeAssistant ? (
          <span className="text-sm leading-none">{activeAssistant.iconEmoji}</span>
        ) : (
          <BotIcon className="size-4" />
        )}
        <span className="sr-only">{formLabel(activeAssistant)}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Private Assistants</DialogTitle>
            <DialogDescription>
              Build private text-only assistants that keep using Zenquanta chat,
              model limits, and usage enforcement.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={startCreate}
              >
                <PlusIcon className="size-4" />
                New assistant
              </Button>
              <Button
                type="button"
                variant={!activeAssistant ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setCurrentCustomAssistant(null)}
              >
                Built-in assistants
              </Button>

              <div className="space-y-2">
                {customAssistants.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No private assistants yet.
                  </p>
                ) : (
                  customAssistants.map((assistant) => (
                    <div
                      key={assistant.id}
                      className={cn(
                        'rounded-md border p-3',
                        assistant.id === activeAssistant?.id
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border/60'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 py-0 text-left"
                          disabled={!assistant.isEnabled}
                          onClick={() => setCurrentCustomAssistant(assistant.id)}
                        >
                          <span className="text-lg">{assistant.iconEmoji}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {assistant.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {MODE_CONFIGS[assistant.baseMode].name}
                            </span>
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => togglePinned(assistant)}
                          title={
                            assistant.metadata.isPinned
                              ? 'Unpin assistant'
                              : 'Pin assistant'
                          }
                        >
                          <StarIcon
                            className={cn(
                              'size-4',
                              assistant.metadata.isPinned &&
                                'fill-current text-primary'
                            )}
                          />
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary">
                          {assistant.isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {assistant.metadata.responseStyle ? (
                          <Badge variant="outline">
                            {assistant.metadata.responseStyle}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2"
                          onClick={() => startEdit(assistant)}
                        >
                          <PencilIcon className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2"
                          onClick={() => void duplicateAssistant(assistant)}
                        >
                          <CopyIcon className="size-3.5" />
                          Duplicate
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
                <div className="space-y-2">
                  <Label htmlFor="custom-assistant-name">Name</Label>
                  <Input
                    id="custom-assistant-name"
                    value={form.name}
                    maxLength={60}
                    onChange={(event) => updateForm({ name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-assistant-emoji">Icon</Label>
                  <Input
                    id="custom-assistant-emoji"
                    value={form.iconEmoji}
                    maxLength={12}
                    onChange={(event) =>
                      updateForm({ iconEmoji: event.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-assistant-description">Description</Label>
                <Input
                  id="custom-assistant-description"
                  value={form.description}
                  maxLength={240}
                  onChange={(event) =>
                    updateForm({ description: event.target.value })
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Base assistant</Label>
                  <Select
                    value={form.baseMode}
                    onValueChange={(value) =>
                      updateForm({ baseMode: value as TextAIMode })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {MODE_CONFIGS[mode].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default response profile</Label>
                  <Select
                    value={form.defaultModelOverride}
                    onValueChange={(value) =>
                      updateForm({
                        defaultModelOverride: value as ModelOverrideOption,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OVERRIDES.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Response style</Label>
                  <Select
                    value={form.metadata?.responseStyle ?? 'balanced'}
                    onValueChange={(value) =>
                      updateForm({
                        metadata: { responseStyle: value as ResponseStyle },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESPONSE_STYLES.map((style) => (
                        <SelectItem key={style} value={style}>
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <div className="space-y-2">
                  <Label htmlFor="custom-assistant-tone">Tone</Label>
                  <Input
                    id="custom-assistant-tone"
                    value={form.metadata?.tone ?? ''}
                    maxLength={80}
                    placeholder="Direct, warm, rigorous..."
                    onChange={(event) =>
                      updateForm({ metadata: { tone: event.target.value } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Select
                    value={form.color}
                    onValueChange={(value) => updateForm({ color: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLORS.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-assistant-use-cases">
                  Suggested use cases
                </Label>
                <Input
                  id="custom-assistant-use-cases"
                  value={useCasesToText(form)}
                  maxLength={500}
                  placeholder="Planning, code review, sales replies"
                  onChange={(event) =>
                    updateForm({
                      metadata: {
                        suggestedUseCases: parseUseCases(event.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-assistant-instructions">
                  Instructions
                </Label>
                <Textarea
                  id="custom-assistant-instructions"
                  value={form.systemInstructions}
                  maxLength={6000}
                  className="min-h-36"
                  onChange={(event) =>
                    updateForm({ systemInstructions: event.target.value })
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="custom-assistant-temperature">Temperature</Label>
                  <Input
                    id="custom-assistant-temperature"
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.defaultSettings?.temperature ?? 0.7}
                    onChange={(event) =>
                      updateForm({
                        defaultSettings: {
                          temperature: Number(event.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-assistant-max-tokens">Max tokens</Label>
                  <Input
                    id="custom-assistant-max-tokens"
                    type="number"
                    min={256}
                    max={8000}
                    step={64}
                    value={form.defaultSettings?.maxTokens ?? 1400}
                    onChange={(event) =>
                      updateForm({
                        defaultSettings: {
                          maxTokens: Number(event.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-assistant-top-p">Top p</Label>
                  <Input
                    id="custom-assistant-top-p"
                    type="number"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={form.defaultSettings?.topP ?? 0.9}
                    onChange={(event) =>
                      updateForm({
                        defaultSettings: {
                          topP: Number(event.target.value),
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['webSearch', 'Web search'],
                  ['memory', 'Memory'],
                  ['fileContext', 'File context'],
                  ['isEnabled', 'Enabled'],
                ].map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <Label>{label}</Label>
                    <Switch
                      checked={
                        key === 'isEnabled'
                          ? form.isEnabled ?? true
                          : Boolean(
                              form.defaultSettings?.tools?.[
                                key as 'webSearch' | 'memory' | 'fileContext'
                              ]
                            )
                      }
                      onCheckedChange={(checked) => {
                        if (key === 'isEnabled') {
                          updateForm({ isEnabled: checked })
                          return
                        }

                        updateForm({
                          defaultSettings: {
                            tools: {
                              [key]: checked,
                            },
                          },
                        })
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Starter prompts</p>
                    <p className="text-xs text-muted-foreground">
                      Attach existing prompt-library items as assistant shortcuts.
                    </p>
                  </div>
                  <Badge variant="outline">{attachedPromptIds.length} attached</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {promptLibrary.slice(0, 8).map((prompt) => (
                    <button
                      key={prompt.id}
                      type="button"
                      className={cn(
                        'rounded-md border p-2 text-left text-sm transition hover:border-primary/50',
                        attachedPromptIds.includes(prompt.id)
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border/60'
                      )}
                      onClick={() => toggleAttachedPrompt(prompt.id)}
                    >
                      <span className="block truncate font-medium">
                        {prompt.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {prompt.mode === 'any'
                          ? 'Any assistant'
                          : MODE_CONFIGS[prompt.mode].name}
                      </span>
                    </button>
                  ))}
                  {promptLibrary.length === 0 ? (
                    <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground sm:col-span-2">
                      No prompt-library items to attach yet.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md border border-border/70 p-3">
                <div className="flex items-center gap-2">
                  <FlaskConicalIcon className="size-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Test before saving</p>
                    <p className="text-xs text-muted-foreground">
                      Runs through the normal text generation path and may consume usage.
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={testPrompt}
                    maxLength={4000}
                    className="min-h-20"
                    onChange={(event) => setTestPrompt(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={isTesting}
                    onClick={() => void runTest()}
                  >
                    <FlaskConicalIcon className="size-4" />
                    {isTesting ? 'Testing...' : 'Run test'}
                  </Button>
                </div>
                {testError ? (
                  <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {testError}
                  </p>
                ) : null}
                {testResult ? (
                  <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{MODE_CONFIGS[testResult.mode].name}</Badge>
                      <Badge variant="outline">{testResult.model}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {testResult.content}
                    </p>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex gap-2">
                  {editingAssistant ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        void deleteCustomAssistant(editingAssistant.id)
                        startCreate()
                      }}
                    >
                      <Trash2Icon className="size-4" />
                      Delete
                    </Button>
                  ) : null}
                </div>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveForm()}
                >
                  {isSaving ? 'Saving...' : 'Save assistant'}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
