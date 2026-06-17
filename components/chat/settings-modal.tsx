'use client'

import { useEffect, useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import {
  AIMode,
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
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface UsageOptimizationOption {
  id: UsageOptimization
  label: string
  hint: string
}

const USAGE_OPTIMIZATION_OPTIONS: UsageOptimizationOption[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    hint: 'Auto-tuned for each assistant mode.',
  },
  {
    id: 'fast',
    label: 'Fast',
    hint: 'Quicker responses, efficient model.',
  },
  {
    id: 'best_quality',
    label: 'Best Quality',
    hint: 'Premium output from top-tier models.',
  },
  {
    id: 'lowest_usage',
    label: 'Lowest Usage',
    hint: 'Conserves credits, efficient processing.',
  },
]

interface ProjectBehaviorOption {
  id: DefaultProjectBehavior
  label: string
  hint: string
}

const PROJECT_BEHAVIOR_OPTIONS: ProjectBehaviorOption[] = [
  {
    id: 'last_used',
    label: 'Remember last project',
    hint: 'Reopens in the project you were last working in.',
  },
  {
    id: 'inbox',
    label: 'Always start in Inbox',
    hint: 'New sessions always open in the general Inbox project.',
  },
]

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

function UsageOptimizationCard({
  option,
  active,
  onClick,
}: {
  option: UsageOptimizationOption
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-2xl border p-4 text-left transition-all duration-200 ${
        active
          ? 'border-primary bg-primary/10 shadow-lg shadow-black/10'
          : 'border-border/70 bg-card/70 hover:-translate-y-0.5 hover:border-border hover:bg-card'
      }`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className={`text-sm font-semibold ${active ? 'text-foreground' : 'text-foreground'}`}>
            {option.label}
          </p>
          {active && (
            <div className="flex size-5 items-center justify-center rounded-full bg-primary">
              <CheckIcon className="size-3 text-primary-foreground" />
            </div>
          )}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{option.hint}</p>
      </div>
    </button>
  )
}

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
            <h3 className="text-base font-semibold text-foreground">Danger Zone</h3>
          </div>
          <p className="mt-1 text-xs leading-6 text-muted-foreground sm:text-sm">
            Preview and delete your Zenquanta data. This action is irreversible.
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

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { appSettings, saveAppSettings, openOnboarding, openWorkspaceTool } =
    useChatContext()
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

  const currentUsageOptimization = getUsageOptimizationFromModelOverride(
    localSettings.sessionDefaults.modelOverride
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[92vh] max-w-[1240px] overflow-hidden rounded-[24px] border border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40 sm:w-[min(1240px,calc(100vw-2rem))] sm:rounded-[28px]">
        <div className="flex h-full max-h-[92vh] min-h-0 flex-col">
        <DialogHeader className="border-b border-border/70 bg-gradient-to-b from-card/80 to-background px-4 py-5 text-left sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <DialogTitle className="text-xl tracking-tight sm:text-2xl lg:text-[1.9rem]">Preferences</DialogTitle>
          <DialogDescription className="max-w-3xl text-xs leading-6 sm:text-sm sm:leading-6">
            Manage defaults, personalization, memory, and workspace behavior for your Zenquanta AI account.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:gap-6 lg:px-8 lg:py-6">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted/40 p-1.5 sm:max-w-md">
            <TabsTrigger value="general" className="rounded-xl">General</TabsTrigger>
            <TabsTrigger value="about" className="rounded-xl">About</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1 pb-6 sm:space-y-7 sm:pr-2">

            {/* 1. Default Assistant */}
            <div className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold sm:text-lg">Default Assistant</h3>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Applied when you open a fresh chat session.
                  </p>
                </div>
                <Badge variant="secondary">Saved to account</Badge>
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

            {/* 2. Quality & Speed (Usage Optimization) */}
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold sm:text-lg">Quality & Speed</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Default model profile for new sessions. Individual sessions can still be tuned in the session panel.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {USAGE_OPTIMIZATION_OPTIONS.map((opt) => (
                  <UsageOptimizationCard
                    key={opt.id}
                    option={opt}
                    active={currentUsageOptimization === opt.id}
                    onClick={() =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        usageOptimization: opt.id,
                        sessionDefaults: {
                          ...previous.sessionDefaults,
                          modelOverride: getModelOverrideForUsageOptimization(opt.id),
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <Separator />

            {/* 3. Response Style & Appearance */}
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-4 sm:p-5">
                <div>
                  <h3 className="text-base font-semibold">Default Response Style</h3>
                  <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
                    Shapes the overall tone of assistant output in new chats.
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
                  <h3 className="text-base font-semibold">Visual Style</h3>
                  <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
                    Theme and accent preferences for the workspace.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="default" disabled>
                    Dark theme
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

            <Separator />

            {/* 4. Default Project Behavior */}
            <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
              <div>
                <h3 className="text-base font-semibold">Default Project Behavior</h3>
                <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
                  Controls which project new chat sessions start in when you open the workspace.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROJECT_BEHAVIOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        defaultProjectBehavior: opt.id,
                      }))
                    }
                    className={`rounded-xl border p-3 text-left transition-all ${
                      localSettings.defaultProjectBehavior === opt.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border/70 bg-background/50 hover:border-border hover:bg-background'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{opt.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{opt.hint}</p>
                      </div>
                      {localSettings.defaultProjectBehavior === opt.id && (
                        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
                          <CheckIcon className="size-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* 5. Session Feature Defaults */}
            <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
              <h3 className="text-base font-semibold">Session Feature Defaults</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                  <div>
                    <p className="text-xs font-medium sm:text-sm">Web Search</p>
                    <p className="text-[11px] text-muted-foreground">Fetch live context via Pulse</p>
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
                    <p className="text-[11px] text-muted-foreground">Carry conversation context forward</p>
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

            <Separator />

            {/* 6. Assistant Intelligence */}
            <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
              <div>
                <h3 className="text-base font-semibold">Assistant Intelligence</h3>
                <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
                  Controls how the Smart Router suggests and routes prompts to the best-fit assistant.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                  <div>
                    <p className="text-xs font-medium sm:text-sm">
                      Assistant recommendations
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Suggest a better-fit assistant for obvious mismatches.
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.assistantRecommendations.enabled}
                    onCheckedChange={(checked) =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        assistantRecommendations: {
                          ...previous.assistantRecommendations,
                          enabled: checked,
                        },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                  <div>
                    <p className="text-xs font-medium sm:text-sm">
                      Auto-switch on high confidence
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Route the prompt automatically when the match is clear.
                    </p>
                  </div>
                  <Switch
                    checked={
                      localSettings.assistantRecommendations.autoSwitchOnHighConfidence
                    }
                    disabled={!localSettings.assistantRecommendations.enabled}
                    onCheckedChange={(checked) =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        assistantRecommendations: {
                          ...previous.assistantRecommendations,
                          autoSwitchOnHighConfidence: checked,
                        },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                  <div>
                    <p className="text-xs font-medium sm:text-sm">
                      Personalized recommendations
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Fine-tune suggestions using only your own feedback and choices.
                    </p>
                  </div>
                  <Switch
                    checked={
                      localSettings.assistantRecommendations.enabled &&
                      localSettings.assistantRecommendations.personalized
                    }
                    disabled={!localSettings.assistantRecommendations.enabled}
                    onCheckedChange={(checked) =>
                      setLocalSettings((previous) => ({
                        ...previous,
                        assistantRecommendations: {
                          ...previous.assistantRecommendations,
                          personalized: checked,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* 7. Advanced Session Defaults */}
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold sm:text-lg">Advanced Session Defaults</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Fine-tune model behavior for new sessions. Per-session overrides still apply.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
                <div>
                  <Label htmlFor="defaultSystemPreset">System Preset</Label>
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

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="defaultTemperature">Temperature</Label>
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
                    Creativity vs. precision balance for new chats.
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="defaultMaxTokens">Max Tokens</Label>
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
                    Response length ceiling for new chats.
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="defaultTopP">Top P</Label>
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
                    Token sampling breadth for freshly started chats.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* 8. Memory Vault & Workspace links */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold sm:text-lg">Workspace</h3>

              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <h4 className="text-sm font-semibold">Memory Vault</h4>
                  <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
                    Review saved conversation summaries and control memory per chat.
                  </p>
                </div>
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
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <h4 className="text-sm font-semibold">Workspace Setup</h4>
                  <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
                    Reopen onboarding to refresh starter prompts, projects, and the default assistant.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    onOpenChange(false)
                    openOnboarding()
                  }}
                >
                  Reopen onboarding
                </Button>
              </div>
            </div>

            <Separator />

            <UserDeletionDangerZone />
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
              'Save preferences'
            )}
          </Button>
        </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
