'use client'

import { useMemo, useState } from 'react'
import { BotIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import { MODE_CONFIGS } from '@/lib/types'
import {
  CustomAssistant,
  CustomAssistantInput,
  ModelOverrideOption,
  TextAIMode,
} from '@/types'
import { Button } from '@/components/ui/button'
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
  isEnabled: true,
}

function toForm(assistant?: CustomAssistant | null): CustomAssistantInput & { id?: string } {
  if (!assistant) return { ...DEFAULT_FORM }

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
    isEnabled: assistant.isEnabled,
  }
}

function formLabel(assistant: CustomAssistant | null): string {
  if (!assistant) return 'Custom assistants'
  return `${assistant.iconEmoji} ${assistant.name}`
}

export function CustomAssistantButton() {
  const {
    customAssistants,
    currentCustomAssistantId,
    setCurrentCustomAssistant,
    saveCustomAssistant,
    deleteCustomAssistant,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CustomAssistantInput & { id?: string }>(
    DEFAULT_FORM
  )

  const activeAssistant = useMemo(
    () =>
      customAssistants.find((assistant) => assistant.id === currentCustomAssistantId) ??
      null,
    [customAssistants, currentCustomAssistantId]
  )
  const editingAssistant = useMemo(
    () => customAssistants.find((assistant) => assistant.id === editingId) ?? null,
    [customAssistants, editingId]
  )

  const startCreate = () => {
    setEditingId(null)
    setForm(toForm(null))
  }

  const startEdit = (assistant: CustomAssistant) => {
    setEditingId(assistant.id)
    setForm(toForm(assistant))
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
    }))
  }

  const saveForm = async () => {
    const assistant = await saveCustomAssistant(form)
    if (!assistant) return
    setEditingId(assistant.id)
    setForm(toForm(assistant))
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
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Custom Assistants</DialogTitle>
            <DialogDescription>
              Private text assistants that run through the normal chat path.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <div className="space-y-2">
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
              <div className="space-y-1">
                {customAssistants.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No custom assistants yet.
                  </p>
                ) : (
                  customAssistants.map((assistant) => (
                    <div
                      key={assistant.id}
                      className={cn(
                        'flex items-center gap-1 rounded-md border p-1',
                        assistant.id === activeAssistant?.id
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border/60'
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto min-w-0 flex-1 justify-start gap-2 px-2 py-1.5"
                        disabled={!assistant.isEnabled}
                        onClick={() => setCurrentCustomAssistant(assistant.id)}
                      >
                        <span>{assistant.iconEmoji}</span>
                        <span className="truncate text-left text-sm">
                          {assistant.name}
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => startEdit(assistant)}
                        title="Edit assistant"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
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
                  <Label>Default model</Label>
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
                <Label htmlFor="custom-assistant-instructions">
                  System instructions
                </Label>
                <Textarea
                  id="custom-assistant-instructions"
                  value={form.systemInstructions}
                  maxLength={6000}
                  className="min-h-32"
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

              <DialogFooter>
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
                <Button type="button" onClick={() => void saveForm()}>
                  Save assistant
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
