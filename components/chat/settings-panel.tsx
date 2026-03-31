'use client'

import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, MODE_CONFIGS, createSessionSettings } from '@/lib/types'
import {
  getModeAccentClass,
  getModeTintClass,
} from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { XIcon, GlobeIcon, DatabaseIcon, FileIcon } from '@/components/icons'

function getSliderClass(mode: AIMode) {
  const colorClass = getModeAccentClass(mode, 'bg')
  const borderClass = getModeAccentClass(mode, 'border')
  return `[&_[data-slot=slider-range]]:${colorClass} [&_[data-slot=slider-thumb]]:${borderClass}`
}

export function SettingsPanel() {
  const {
    currentMode,
    currentChat,
    sessionSettings,
    statusLabel,
    updateSessionSettings,
    isSettingsPanelOpen,
    toggleSettingsPanel,
  } = useChatContext()

  if (!isSettingsPanelOpen) return null

  const modeConfig = MODE_CONFIGS[currentMode]

  return (
    <aside
      className={cn(
        'w-80 bg-card border-l border-border h-full min-h-0 flex flex-col',
        'animate-in slide-in-from-right-5 duration-200'
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="font-semibold text-foreground">Session Settings</h2>
          <p className="text-xs text-muted-foreground">
            Conversation controls for the current mode
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={toggleSettingsPanel}>
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 pb-8">
        <div
          className={cn(
            'rounded-2xl border p-4 space-y-3',
            getModeTintClass(currentMode, 'subtle')
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {currentChat?.title ?? 'Draft session'}
              </p>
              <p className="text-xs text-muted-foreground">
                {modeConfig.name} mode
              </p>
            </div>
            <Badge variant={statusLabel === 'Streaming' ? 'default' : 'secondary'}>
              {statusLabel}
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {modeConfig.description}
          </p>
          <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
              Mode
            </p>
            <p className="text-sm text-foreground">
              {modeConfig.name}
            </p>
          </div>
          {currentChat?.usage && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                  Est. Cost
                </p>
                <p className="text-sm font-medium text-foreground">
                  ${currentChat.usage.estimatedCostUsd.toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                  Tokens
                </p>
                <p className="text-sm font-medium text-foreground">
                  {currentChat.usage.totalTokens}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="temperature" className="text-sm font-medium">
              Temperature
            </Label>
            <span className="text-sm text-muted-foreground font-mono">
              {sessionSettings.temperature.toFixed(2)}
            </span>
          </div>
          <Slider
            id="temperature"
            min={0}
            max={2}
            step={0.05}
            value={[sessionSettings.temperature]}
            onValueChange={([value]) => updateSessionSettings({ temperature: value })}
            className={getSliderClass(currentMode)}
          />
          <p className="text-xs text-muted-foreground">
            Start from the mode default, then tune creativity or precision for this conversation.
          </p>
        </div>

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
            max={4096}
            step={256}
            value={[sessionSettings.maxTokens]}
            onValueChange={([value]) => updateSessionSettings({ maxTokens: value })}
            className={getSliderClass(currentMode)}
          />
          <p className="text-xs text-muted-foreground">
            Controls the response length ceiling for this chat.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="topP" className="text-sm font-medium">
              Top P
            </Label>
            <span className="text-sm text-muted-foreground font-mono">
              {sessionSettings.topP.toFixed(2)}
            </span>
          </div>
          <Slider
            id="topP"
            min={0.1}
            max={1}
            step={0.05}
            value={[sessionSettings.topP]}
            onValueChange={([value]) => updateSessionSettings({ topP: value })}
            className={getSliderClass(currentMode)}
          />
          <p className="text-xs text-muted-foreground">
            Narrows or broadens token sampling for the current session.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Features</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <GlobeIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="webSearch" className="text-sm font-medium cursor-pointer">
                  Web Search
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow retrieval-style context when the gateway supports it
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <DatabaseIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="memory" className="text-sm font-medium cursor-pointer">
                  Memory
                </Label>
                <p className="text-xs text-muted-foreground">
                  Carry forward recent conversation context
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <FileIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="fileContext" className="text-sm font-medium cursor-pointer">
                  File Context
                </Label>
                <p className="text-xs text-muted-foreground">
                  Reserve file-aware routing for future attachment support
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

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Recent attachments</h3>
          {currentChat?.attachments && currentChat.attachments.length > 0 ? (
            <div className="space-y-2">
              {currentChat.attachments.slice(-4).map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-xl border border-border bg-background/50 px-3 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{attachment.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {attachment.kind}
                    {attachment.isExtracted ? ' • extracted text ready' : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-background/50 px-3 py-4 text-sm text-muted-foreground">
              No files attached yet. Add PDFs, images, or text files from the composer.
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            updateSessionSettings(
              createSessionSettings(currentChat?.mode ?? currentMode)
            )
          }
        >
          Reset to mode defaults
        </Button>
      </div>
    </aside>
  )
}
