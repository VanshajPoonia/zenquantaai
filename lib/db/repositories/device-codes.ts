import 'server-only'

import { createHash, randomBytes, randomInt } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { getDatabaseClient } from '../client'
import { zenDeviceCodes } from '../schema'

const DEVICE_CODE_TTL_MS = 10 * 60_000
// No 0/O, 1/I/L or 5/S, so codes are easy to read aloud and type.
const USER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789'

export type DeviceCodeStatus = 'pending' | 'approved' | 'denied' | 'used' | 'expired'

export function hashDeviceCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function generateUserCode(): string {
  let code = ''
  for (let index = 0; index < 8; index += 1) {
    code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

export function normalizeUserCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : ''
}

class NeonDeviceCodesRepository {
  async create(clientName: string): Promise<{
    deviceCode: string
    userCode: string
    expiresAt: Date
  }> {
    const deviceCode = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const userCode = generateUserCode()
      const rows = await getDatabaseClient()
        .insert(zenDeviceCodes)
        .values({
          deviceCodeHash: hashDeviceCode(deviceCode),
          userCode,
          clientName: clientName.slice(0, 80) || 'zq',
          expiresAt,
        })
        .onConflictDoNothing()
        .returning({ id: zenDeviceCodes.id })
      if (rows.length) return { deviceCode, userCode, expiresAt }
    }
    throw new Error('Could not create a login code. Please try again.')
  }

  async findPending(userCode: string): Promise<{ clientName: string } | null> {
    const rows = await getDatabaseClient()
      .select({ clientName: zenDeviceCodes.clientName })
      .from(zenDeviceCodes)
      .where(
        and(
          eq(zenDeviceCodes.userCode, userCode),
          eq(zenDeviceCodes.status, 'pending'),
          gt(zenDeviceCodes.expiresAt, new Date())
        )
      )
      .limit(1)
    return rows[0] ?? null
  }

  async decide(input: {
    userCode: string
    userId: string
    approve: boolean
  }): Promise<boolean> {
    const rows = await getDatabaseClient()
      .update(zenDeviceCodes)
      .set({ status: input.approve ? 'approved' : 'denied', userId: input.userId })
      .where(
        and(
          eq(zenDeviceCodes.userCode, input.userCode),
          eq(zenDeviceCodes.status, 'pending'),
          gt(zenDeviceCodes.expiresAt, new Date())
        )
      )
      .returning({ id: zenDeviceCodes.id })
    return rows.length > 0
  }

  /**
   * Reads the code's state for polling. An approved code is claimed exactly
   * once: the update to `used` only succeeds for the first caller.
   */
  async claim(deviceCode: string): Promise<
    | { status: 'approved'; userId: string; clientName: string }
    | { status: Exclude<DeviceCodeStatus, 'approved'> | 'unknown' }
  > {
    const hash = hashDeviceCode(deviceCode)
    const claimed = await getDatabaseClient()
      .update(zenDeviceCodes)
      .set({ status: 'used' })
      .where(
        and(
          eq(zenDeviceCodes.deviceCodeHash, hash),
          eq(zenDeviceCodes.status, 'approved'),
          gt(zenDeviceCodes.expiresAt, new Date())
        )
      )
      .returning({ userId: zenDeviceCodes.userId, clientName: zenDeviceCodes.clientName })
    const row = claimed[0]
    if (row?.userId) return { status: 'approved', userId: row.userId, clientName: row.clientName }

    const rows = await getDatabaseClient()
      .select({ status: zenDeviceCodes.status, expiresAt: zenDeviceCodes.expiresAt })
      .from(zenDeviceCodes)
      .where(eq(zenDeviceCodes.deviceCodeHash, hash))
      .limit(1)
    const current = rows[0]
    if (!current) return { status: 'unknown' }
    if (current.status === 'pending' && current.expiresAt.getTime() <= Date.now()) {
      return { status: 'expired' }
    }
    return { status: current.status as Exclude<DeviceCodeStatus, 'approved'> }
  }
}

export const neonDeviceCodesRepository = new NeonDeviceCodesRepository()
