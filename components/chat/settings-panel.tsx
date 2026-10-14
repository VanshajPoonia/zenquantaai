'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import {
  AIMode,
  MODE_CONFIGS,
  ModelOverrideOption,
  RESPONSE_PROFILE_DESCRIPTIONS,
  RESPONSE_PROFILE_LABELS,
  SYSTEM_PRESET_CONFIGS,
  FileIntelligence,
  createSessionSettings,
} from '@/lib/types'
import { getModeAccentClass } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { XIcon, GlobeIcon, DatabaseIcon, FileIcon } from '@/components/icons'
import {
  getMaxTokensQuantity,
  getTemperatureQuantity,
  getTopPQuantity,
} from '@/lib/utils/session-display'
import { FileIntelligenceCard } from './file-intelligence-card'

function getSliderClass(mode: AIMode) {
  const colorClass = getModeAccentClass(mode, 'bg')
  const borderClass = getModeAccentClass(mode, 'border')
  return `[&_[data-slot=slider-range]]:${colorClass} [&_[data-slot=slider-thumb]]:${borderClass}`
}

function FeatureSwitch({
  id,
  icon,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  icon: ReactNode
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-lg bg-muted p-2">{icon}</div>
        <div className="min-w-0">
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
            {title}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

function PanelSlider({
  id,
  label,
  valueLabel,
  hint,
  min,
  max,
  step,
  value,
  className,
  onChange,
}: {
  id: string
  label: string
  valueLabel: string
  hint: string
  min: number
  max: number
  step: number
  value: number
  className?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <span className="text-sm tabular-nums text-muted-foreground">{valueLabel}</span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        className={className}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function SettingsPanel() {
  const {
    currentMode,
    currentChat,
    projects,
    sessionSettings,
    updateSessionSettings,
    moveCurrentChatToProject,
    isSettingsPanelOpen,
    toggleSettingsPanel,
    listFileIntelligence,
    openWorkspaceTool,
    reindexFile,
    deleteFile,
  } = useChatContext()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [filesById, setFilesById] = useState<Record<string, FileIntelligence>>({})
  const [workingFileId, setWorkingFileId] = useState<string | null>(null)
  const attachmentFileIds = useMemo(
    () => [
      ...new Set(
        (currentChat?.attachments ?? [])
          .map((attachment) => attachment.fileId)
          .filter(Boolean) as string[]
      ),
    ],
    [currentChat?.attachments]
  )

  useEffect(() => {
    if (attachmentFileIds.length === 0) {
      setFilesById({})
      return
    }

    let cancelled = false
    void listFileIntelligence({ ids: attachmentFileIds })
      .then((response) => {
        if (cancelled) return
        setFilesById(
          Object.fromEntries(response.files.map((file) => [file.id, file]))
        )
      })
      .catch((error) => {
        console.error('Failed to load recent attachment intelligence.', error)
      })

    return () => {
      cancelled = true
    }
  }, [attachmentFileIds, listFileIntelligence])

  const handleAskFile = (file: FileIntelligence) => {
    openWorkspaceTool({
      tool: 'ask-files',
      projectId: file.projectId,
      fileId: file.id,
    })
  }

  const handleReindexFile = async (file: FileIntelligence) => {
    setWorkingFileId(file.id)
    try {
      const updated = await reindexFile(file.id)
      if (updated) {
        setFilesById((previous) => ({ ...previous, [updated.id]: updated }))
      }
    } catch (error) {
      console.error('Failed to re-index file.', error)
    } finally {
      setWorkingFileId(null)
    }
  }

  const handleDeleteFile = async (file: FileIntelligence) => {
    setWorkingFileId(file.id)
    try {
      await deleteFile(file.id)
      setFilesById((previous) => {
        const next = { ...previous }
        delete next[file.id]
        return next
      })
    } catch (error) {
      console.error('Failed to remove file.', error)
    } finally {
      setWorkingFileId(null)
    }
  }

  if (!isSettingsPanelOpen) return null

  const modeConfig = MODE_CONFIGS[currentMode]

  return (
    <>
      {/* Backdrop — mobile only, where the panel becomes a full-screen overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={toggleSettingsPanel}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-sm min-h-0 flex-col border-l border-border bg-card',
          'md:static md:z-auto md:h-full md:w-80 md:max-w-none',
          'animate-in slide-in-from-right-5 duration-200'
        )}
      >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">Chat settings</h2>
          <p className="truncate text-xs text-muted-foreground">
            {currentChat?.title ?? 'New chat'} · {modeConfig.name}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close chat settings"
          onClick={toggleSettingsPanel}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 space-y-6 overflow-y-auto p-4 pb-8">
        {currentChat ? (
          <div className="space-y-2">
            <Label htmlFor="chatProject" className="text-sm font-medium">
              Project
            </Label>
            <Select
              value={currentChat.projectId ?? projects[0]?.id}
              onValueChange={moveCurrentChatToProject}
            >
              <SelectTrigger id="chatProject" className="h-9 w-full">
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
        ) : null}

        <div className="space-y-4">
          <FeatureSwitch
            id="webSearch"
            icon={<GlobeIcon className="size-4 text-muted-foreground" />}
            title="Search the web"
            description={
              currentMode === 'live'
                ? 'Pulse always searches the web.'
                : 'Look up current information when it helps.'
            }
            checked={currentMode === 'live' || sessionSettings.webSearch}
            disabled={currentMode === 'live'}
            onCheckedChange={(checked) => updateSessionSettings({ webSearch: checked })}
          />
          <FeatureSwitch
            id="memory"
            icon={<DatabaseIcon className="size-4 text-muted-foreground" />}
            title="Remember context"
            description="Keep a running summary of this chat."
            checked={sessionSettings.memory}
            onCheckedChange={(checked) => updateSessionSettings({ memory: checked })}
          />
          <FeatureSwitch
            id="fileContext"
            icon={<FileIcon className="size-4 text-muted-foreground" />}
            title="Use project files"
            description="Let replies draw on files in this project."
            checked={sessionSettings.fileContext}
            onCheckedChange={(checked) => updateSessionSettings({ fileContext: checked })}
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Files in this chat</h3>
          {currentChat?.attachments && currentChat.attachments.length > 0 ? (
            <div className="space-y-2">
              {currentChat.attachments.slice(-4).map((attachment) => {
                const file = attachment.fileId ? filesById[attachment.fileId] : null

                if (!file) {
                  return (
                    <div
                      key={attachment.id}
                      className="rounded-xl border border-border bg-background/50 px-3 py-3"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {attachment.kind}
                        {attachment.isExtracted ? ' · text ready' : ''}
                      </p>
                    </div>
                  )
                }

                return (
                  <FileIntelligenceCard
                    key={attachment.id}
                    file={file}
                    compact
                    isWorking={workingFileId === file.id}
                    onAsk={handleAskFile}
                    onReindex={handleReindexFile}
                    onDelete={handleDeleteFile}
                  />
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No files yet. Use + in the message box, or drop files onto it.
            </p>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((previous) => !previous)}
            className="flex w-full items-center justify-between text-left"
          >
            <span>
              <span className="block text-sm font-medium text-foreground">Advanced</span>
              <span className="block text-xs text-muted-foreground">
                Tone, model profile and sampling.
              </span>
            </span>
            <ChevronDown
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                showAdvanced && 'rotate-180'
              )}
            />
          </button>

          {showAdvanced ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="systemPreset" className="text-sm font-medium">
                  Tone preset
                </Label>
                <Select
                  value={sessionSettings.systemPreset}
                  onValueChange={(value) =>
                    updateSessionSettings({
                      systemPreset: value as keyof typeof SYSTEM_PRESET_CONFIGS,
                    })
                  }
                >
                  <SelectTrigger id="systemPreset" className="w-full">
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

              <div className="space-y-2">
                <Label htmlFor="modelOverride" className="text-sm font-medium">
                  Model profile
                </Label>
                <Select
                  value={sessionSettings.modelOverride}
                  onValueChange={(value: ModelOverrideOption) =>
                    updateSessionSettings({ modelOverride: value })
                  }
                >
                  <SelectTrigger id="modelOverride" className="w-full">
                    <SelectValue placeholder="Smart Match" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Smart Match</SelectItem>
                    <SelectItem value="gemini">Swift</SelectItem>
                    <SelectItem value="claude">Polished</SelectItem>
                    <SelectItem value="gpt">Clear</SelectItem>
                    <SelectItem value="deepseek">Analyst</SelectItem>
                    <SelectItem value="qwen">Builder</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {RESPONSE_PROFILE_LABELS[sessionSettings.modelOverride]}:{' '}
                  {RESPONSE_PROFILE_DESCRIPTIONS[sessionSettings.modelOverride]}
                </p>
              </div>

              <PanelSlider
                id="temperature"
                label="Temperature"
                valueLabel={getTemperatureQuantity(sessionSettings.temperature)}
                hint="Higher is more creative, lower is more precise."
                min={0}
                max={2}
                step={0.05}
                value={sessionSettings.temperature}
                className={getSliderClass(currentMode)}
                onChange={(temperature) => updateSessionSettings({ temperature })}
              />
              <PanelSlider
                id="maxTokens"
                label="Max reply length"
                valueLabel={getMaxTokensQuantity(sessionSettings.maxTokens)}
                hint="The longest a single reply can be."
                min={256}
                max={4096}
                step={256}
                value={sessionSettings.maxTokens}
                className={getSliderClass(currentMode)}
                onChange={(maxTokens) => updateSessionSettings({ maxTokens })}
              />
              <PanelSlider
                id="topP"
                label="Top P"
                valueLabel={getTopPQuantity(sessionSettings.topP)}
                hint="How widely the model samples words."
                min={0.1}
                max={1}
                step={0.05}
                value={sessionSettings.topP}
                className={getSliderClass(currentMode)}
                onChange={(topP) => updateSessionSettings({ topP })}
              />

              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  updateSessionSettings(
                    createSessionSettings(currentChat?.mode ?? currentMode)
                  )
                }
              >
                Reset to {modeConfig.name} defaults
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      </aside>
    </>
  )
}
