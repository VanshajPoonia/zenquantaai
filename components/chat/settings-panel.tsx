'use client'

import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { getModeAccentClass } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { XIcon, GlobeIcon, DatabaseIcon, FileIcon } from '@/components/icons'

function getSliderClass(mode: string) {
  const colorClass = getModeAccentClass(mode as 'creative' | 'logic' | 'code', 'bg')
  const borderClass = getModeAccentClass(mode as 'creative' | 'logic' | 'code', 'border')
  return `[&_[data-slot=slider-range]]:${colorClass} [&_[data-slot=slider-thumb]]:${borderClass}`
}

export function SettingsPanel() {
  const {
    sessionSettings,
    updateSessionSettings,
    isSettingsPanelOpen,
    toggleSettingsPanel,
    currentMode,
  } = useChatContext()

  if (!isSettingsPanelOpen) return null

  return (
    <aside
      className={cn(
        'w-80 bg-card border-l border-border h-full flex flex-col',
        'animate-in slide-in-from-right-5 duration-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Session Settings</h2>
        <Button variant="ghost" size="icon-sm" onClick={toggleSettingsPanel}>
          <XIcon className="size-4" />
        </Button>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Temperature */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="temperature" className="text-sm font-medium">
              Temperature
            </Label>
            <span className="text-sm text-muted-foreground font-mono">
              {sessionSettings.temperature.toFixed(1)}
            </span>
          </div>
          <Slider
            id="temperature"
            min={0}
            max={2}
            step={0.1}
            value={[sessionSettings.temperature]}
            onValueChange={([value]) =>
              updateSessionSettings({ temperature: value })
            }
            className={getSliderClass(currentMode)}
          />
          <p className="text-xs text-muted-foreground">
            Higher values make output more random, lower values more focused.
          </p>
        </div>

        {/* Max Tokens */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="maxTokens" className="text-sm font-medium">
              Max Tokens
            </Label>
            <span className="text-sm text-muted-foreground font-mono">
              {sessionSettings.maxTokens}
            </span>
          </div>
          <Slider
            id="maxTokens"
            min={256}
            max={8192}
            step={256}
            value={[sessionSettings.maxTokens]}
            onValueChange={([value]) =>
              updateSessionSettings({ maxTokens: value })
            }
            className={getSliderClass(currentMode)}
          />
          <p className="text-xs text-muted-foreground">
            Maximum length of the generated response.
          </p>
        </div>

        <Separator />

        {/* Toggle Options */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Features</h3>

          {/* Web Search */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <GlobeIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <Label
                  htmlFor="webSearch"
                  className="text-sm font-medium cursor-pointer"
                >
                  Web Search
                </Label>
                <p className="text-xs text-muted-foreground">
                  Search the web for context
                </p>
              </div>
            </div>
            <Switch
              id="webSearch"
              checked={sessionSettings.webSearch}
              onCheckedChange={(checked) =>
                updateSessionSettings({ webSearch: checked })
              }
            />
          </div>

          {/* Memory */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <DatabaseIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <Label
                  htmlFor="memory"
                  className="text-sm font-medium cursor-pointer"
                >
                  Memory
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remember conversation context
                </p>
              </div>
            </div>
            <Switch
              id="memory"
              checked={sessionSettings.memory}
              onCheckedChange={(checked) =>
                updateSessionSettings({ memory: checked })
              }
            />
          </div>

          {/* File Context */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <FileIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <Label
                  htmlFor="fileContext"
                  className="text-sm font-medium cursor-pointer"
                >
                  File Context
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use uploaded files as context
                </p>
              </div>
            </div>
            <Switch
              id="fileContext"
              checked={sessionSettings.fileContext}
              onCheckedChange={(checked) =>
                updateSessionSettings({ fileContext: checked })
              }
            />
          </div>
        </div>

        <Separator />

        {/* Reset */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            updateSessionSettings({
              temperature: 0.7,
              maxTokens: 4096,
              webSearch: false,
              memory: true,
              fileContext: false,
            })
          }
        >
          Reset to Defaults
        </Button>
      </div>
    </aside>
  )
}
