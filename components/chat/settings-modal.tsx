'use client'

import { ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useChatContext } from '@/lib/chat-context'
import {
  AppSettings,
  DefaultProjectBehavior,
  MODE_CONFIGS,
  MODE_ORDER,
  SYSTEM_PRESET_CONFIGS,
  UserPurgeCounts,
  UserPurgePreview,
  UserPurgeResult,
  UserPurgeScope,
  UsageOptimization,
  createSessionSettings,
  getModelOverrideForUsageOptimization,
  getUsageOptimizationFromModelOverride,
} from '@/lib/types'
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  Loader2,
  MessagesSquare,
  Settings2,
  Trash2,
  UserRound,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { INTELLIGENCE_LEVEL_OPTIONS } from '@/lib/config'
import { ModeIcon, getModeAccentClass } from '@/lib/mode-utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckIcon } from '@/components/icons'
import { ASSISTANT_ROLES } from './composer-controls'
import {
  getMaxTokensQuantity,
  getTemperatureQuantity,
  getTopPQuantity,
} from '@/lib/utils/session-display'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ProjectBehaviorOption {
  id: DefaultProjectBehavior
  label: string
  hint: string
}

const PROJECT_BEHAVIOR_OPTIONS: ProjectBehaviorOption[] = [
  {
    id: 'last_used',
    label: 'The last project I used',
    hint: 'Reopens in the project you were last working in.',
  },
  {
    id: 'inbox',
    label: 'Inbox',
    hint: 'New chats always start in the general Inbox project.',
  },
]

const RESPONSE_STYLE_OPTIONS = [
  { id: 'concise', label: 'Short' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'detailed', label: 'Detailed' },
] as const

const PURGE_COUNT_LABELS: Array<{ key: keyof UserPurgeCounts; label: string }> = [
  { key: 'conversations', label: 'Conversations' },
  { key: 'projects', label: 'Projects' },
  { key: 'files', label: 'Files' },
  { key: 'generatedImages', label: 'Generated images' },
  { key: 'artifacts', label: 'Artifacts' },
  { key: 'prompts', label: 'Prompts' },
  { key: 'playbooks', label: 'Playbooks/runs' },
  { key: 'customAssistants', label: 'Custom assistants' },
  { key: 'modelComparisons', label: 'Model Duel records' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'usageAndPlanData', label: 'Usage/plan data' },
  { key: 'telemetry', label: 'Telemetry' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'objectRefs', label: 'Storage objects' },
]

