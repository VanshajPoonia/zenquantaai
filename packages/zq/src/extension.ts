import { randomUUID } from 'node:crypto'
import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent'
import { apiFetch, type MeResponse } from './api.js'
import { getAppUrl, readCredentials, readSettings, setProjectSync, updateGlobalSettings, type PermissionMode } from './config.js'
import { decide } from './permissions.js'
import { SessionSync } from './sync.js'

export interface ZenquantaExtensionOptions {
  yolo: boolean
  allowEdits: boolean
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
    const me = await apiFetch<MeResponse>('/api/cli/me').catch(() => null)
    const contextWindow = me?.maxAgentInputTokens ?? FALLBACK_LIMITS.input
    const maxTokens = me?.maxAgentOutputTokens ?? FALLBACK_LIMITS.output

    pi.registerProvider('zenquanta', {
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

    pi.on('session_start', (_event, ctx) => {
      cwd = ctx.cwd
      settings = readSettings(cwd)
      sessionId = ctx.sessionManager.getSessionId()
      sync.start(sessionId)
      if (!ctx.hasUI) return
      ctx.ui.notify(
        me
          ? `Zenquanta Forge. ${usageLine(me)}. Permissions: ${mode()}. Sync: ${settings.sync ? 'on' : 'off'}.`
          : 'Zenquanta Forge. Could not reach Zenquanta, check your connection or run `zq login`.',
        me ? 'info' : 'warning'
      )
      if (me && !me.cliAccess) ctx.ui.notify('zq is not included in your plan. Request an upgrade at /pricing.', 'warning')
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
      const decision = decide({
        toolName: event.toolName,
        args: (event.input ?? {}) as Record<string, unknown>,
        mode: mode(),
        allowedCommands: settings.allowedCommands,
        cwd,
        hasUI: ctx.hasUI,
      })
      if (decision.action === 'allow') return undefined
      if (decision.action === 'block') return { block: true, reason: decision.reason }

      const always = decision.rememberAs ? `Yes, always allow "${decision.rememberAs}"` : null
      const choice = await ctx.ui.select(`${decision.title}\n${decision.detail}`, ['Yes', ...(always ? [always] : []), 'No'])
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
        ctx.ui.notify(`Mode: ${mode()}. Always allowed: ${allowed}. Set "permissionMode" to ask, edits or yolo in ~/.zq/settings.json.`, 'info')
      },
    })
  }
}
