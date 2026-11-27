'use client'

import { useCliApprovalsPoller } from '@/hooks/use-cli-approvals'
import { PendingApprovalsNotice } from './terminal-approvals'

/** Workspace-wide hooks for zq on the web and the installed app. Mount once, signed in. */
export function TerminalAndPhone() {
  useCliApprovalsPoller()
  return <PendingApprovalsNotice />
}