function UserDeletionDangerZone() {
  const [scope, setScope] = useState<UserPurgeScope>('workspace_data')
  const [preview, setPreview] = useState<UserPurgePreview | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'deleting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UserPurgeResult | null>(null)

  const resetForScope = (nextScope: UserPurgeScope) => {
    setScope(nextScope)
    setPreview(null)
    setConfirmation('')
    setError(null)
    setResult(null)
    setStatus('idle')
  }

  const loadPreview = async () => {
    setStatus('loading')
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/account/delete-data/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        preview?: UserPurgePreview
        error?: string
      }
      if (!response.ok || !body.preview) {
        throw new Error(body.error ?? 'Unable to preview deletion.')
      }
      setPreview(body.preview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview deletion.')
    } finally {
      setStatus('idle')
    }
  }

  const runDeletion = async () => {
    setStatus('deleting')
    setError(null)
    try {
      const response = await fetch('/api/account/delete-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, confirmation }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        result?: UserPurgeResult
        redirectTo?: string | null
        error?: string
      }
      if (!response.ok || !body.result) {
        throw new Error(body.error ?? 'Unable to delete data.')
      }
      setResult(body.result)
      setStatus('done')
      if (body.redirectTo) {
        window.location.href = body.redirectTo
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete data.')
      setStatus('idle')
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h3 className="text-base font-semibold text-foreground">Delete your data</h3>
          </div>
          <p className="mt-1 text-xs leading-6 text-muted-foreground sm:text-sm">
            See exactly what will be removed before anything is deleted. Deleting cannot be undone.
          </p>
        </div>
        <Badge variant="destructive" className="w-fit rounded-full">
          Irreversible
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          <Label>Deletion scope</Label>
          <Select
            value={scope}
            onValueChange={(value) => resetForScope(value as UserPurgeScope)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspace_data">Delete workspace data</SelectItem>
              <SelectItem value="full_account">Delete full account</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="self-end text-xs leading-6 text-muted-foreground">
          {scope === 'workspace_data'
            ? 'Keeps your sign-in account, current plan, and role, but removes workspace data and usage history.'
            : 'Removes credentials, sessions, integrations, workspace data, and personal identifiers, then signs you out.'}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        disabled={status === 'loading' || status === 'deleting'}
        onClick={() => void loadPreview()}
      >
        {status === 'loading' ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 size-4" />
        )}
        Preview deletion
      </Button>

      {preview ? (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/45 p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PURGE_COUNT_LABELS.map(({ key, label }) => (
              <div
                key={key}
                className="rounded-xl border border-border/60 bg-card/40 px-3 py-2"
              >
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {preview.counts[key].toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              Type{' '}
              <span className="font-mono text-foreground">
                {preview.requiresConfirmation}
              </span>{' '}
              to confirm
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="rounded-xl"
              autoComplete="off"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            disabled={
              status === 'deleting' ||
              confirmation.trim() !== preview.requiresConfirmation
            }
            onClick={() => void runDeletion()}
          >
            {status === 'deleting' ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 size-4" />
            )}
            {scope === 'full_account' ? 'Delete account' : 'Delete workspace data'}
          </Button>
        </div>
      ) : null}

      {result ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          Deletion completed. Object cleanup: {result.objectDeletion.deleted}/
          {result.objectDeletion.attempted} removed
          {result.partialFailure ? ', with some storage cleanup failures.' : '.'}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

type SettingsSection = 'general' | 'chats' | 'suggestions' | 'memory' | 'account'

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string; icon: ReactNode }> = [
  { id: 'general', label: 'General', icon: <Settings2 className="size-4" /> },
  { id: 'chats', label: 'Chats', icon: <MessagesSquare className="size-4" /> },
  { id: 'suggestions', label: 'Suggestions', icon: <Wand2 className="size-4" /> },
  { id: 'memory', label: 'Memory', icon: <Brain className="size-4" /> },
  { id: 'account', label: 'Account & data', icon: <UserRound className="size-4" /> },
]

// One labelled row: text on the left, the control on the right (stacked on
// phones). Every setting uses this so the page scans as a single list.
function SettingRow({
  title,
  description,
  htmlFor,
  children,
  stacked = false,
}: {
  title: string
  description?: string
  htmlFor?: string
  children: ReactNode
  stacked?: boolean
}) {
  return (
    <div
      className={cn(
        'flex gap-3 border-b border-border/60 py-4 last:border-b-0',
        stacked ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6'
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {title}
        </Label>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className={cn('shrink-0', stacked && 'w-full')}>{children}</div>
    </div>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ id: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-xl border border-border/70 bg-background/60 p-1"
    >
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              selected
                ? 'bg-secondary text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-2">
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { appSettings, saveAppSettings, openOnboarding, openWorkspaceTool } =
    useChatContext()
  const [localSettings, setLocalSettings] = useState<AppSettings>(appSettings)
  const [section, setSection] = useState<SettingsSection>('general')
  const [isSaving, setIsSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (open) {
      setLocalSettings(appSettings)
    }
  }, [appSettings, open])

  const isDirty = JSON.stringify(localSettings) !== JSON.stringify(appSettings)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const next = await saveAppSettings(localSettings)
      setLocalSettings(next)
      toast.success('Settings saved')
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : 'Could not save your settings. Please try again.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const updateSessionDefaults = (patch: Partial<AppSettings['sessionDefaults']>) =>
    setLocalSettings((previous) => ({
      ...previous,
      sessionDefaults: { ...previous.sessionDefaults, ...patch },
    }))

  const updateRecommendations = (
    patch: Partial<AppSettings['assistantRecommendations']>
  ) =>
    setLocalSettings((previous) => ({
      ...previous,
      assistantRecommendations: { ...previous.assistantRecommendations, ...patch },
    }))

  const currentUsageOptimization = getUsageOptimizationFromModelOverride(
    localSettings.sessionDefaults.modelOverride
  )
  const recommendationsOn = localSettings.assistantRecommendations.enabled

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(720px,92vh)] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-[24px] border border-border/70 bg-background p-0 shadow-2xl shadow-black/40 sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b border-border/70 px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-lg">Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Defaults for new chats, suggestions, memory and your account.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={section}
          onValueChange={(value) => setSection(value as SettingsSection)}
          orientation="vertical"
          className="min-h-0 flex-1 gap-0 md:flex-row"
        >
          <TabsList className="h-auto w-full shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-border/70 bg-transparent px-3 py-2 [scrollbar-width:none] md:w-52 md:flex-col md:items-stretch md:overflow-visible md:border-b-0 md:border-r md:px-3 md:py-4">
            {SETTINGS_SECTIONS.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="h-9 flex-none justify-start gap-2.5 rounded-lg px-3 text-muted-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-secondary"
              >
                {item.icon}
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
            <TabsContent value="general" className="mt-0">
              <SectionHeading
                title="General"
                description="How new chats start."
              />
              <SettingRow
                title="Default assistant"
                description="Used when you start a new chat."
                stacked
              >
                <div role="radiogroup" aria-label="Default assistant" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {MODE_ORDER.map((mode) => {
                    const selected = localSettings.defaultMode === mode
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          setLocalSettings((previous) => ({
                            ...previous,
                            defaultMode: mode,
                            sessionDefaults: createSessionSettings(mode, previous.sessionDefaults),
                          }))
                        }
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          selected
                            ? 'border-foreground/30 bg-secondary'
                            : 'border-border/70 hover:border-border hover:bg-card'
                        )}
                      >
                        <span className={cn('inline-flex', getModeAccentClass(mode, 'text'))}>
                          <ModeIcon mode={mode} size="sm" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {MODE_CONFIGS[mode].name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {ASSISTANT_ROLES[mode]}
                          </span>
                        </span>
                        {selected ? <CheckIcon className="size-4 shrink-0 text-foreground" /> : null}
                      </button>
                    )
                  })}
                </div>
              </SettingRow>
              <SettingRow
                title="Response length"
                description="How much detail replies include by default."
              >
                <Segmented
                  label="Response length"
                  value={localSettings.responseStyle}
                  options={RESPONSE_STYLE_OPTIONS}
                  onChange={(responseStyle) =>
                    setLocalSettings((previous) => ({ ...previous, responseStyle }))
                  }
                />
              </SettingRow>
              <SettingRow
                title="Start new chats in"
                description="Which project a new chat is saved to."
              >
                <Select
                  value={localSettings.defaultProjectBehavior}
                  onValueChange={(value) =>
                    setLocalSettings((previous) => ({
                      ...previous,
                      defaultProjectBehavior: value as DefaultProjectBehavior,
                    }))
                  }
                >
                  <SelectTrigger className="w-full rounded-xl sm:w-56" aria-label="Start new chats in">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_BEHAVIOR_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            </TabsContent>

            <TabsContent value="chats" className="mt-0">
              <SectionHeading
                title="Chats"
                description="Defaults for new chats. You can change any of these inside a chat."
              />
              <SettingRow
                title="Intelligence"
                description={
                  INTELLIGENCE_LEVEL_OPTIONS.find((option) => option.id === currentUsageOptimization)
                    ?.hint
                }
                stacked
              >
                <Segmented
                  label="Default intelligence"
                  value={currentUsageOptimization}
                  options={INTELLIGENCE_LEVEL_OPTIONS}
                  onChange={(usageOptimization: UsageOptimization) =>
                    setLocalSettings((previous) => ({
                      ...previous,
                      usageOptimization,
                      sessionDefaults: {
                        ...previous.sessionDefaults,
                        modelOverride: getModelOverrideForUsageOptimization(usageOptimization),
                      },
                    }))
                  }
                />
              </SettingRow>
              <SettingRow
                title="Search the web"
                description="Look up current information when it helps. Pulse always searches."
                htmlFor="default-web-search"
              >
                <Switch
                  id="default-web-search"
                  checked={localSettings.sessionDefaults.webSearch}
                  onCheckedChange={(webSearch) => updateSessionDefaults({ webSearch })}
                />
              </SettingRow>
              <SettingRow
                title="Use project files"
                description="Let replies draw on files you uploaded to the project."
                htmlFor="default-file-context"
              >
                <Switch
                  id="default-file-context"
                  checked={localSettings.sessionDefaults.fileContext}
                  onCheckedChange={(fileContext) => updateSessionDefaults({ fileContext })}
                />
              </SettingRow>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="mt-4">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-border/70 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-card"
                  >
                    <span>
                      Advanced
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        Tone preset and model sampling. Most people never need these.
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform',
                        showAdvanced && 'rotate-180'
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-1">
                  <SettingRow
                    title="Tone preset"
                    description={
                      SYSTEM_PRESET_CONFIGS[localSettings.sessionDefaults.systemPreset].description
                    }
                    htmlFor="defaultSystemPreset"
                  >
                    <Select
                      value={localSettings.sessionDefaults.systemPreset}
                      onValueChange={(value) =>
                        updateSessionDefaults({
                          systemPreset: value as AppSettings['sessionDefaults']['systemPreset'],
                        })
                      }
                    >
                      <SelectTrigger id="defaultSystemPreset" className="w-full rounded-xl sm:w-56">
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
                  </SettingRow>
                  <SliderRow
                    id="defaultTemperature"
                    title="Temperature"
                    description="Higher is more creative, lower is more precise."
                    valueLabel={getTemperatureQuantity(localSettings.sessionDefaults.temperature)}
                    min={0}
                    max={2}
                    step={0.05}
                    value={localSettings.sessionDefaults.temperature}
                    onChange={(temperature) => updateSessionDefaults({ temperature })}
                  />
                  <SliderRow
                    id="defaultMaxTokens"
                    title="Max reply length"
                    description="The longest a single reply can be."
                    valueLabel={getMaxTokensQuantity(localSettings.sessionDefaults.maxTokens)}
                    min={256}
                    max={4096}
                    step={256}
                    value={localSettings.sessionDefaults.maxTokens}
                    onChange={(maxTokens) => updateSessionDefaults({ maxTokens })}
                  />
                  <SliderRow
                    id="defaultTopP"
                    title="Top P"
                    description="How widely the model samples words."
                    valueLabel={getTopPQuantity(localSettings.sessionDefaults.topP)}
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={localSettings.sessionDefaults.topP}
                    onChange={(topP) => updateSessionDefaults({ topP })}
                  />
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>

            <TabsContent value="suggestions" className="mt-0">
              <SectionHeading
                title="Suggestions"
                description="Zenquanta can suggest a better assistant when your message fits another one."
              />
              <SettingRow
                title="Suggest a better assistant"
                description="Show a suggestion when another assistant is a clearly better fit."
                htmlFor="recommendations-enabled"
              >
                <Switch
                  id="recommendations-enabled"
                  checked={recommendationsOn}
                  onCheckedChange={(enabled) => updateRecommendations({ enabled })}
                />
              </SettingRow>
              <SettingRow
                title="Switch automatically when it is obvious"
                description="Skip the suggestion and switch when the match is very clear."
                htmlFor="recommendations-auto"
              >
                <Switch
                  id="recommendations-auto"
                  checked={recommendationsOn && localSettings.assistantRecommendations.autoSwitchOnHighConfidence}
                  disabled={!recommendationsOn}
                  onCheckedChange={(autoSwitchOnHighConfidence) =>
                    updateRecommendations({ autoSwitchOnHighConfidence })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Learn from my choices"
                description="Tune suggestions using only your own feedback and picks."
                htmlFor="recommendations-personalized"
              >
                <Switch
                  id="recommendations-personalized"
                  checked={recommendationsOn && localSettings.assistantRecommendations.personalized}
                  disabled={!recommendationsOn}
                  onCheckedChange={(personalized) => updateRecommendations({ personalized })}
                />
              </SettingRow>
            </TabsContent>

            <TabsContent value="memory" className="mt-0">
              <SectionHeading
                title="Memory"
                description="What Zenquanta remembers between messages."
              />
              <SettingRow
                title="Remember context in new chats"
                description="Keep a running summary so long chats stay on track."
                htmlFor="default-memory"
              >
                <Switch
                  id="default-memory"
                  checked={localSettings.sessionDefaults.memory}
                  onCheckedChange={(memory) => updateSessionDefaults({ memory })}
                />
              </SettingRow>
              <SettingRow
                title="Memory Vault"
                description="See what has been saved, and turn memory off or clear it for any chat."
              >
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    onOpenChange(false)
                    openWorkspaceTool('memory-vault')
                  }}
                >
                  Open Memory Vault
                </Button>
              </SettingRow>
            </TabsContent>

            <TabsContent value="account" className="mt-0 space-y-6">
              <div>
                <SectionHeading
                  title="Account & data"
                  description="Set up your workspace again, or delete your data."
                />
                <SettingRow
                  title="Workspace setup"
                  description="Pick your starter assistant, prompts and first project again."
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      onOpenChange(false)
                      openOnboarding()
                    }}
                  >
                    Run setup again
                  </Button>
                </SettingRow>
              </div>
              <UserDeletionDangerZone />
            </TabsContent>
          </div>
        </Tabs>

        {section !== 'account' ? (
          <div className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-3 sm:px-6">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {isDirty ? 'You have unsaved changes.' : 'Changes apply to new chats.'}
            </p>
            <div className="flex items-center gap-2">
              {isDirty ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSaving}
                  onClick={() => setLocalSettings(appSettings)}
                >
                  Discard
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={!isDirty || isSaving}
                onClick={() => void handleSave()}
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SliderRow({
  id,
  title,
  description,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
}: {
  id: string
  title: string
  description: string
  valueLabel: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <SettingRow title={title} description={description} htmlFor={id}>
      <div className="flex w-full items-center gap-3 sm:w-64">
        <Slider
          id={id}
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={([next]) => onChange(next)}
        />
        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {valueLabel}
        </span>
      </div>
    </SettingRow>
  )
}
