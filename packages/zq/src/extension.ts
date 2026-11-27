import { randomUUID } from 'node:crypto'
import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent'
import { ApiError, apiFetch, type MeResponse } from './api.js'
import { getAppUrl, readCredentials, readSettings, setProjectSync, updateGlobalSettings, type PermissionMode } from './config.js'
import { gitConfigCanRunPrograms } from './git-safety.js'
import { decide } from './permissions.js'
import { fitsRemoteApproval, httpApprovalClient, raceApproval, type ApprovalOutcome } from './remote-approvals.js'
import { SessionSync } from './sync.js'

export type ModelSource = 'zenquanta' | 'openrouter'

export interface ZenquantaExtensionOptions {
  yolo: boolean
  allowEdits: boolean
  modelSource: ModelSource
  me: MeResponse | null
}

const FALLBACK_LIMITS = { input: 32_000, output: 4_000 }

function formatTokens(value: number): string {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${Math.round(value / 1_000)}k` : String(value)
}

function usageLine(me: MeResponse): string {
  const wallet = me.tierTokens.included > 0 ? me.tierTokens : me.coreTokens
  return `${me.loginId ?? 'zq'} on ${me.plan}: ${formatTokens(wallet.left)} tokens left, ${me.agentSteps.left} of ${me.agentSteps.included} agent steps left today`
}

export function createZenquantaExtension(options: ZenquantaExtensionOptions): ExtensionFactory {
  return async (pi: ExtensionAPI) => {
    const credentials = readCredentials()
    const me = options.me
    const contextWindow = me?.maxAgentInputTokens ?? FALLBACK_LIMITS.input
    const maxTokens = me?.maxAgentOutputTokens ?? FALLBACK_LIMITS.output

    if (options.modelSource === 'zenquanta') pi.registerProvider('zenquanta', {
      name: 'Zenquanta',
      baseUrl: `${getAppUrl()}/api/v1`,
      apiKey: credentials?.token ?? '',
      api: 'openai-completions',
      models: (me?.models.length ? me.models : ['forge']).map((id) => ({
        type: 'chat' as const,
        id,
        name: id === 'forge' ? 'Forge' : id,
        reasoning: false,
        input: ['text' as const],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow,
        maxTokens,
      })),
    })

    let sessionId = 'unknown'
    let runId = randomUUID()
    let cwd = process.cwd()
    let settings = readSettings(cwd)
    const mode = (): PermissionMode =>
      options.yolo ? 'yolo' : options.allowEdits && settings.permissionMode === 'ask' ? 'edits' : settings.permissionMode
    const sync = new SessionSync(cwd, () => settings.sync)
    let warnedRemote = false

    pi.on('session_start', (_event, ctx) => {
      cwd = ctx.cwd
      settings = readSettings(cwd)
      sessionId = ctx.sessionManager.getSessionId()
      warnedRemote = false
      sync.start(sessionId)
      if (!ctx.hasUI) return
      ctx.ui.notify(
        me
          ? options.modelSource === 'openrouter'
            ? `Zenquanta Forge on your own OpenRouter key. Permissions: ${mode()}. Sync: ${settings.sync ? 'on' : 'off'}.`
            : `Zenquanta Forge. ${usageLine(me)}. Permissions: ${mode()}. Sync: ${settings.sync ? 'on' : 'off'}.`
          : 'Zenquanta Forge. Could not reach Zenquanta, check your connection or run `zq login`.',
        me ? 'info' : 'warning'
      )
      if (me && !me.cliAccess) ctx.ui.notify('zq is not included in your plan. Request an upgrade at /pricing.', 'warning')
      if (settings.remoteApprovals) ctx.ui.notify('Web approvals are on. Prompts also show in the Zenquanta web app.', 'info')
    })

    pi.on('before_agent_start', () => {
      runId = randomUUID()
    })

    pi.on('before_provider_headers', (event, ctx) => {
      if (ctx.model?.provider !== 'zenquanta') return
      event.headers['x-zq-session-id'] = sessionId
      event.headers['x-zq-run-id'] = runId
    })

    pi.on('tool_call', async (event, ctx) => {
      const args = (event.input ?? {}) as Record<string, unknown>
      const isGitCommand = event.toolName === 'bash' && typeof args.command === 'string' && /^\s*git\s/.test(args.command)
      const decision = decide({
        toolName: event.toolName,
        args,
        mode: mode(),
        allowedCommands: settings.allowedCommands,
        cwd,
        hasUI: ctx.hasUI,
        gitConfigRisky: isGitCommand ? gitConfigCanRunPrograms(cwd) : false,
      })
      if (decision.action === 'allow') {
        // pi runs the input as mutated here, so an auto-allowed git read runs hardened.
        if (decision.command && event.toolName === 'bash') args.command = decision.command
        return undefined
      }
      if (decision.action === 'block') return { block: true, reason: decision.reason }

      const always = decision.rememberAs ? `Yes, always allow "${decision.rememberAs}"` : null
      const prompt = `${decision.title}\n${decision.detail}`
      const choices = ['Yes', ...(always ? [always] : []), 'No']
      const request = { sessionId, tool: event.toolName, title: decision.title, detail: decision.detail }
      const outcome: ApprovalOutcome =
        settings.remoteApprovals && settings.sync && sessionId !== 'unknown' && fitsRemoteApproval(request)
          ? await raceApproval({
              request,
              askLocal: (signal) => ctx.ui.select(prompt, choices, { signal }),
              client: {
                ...httpApprovalClient,
                // The web shows the card inside the synced session, so send the latest turn first.
                create: (input) => {
                  void sync.flush()
                  return httpApprovalClient.create(input)
                },
              },
              signal: ctx.signal,
              onRemoteUnavailable: (error) => {
                if (warnedRemote) return
                warnedRemote = true
                ctx.ui.notify(
                  error instanceof ApiError && error.status === 404
                    ? 'Web approvals are not open on Zenquanta yet. Answer here.'
                    : 'Could not reach Zenquanta for web approvals. Answer here.',
                  'warning'
                )
              },
            })
          : { source: 'local', choice: await ctx.ui.select(prompt, choices) }
      if (outcome.source === 'web') {
        ctx.ui.notify(outcome.approved ? 'Approved once from the web.' : 'Denied from the web.', 'info')
        return outcome.approved ? undefined : { block: true, reason: 'The user declined this action from the web.' }
      }
      const choice = outcome.choice
      if (choice === 'Yes') return undefined
      if (always && choice === always && decision.rememberAs) {
        settings.allowedCommands = [...settings.allowedCommands, decision.rememberAs]
        updateGlobalSettings({ allowedCommands: settings.allowedCommands })
        return undefined
      }
      return { block: true, reason: 'The user declined this action.' }
    })

    pi.on('message_end', (event) => {
      sync.record(event.message as Parameters<SessionSync['record']>[0])
    })
    pi.on('agent_settled', () => sync.flush())
    pi.on('session_shutdown', () => sync.flush())

    pi.registerCommand('usage', {
      description: 'Show your Zenquanta plan and what is left today',
      handler: async (_args, ctx) => {
        const current = await apiFetch<MeResponse>('/api/cli/me').catch((error: Error) => error)
        ctx.ui.notify(current instanceof Error ? current.message : usageLine(current), 'info')
      },
    })

    pi.registerCommand('sync', {
      description: 'Turn session sync to the Zenquanta web app on or off for this project',
      handler: async (args, ctx) => {
        const value = args.trim().toLowerCase()
        if (value !== 'on' && value !== 'off') {
          ctx.ui.notify(`Sync is ${settings.sync ? 'on' : 'off'}. Use /sync on or /sync off.`, 'info')
          return
        }
        setProjectSync(cwd, value === 'on')
        settings = readSettings(cwd)
        ctx.ui.notify(`Sync ${settings.sync ? 'on' : 'off'} for this project.`, 'info')
      },
    })

    pi.registerCommand('permissions', {
      description: 'Show the permission mode and always-allowed commands',
      handler: async (_args, ctx) => {
        const allowed = settings.allowedCommands.length ? settings.allowedCommands.join(', ') : 'none'
        ctx.ui.notify(
          `Mode: ${mode()}. Always allowed: ${allowed}. Web approvals: ${settings.remoteApprovals ? 'on' : 'off'}. Set "permissionMode" to ask, edits or yolo in ~/.zq/settings.json.`,
          'info'
        )
      },
    })

    pi.registerCommand('remote', {
      description: 'Also answer permission prompts from the Zenquanta web app',
      handler: async (args, ctx) => {
        const value = args.trim().toLowerCase()
        if (value !== 'on' && value !== 'off') {
          ctx.ui.notify(`Web approvals are ${settings.remoteApprovals ? 'on' : 'off'}. Use /remote on or /remote off.`, 'info')
          return
        }
        updateGlobalSettings({ remoteApprovals: value === 'on' })
        settings = readSettings(cwd)
        warnedRemote = false
        ctx.ui.notify(
          settings.remoteApprovals
            ? `Web approvals on. Each prompt also shows in the web app for 10 minutes. The web can approve once or deny, never always allow.${settings.sync ? '' : ' Turn /sync on so the web can show them.'}`
            : 'Web approvals off. Prompts only show here.',
          'info'
        )
      },
    })
  }
}
