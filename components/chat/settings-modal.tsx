'use client'

import { useEffect, useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import {
  AIMode,
  AppSettings,
  MODE_CONFIGS,
  MODE_ORDER,
  SYSTEM_PRESET_CONFIGS,
  createSessionSettings,
} from '@/lib/types'
import {
  ModeIcon,
  getModeAccentClass,
  getModeGradient,
  getModeTintClass,
} from '@/lib/mode-utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckIcon } from '@/components/icons'
import {
  getMaxTokensQuantity,
  getTemperatureQuantity,
  getTopPQuantity,
} from '@/lib/utils/session-display'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ModeSelectionCard({
  mode,
  active,
  onClick,
}: {
  mode: AIMode
  active: boolean
  onClick: () => void
}) {
  const config = MODE_CONFIGS[mode]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative min-h-[148px] rounded-3xl border p-4 text-left transition-all duration-200 sm:min-h-[160px] sm:p-5 ${
        active
          ? `${getModeTintClass(mode, 'strong')} border-current ${getModeAccentClass(mode, 'text')} shadow-xl shadow-black/20`
          : 'border-border/70 bg-card/70 hover:-translate-y-0.5 hover:border-border hover:bg-card'
      }`}
    >
      <div className={`absolute inset-0 rounded-3xl opacity-0 ${active ? 'opacity-100' : ''} ${getModeGradient(mode)}`} />
      <div className="relative flex h-full flex-col gap-4 sm:gap-5">
        <div className={`flex size-12 items-center justify-center rounded-2xl sm:size-14 ${getModeTintClass(mode, 'strong')}`}>
          <ModeIcon mode={mode} size="md" className={getModeAccentClass(mode, 'text')} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold leading-tight text-foreground sm:text-base">{config.name}</p>
          <p className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">{config.description}</p>
        </div>
      </div>
    </button>
  )
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { appSettings, saveAppSettings } = useChatContext()
  const [localSettings, setLocalSettings] = useState<AppSettings>(appSettings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      setLocalSettings(appSettings)
    }
  }, [appSettings, open])

  const handleSave = async () => {
    const next = await saveAppSettings(localSettings)
    setLocalSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[92vh] max-w-[1240px] overflow-hidden rounded-[24px] border border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40 sm:w-[min(1240px,calc(100vw-2rem))] sm:rounded-[28px]">
        <div className="flex h-full max-h-[92vh] min-h-0 flex-col">
        <DialogHeader className="border-b border-border/70 bg-gradient-to-b from-card/80 to-background px-4 py-5 text-left sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <DialogTitle className="text-xl tracking-tight sm:text-2xl lg:text-[1.9rem]">Settings</DialogTitle>
          <DialogDescription className="max-w-3xl text-xs leading-6 sm:text-sm sm:leading-6">
            Save default behavior for Zenquanta AI and adjust how new sessions feel by default.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:gap-6 lg:px-8 lg:py-6">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/40 p-1.5 sm:max-w-md">
            <TabsTrigger value="general" className="rounded-xl">General</TabsTrigger>
            <TabsTrigger value="about" className="rounded-xl">About</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1 pb-6 sm:space-y-7 sm:pr-2">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold sm:text-lg">Default Mode</h3>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Applies when you open a fresh chat session.
                  </p>
                </div>
                <Badge variant="secondary">Saved to settings</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {MODE_ORDER.map((mode) => (
                  <ModeSelectionCard
                    key={mode}
                    mode={mode}
                    active={localSettings.defaultMode === mode}
                    onClick={() =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        defaultMode: mode,
                        sessionDefaults: createSessionSettings(mode, previous.sessionDefaults),
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="defaultTemperature">Default Temperature</Label>
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    {getTemperatureQuantity(localSettings.sessionDefaults.temperature)}
                  </span>
                </div>
                <Slider
                  id="defaultTemperature"
                  min={0}
                  max={2}
                  step={0.05}
                  value={[localSettings.sessionDefaults.temperature]}
                  onValueChange={([value]) =>
                    setLocalSettings((previous) => ({
                      ...previous,
                      sessionDefaults: {
                        ...previous.sessionDefaults,
                        temperature: value,
                      },
                    }))
                  }
                />
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Starts from the selected mode default, but you can tune it for new chats.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="defaultMaxTokens">Default Max Tokens</Label>
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    {getMaxTokensQuantity(localSettings.sessionDefaults.maxTokens)}
                  </span>
                </div>
                <Slider
                  id="defaultMaxTokens"
                  min={256}
                  max={4096}
                  step={256}
                  value={[localSettings.sessionDefaults.maxTokens]}
                  onValueChange={([value]) =>
                    setLocalSettings((previous) => ({
                      ...previous,
                      sessionDefaults: {
                        ...previous.sessionDefaults,
                        maxTokens: value,
                      },
                    }))
                  }
                />
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Sets the default response length ceiling for newly created chats.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <Label htmlFor="defaultTopP">Default Top P</Label>
                <span className="text-xs text-muted-foreground sm:text-sm">
                  {getTopPQuantity(localSettings.sessionDefaults.topP)}
                </span>
              </div>
              <Slider
                id="defaultTopP"
                min={0.1}
                max={1}
                step={0.05}
                value={[localSettings.sessionDefaults.topP]}
                onValueChange={([value]) =>
                  setLocalSettings((previous) => ({
                    ...previous,
                    sessionDefaults: {
                      ...previous.sessionDefaults,
                      topP: value,
                    },
                  }))
                }
              />
              <p className="text-[11px] leading-5 text-muted-foreground">
                Controls how broad token sampling should be in freshly started chats.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
              <div>
                <Label htmlFor="defaultSystemPreset">Default System Preset</Label>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  Applies tone and response framing to new chats by default.
                </p>
              </div>
              <Select
                value={localSettings.sessionDefaults.systemPreset}
                onValueChange={(value) =>
                  setLocalSettings((previous) => ({
                    ...previous,
                    sessionDefaults: {
                      ...previous.sessionDefaults,
                      systemPreset:
                        value as AppSettings['sessionDefaults']['systemPreset'],
                    },
                  }))
                }
              >
                <SelectTrigger id="defaultSystemPreset">
                  <SelectValue placeholder="Balanced" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SYSTEM_PRESET_CONFIGS).map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-5 text-muted-foreground">
                {
                  SYSTEM_PRESET_CONFIGS[localSettings.sessionDefaults.systemPreset]
                    .description
                }
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-4 sm:p-5">
                <div>
                  <h3 className="text-base font-semibold">Response Style</h3>
                  <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
                    Shapes the overall tone of assistant output.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['balanced', 'concise', 'detailed'] as const).map((style) => (
                    <Button
                      key={style}
                      type="button"
                      variant={localSettings.responseStyle === style ? 'default' : 'outline'}
                      onClick={() =>
                        setLocalSettings((previous) => ({
                          ...previous,
                          responseStyle: style,
                        }))
                      }
                      className="capitalize"
                    >
                      {style}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-4 sm:p-5">
                <div>
                  <h3 className="text-base font-semibold">Visual Preferences</h3>
                  <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
                    Stored now for future theming and accent routing.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="default" disabled>
                    Dark
                  </Button>
                  <Button
                    type="button"
                    variant={localSettings.accentStyle === 'glass' ? 'default' : 'outline'}
                    onClick={() =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        accentStyle:
                          previous.accentStyle === 'glass' ? 'mode' : 'glass',
                      }))
                    }
                  >
                    {localSettings.accentStyle === 'glass' ? 'Glass accents' : 'Mode accents'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
              <h3 className="text-base font-semibold">Default Feature Toggles</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                  <div>
                    <p className="text-xs font-medium sm:text-sm">Web Search</p>
                    <p className="text-[11px] text-muted-foreground">Off by default</p>
                  </div>
                  <Switch
                    checked={localSettings.sessionDefaults.webSearch}
                    onCheckedChange={(checked) =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        sessionDefaults: {
                          ...previous.sessionDefaults,
                          webSearch: checked,
                        },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                  <div>
                    <p className="text-xs font-medium sm:text-sm">Memory</p>
                    <p className="text-[11px] text-muted-foreground">Carry conversation context</p>
                  </div>
                  <Switch
                    checked={localSettings.sessionDefaults.memory}
                    onCheckedChange={(checked) =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        sessionDefaults: {
                          ...previous.sessionDefaults,
                          memory: checked,
                        },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                  <div>
                    <p className="text-xs font-medium sm:text-sm">File Context</p>
                    <p className="text-[11px] text-muted-foreground">Include extracted attachment text by default</p>
                  </div>
                  <Switch
                    checked={localSettings.sessionDefaults.fileContext}
                    onCheckedChange={(checked) =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        sessionDefaults: {
                          ...previous.sessionDefaults,
                          fileContext: checked,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="about" className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-6 sm:pr-2">
            <div className="rounded-3xl border border-border/70 bg-card/60 px-4 py-8 text-center sm:px-6 sm:py-10">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="size-12 rounded-xl bg-gradient-to-br from-creative via-logic to-code flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">Z</span>
                </div>
              </div>
              <h2 className="mb-2 text-xl font-bold sm:text-2xl">Zenquanta AI</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Creative, reasoning, and coding assistant
              </p>
              <p className="mx-auto max-w-md text-xs leading-6 text-muted-foreground sm:text-sm">
                Designed as a polished workspace for drafting, analysis, implementation, and focused collaboration.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="border-t border-border/70 bg-background/90 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-6 text-muted-foreground sm:text-xs">
            These defaults apply to fresh chats while current sessions keep their own tuned settings.
          </p>
          <Button onClick={handleSave} className="gap-2">
            {saved ? (
              <>
                <CheckIcon className="size-4" />
                Saved
              </>
            ) : (
              'Save settings'
            )}
          </Button>
        </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
