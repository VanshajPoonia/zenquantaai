'use client'

import { useEffect, useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, AppSettings, MODE_CONFIGS, createSessionSettings } from '@/lib/types'
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
import { CheckIcon } from '@/components/icons'

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
      className={`relative rounded-2xl border p-4 text-left transition-all ${
        active
          ? `${getModeTintClass(mode, 'strong')} border-current ${getModeAccentClass(mode, 'text')}`
          : 'border-border bg-card hover:bg-card/80'
      }`}
    >
      <div className={`absolute inset-0 rounded-2xl opacity-0 ${active ? 'opacity-100' : ''} ${getModeGradient(mode)}`} />
      <div className="relative flex items-center gap-3">
        <div className={`p-2 rounded-xl ${getModeTintClass(mode, 'strong')}`}>
          <ModeIcon mode={mode} size="md" className={getModeAccentClass(mode, 'text')} />
        </div>
        <div>
          <p className="font-semibold text-foreground">{config.name}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
      </div>
    </button>
  )
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { appSettings, saveAppSettings } = useChatContext()
  const [localSettings, setLocalSettings] = useState<AppSettings>(appSettings)
  const [saved, setSaved] = useState(false)
  const defaultModeConfig = MODE_CONFIGS[localSettings.defaultMode]

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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Settings</DialogTitle>
          <DialogDescription>
            Save default behavior for Zenquanta AI while keeping OpenRouter credentials env-backed on the server.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="gateway">Gateway</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Default Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    Applies when you open a fresh chat session.
                  </p>
                </div>
                <Badge variant="secondary">Saved to settings</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {(['creative', 'logic', 'code'] as AIMode[]).map((mode) => (
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

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="defaultTemperature">Default Temperature</Label>
                  <span className="text-sm text-muted-foreground font-mono">
                    {defaultModeConfig.temperature.toFixed(2)}
                  </span>
                </div>
                <Slider
                  id="defaultTemperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[defaultModeConfig.temperature]}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Locked to the selected mode so defaults match the shared model routing config.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="defaultMaxTokens">Default Max Tokens</Label>
                  <span className="text-sm text-muted-foreground font-mono">
                    {defaultModeConfig.maxTokens}
                  </span>
                </div>
                <Slider
                  id="defaultMaxTokens"
                  min={256}
                  max={8192}
                  step={256}
                  value={[defaultModeConfig.maxTokens]}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Managed by the mode mapping so API defaults and UI stay aligned.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border p-4 space-y-3">
                <div>
                  <h3 className="font-semibold">Response Style</h3>
                  <p className="text-sm text-muted-foreground">
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

              <div className="rounded-2xl border border-border p-4 space-y-3">
                <div>
                  <h3 className="font-semibold">Visual Preferences</h3>
                  <p className="text-sm text-muted-foreground">
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

            <div className="space-y-4 rounded-2xl border border-border p-4">
              <h3 className="font-semibold">Default Feature Toggles</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                  <div>
                    <p className="text-sm font-medium">Web Search</p>
                    <p className="text-xs text-muted-foreground">Off by default</p>
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
                    <p className="text-sm font-medium">Memory</p>
                    <p className="text-xs text-muted-foreground">Carry conversation context</p>
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
                    <p className="text-sm font-medium">File Context</p>
                    <p className="text-xs text-muted-foreground">Reserved for future upload support</p>
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

          <TabsContent value="gateway" className="space-y-6 mt-6">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                OpenRouter is the only AI gateway in this app. These fields stay as local placeholders for convenience, but live requests use the server env vars.
              </p>
            </div>

            <div className="relative rounded-2xl border border-border p-4 overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-logic/20 via-transparent to-code/20" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-secondary/60">
                    <span className="text-sm font-semibold">OR</span>
                  </div>
                  <div>
                    <p className="font-semibold">OpenRouter</p>
                    <p className="text-sm text-muted-foreground">
                      Single gateway for all Zenquanta modes and models
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="openrouter-api-key">OpenRouter API key placeholder</Label>
                    <Input
                      id="openrouter-api-key"
                      type="password"
                      placeholder="sk-or-..."
                      value={localSettings.gatewayDrafts.openRouterApiKey}
                      onChange={(event) =>
                        setLocalSettings((previous) => ({
                          ...previous,
                          gatewayDrafts: {
                            ...previous.gatewayDrafts,
                            openRouterApiKey: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openrouter-base-url">Base URL placeholder</Label>
                    <Input
                      id="openrouter-base-url"
                      placeholder="https://openrouter.ai/api/v1"
                      value={localSettings.gatewayDrafts.openRouterBaseUrl}
                      onChange={(event) =>
                        setLocalSettings((previous) => ({
                          ...previous,
                          gatewayDrafts: {
                            ...previous.gatewayDrafts,
                            openRouterBaseUrl: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="models" className="space-y-4 mt-6">
            <div className="grid gap-4">
              {(['creative', 'logic', 'code'] as AIMode[]).map((mode) => {
                const config = MODE_CONFIGS[mode]

                return (
                  <div
                    key={mode}
                    className={`relative p-4 rounded-xl border border-border bg-card overflow-hidden`}
                  >
                    <div className={`absolute inset-0 ${getModeGradient(mode)} opacity-20`} />
                    <div className="relative space-y-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getModeTintClass(mode, 'strong')}`}>
                          <ModeIcon
                            mode={mode}
                            size="md"
                            className={getModeAccentClass(mode, 'text')}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold">{config.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {config.description}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3 text-sm">
                        <div className="rounded-lg border border-border/60 p-3">
                          <p className="text-muted-foreground mb-1">Default temperature</p>
                          <p className="font-medium">{config.temperature.toFixed(2)}</p>
                        </div>
                        <div className="rounded-lg border border-border/60 p-3">
                          <p className="text-muted-foreground mb-1">Default max tokens</p>
                          <p className="font-medium">{config.maxTokens}</p>
                        </div>
                        <div className="rounded-lg border border-border/60 p-3">
                          <p className="text-muted-foreground mb-1">Top P</p>
                          <p className="font-medium">{config.topP.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="about" className="space-y-4 mt-6">
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="size-12 rounded-xl bg-gradient-to-br from-creative via-logic to-code flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">Z</span>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Zenquanta AI</h2>
              <p className="text-muted-foreground mb-4">
                Multi-model creative, reasoning, and coding assistant
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                This refactor keeps the existing premium interface intact while moving the app onto a typed, OpenRouter-first architecture with streaming-ready contracts and replaceable storage.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
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
      </DialogContent>
    </Dialog>
  )
}
