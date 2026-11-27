import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  approvalTimeLeftMs,
  effectiveApprovalStatus,
  formatTimeLeft,
  shouldPollApprovals,
} from '@/lib/cli/approvals'
import {
  isApprovalId,
  parseApprovalClose,
  parseApprovalDecision,
  parseApprovalInput,
} from '@/lib/cli/approval-requests'
import { isCrossSiteRequest } from '@/lib/security/same-origin'

vi.mock('server-only', () => ({}))

describe('approval status', () => {
  const now = Date.parse('2026-11-28T10:05:00.000Z')

  it('reads a pending approval past its expiry as expired, never approved', () => {
    expect(effectiveApprovalStatus({ status: 'pending', expiresAt: new Date('2026-11-28T10:04:59.000Z') }, now)).toBe('expired')
    expect(effectiveApprovalStatus({ status: 'pending', expiresAt: new Date('2026-11-28T10:06:00.000Z') }, now)).toBe('pending')
    expect(effectiveApprovalStatus({ status: 'approved', expiresAt: new Date('2026-11-28T10:00:00.000Z') }, now)).toBe('approved')
  })

  it('counts time left on the server clock', () => {
    // The browser runs 30 s behind the server.
    expect(approvalTimeLeftMs('2026-11-28T10:06:00.000Z', 30_000, now)).toBe(30_000)
    expect(approvalTimeLeftMs('2026-11-28T10:04:00.000Z', 0, now)).toBe(0)
    expect(formatTimeLeft(0)).toBe('Expired')
    expect(formatTimeLeft(42_100)).toBe('43 s left')
    expect(formatTimeLeft(9 * 60_000 + 1)).toBe('10 min left')
  })

  it('polls only while visible and zq was active or something waits', () => {
    const base = { enabled: true, visible: true, pendingCount: 0, latestActivityAt: now - 60_000, now }
    expect(shouldPollApprovals(base)).toBe(true)
    expect(shouldPollApprovals({ ...base, visible: false })).toBe(false)
    expect(shouldPollApprovals({ ...base, enabled: false })).toBe(false)
    expect(shouldPollApprovals({ ...base, latestActivityAt: now - 11 * 60_000 })).toBe(false)
    expect(shouldPollApprovals({ ...base, latestActivityAt: null })).toBe(false)
    expect(shouldPollApprovals({ ...base, latestActivityAt: null, pendingCount: 1 })).toBe(true)
  })
})

describe('approval requests', () => {
  it('keeps the detail exactly as sent', () => {
    expect(
      parseApprovalInput({ sessionId: 's-1', tool: 'bash', title: ' Run this command? ', detail: '  ls -la\n' })
    ).toEqual({ sessionId: 's-1', tool: 'bash', title: 'Run this command?', detail: '  ls -la\n' })
    expect(parseApprovalInput(null)).toBeNull()
    expect(parseApprovalInput({ sessionId: 's-1', tool: 'bash', title: 'x', detail: 'y'.repeat(4_001) })).toBeNull()
  })

  it('accepts only uuids, closes and once-only decisions', () => {
    expect(isApprovalId('6f1c2a54-3b1e-4c47-9a2e-0d5c8e7f9a10')).toBe(true)
    expect(isApprovalId("1' or '1'='1")).toBe(false)
    expect(parseApprovalClose({ status: 'expired' })).toBe('expired')
    expect(parseApprovalClose({ status: 'approved' })).toBeNull()
    expect(parseApprovalDecision({ decision: 'deny' })).toBe('deny')
    expect(parseApprovalDecision({ decision: 'always' })).toBeNull()
  })
})

describe('same-origin check', () => {
  const at = (headers: Record<string, string>) =>
    new NextRequest('http://localhost/api/approvals/x/decide', { method: 'POST', headers })

  it('lets same-origin and header-less requests through', () => {
    expect(isCrossSiteRequest(at({}))).toBe(false)
    expect(isCrossSiteRequest(at({ origin: 'http://localhost', 'sec-fetch-site': 'same-origin' }))).toBe(false)
  })

  it('refuses other sites', () => {
    expect(isCrossSiteRequest(at({ 'sec-fetch-site': 'cross-site' }))).toBe(true)
    expect(isCrossSiteRequest(at({ 'sec-fetch-site': 'same-site' }))).toBe(true)
    expect(isCrossSiteRequest(at({ origin: 'https://evil.example' }))).toBe(true)
    expect(isCrossSiteRequest(at({ origin: 'null' }))).toBe(true)
  })
})
