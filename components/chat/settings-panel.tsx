'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import {
  AIMode,
  MODE_CONFIGS,
  ModelOverrideOption,
  SYSTEM_PRESET_CONFIGS,
  createSessionSettings,
} from '@/lib/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    projects,
    sessionSettings,
    statusLabel,
    updateSessionSettings,
    moveCurrentChatToProject,
    isSettingsPanelOpen,
    toggleSettingsPanel,
  } = useChatContext()
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (sessionSettings.modelOverride !== 'auto') {
      setShowAdvanced(true)
    }
  }, [sessionSettings.modelOverride])

  if (!isSettingsPanelOpen) return null

  const modeConfig = MODE_CONFIGS[currentMode]

  const ROUTING_PROFILE_LABELS: Record<ModelOverrideOption, string> = {
    auto: 'Mode Default',
    gemini: 'Balanced',
    claude: 'Refined',
    gpt: 'Structured',
    deepseek: 'Analytical',
    qwen: 'Technical',
  }

  const ROUTING_PROFILE_DESCRIPTIONS: Record<ModelOverrideOption, string> = {
    auto: `Uses the standard ${modeConfig.name.toLowerCase()} behavior for this session.`,
    gemini: 'A fast, balanced response profile for broad tasks.',
    claude: 'A more polished profile for nuanced writing and careful reasoning.',
    gpt: 'A structured profile for crisp answers and organized outputs.',
    deepseek: 'A more analytical profile for breakdowns and stepwise reasoning.',
    qwen: 'A more technical profile for implementation-heavy work.',
  }

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
          <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Project
            </p>
            <Select
              value={currentChat?.projectId ?? projects[0]?.id}
              onValueChange={moveCurrentChatToProject}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
              Response Profile
            </p>
            <p className="text-sm text-foreground">
              {ROUTING_PROFILE_LABELS[sessionSettings.modelOverride]}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="systemPreset" className="text-sm font-medium">
              System Preset
            </Label>
            <Select
              value={sessionSettings.systemPreset}
              onValueChange={(value) =>
                updateSessionSettings({
                  systemPreset: value as keyof typeof SYSTEM_PRESET_CONFIGS,
                })
              }
            >
              <SelectTrigger id="systemPreset">
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
            <p className="text-xs text-muted-foreground">
              {SYSTEM_PRESET_CONFIGS[sessionSettings.systemPreset].description}
            </p>
          </div>

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
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Advanced Settings</h3>
              <p className="text-xs text-muted-foreground">
                Fine-tune the session behavior without changing the active mode.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced((previous) => !previous)}
            >
              {showAdvanced ? 'Hide' : 'Show'}
            </Button>
          </div>

          {showAdvanced && (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/50 p-4">
              <div className="space-y-2">
                <Label htmlFor="modelOverride" className="text-sm font-medium">
                  Response Profile
                </Label>
                <Select
                  value={sessionSettings.modelOverride}
                  onValueChange={(value: ModelOverrideOption) =>
                    updateSessionSettings({ modelOverride: value })
                  }
                >
                  <SelectTrigger id="modelOverride">
                    <SelectValue placeholder="Auto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Mode Default</SelectItem>
                    <SelectItem value="gemini">Balanced</SelectItem>
                    <SelectItem value="claude">Refined</SelectItem>
                    <SelectItem value="gpt">Structured</SelectItem>
                    <SelectItem value="deepseek">Analytical</SelectItem>
                    <SelectItem value="qwen">Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {ROUTING_PROFILE_DESCRIPTIONS[sessionSettings.modelOverride]}
              </p>
            </div>
          )}
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
                  Allow retrieval-style context when available
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
                  Include extracted attachment text in the assistant context for this chat
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
