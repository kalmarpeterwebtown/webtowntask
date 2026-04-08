import { HttpsError } from 'firebase-functions/v2/https'
import type { PlatformAuditAction, PlatformAuditLogEntry } from './contracts.js'

type CallableAuth = {
  uid: string
  token?: {
    email?: string
    platformRole?: string
  }
}

export function requireSuperAdmin(auth?: CallableAuth | null) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Bejelentkezés szükséges.')
  }

  if (auth.token?.platformRole !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Ehhez super admin jogosultság szükséges.')
  }

  return {
    actorUid: auth.uid,
    actorEmail: auth.token?.email ?? '',
  }
}

export function requireNonEmptyString(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `A(z) ${fieldName} mező kötelező.`)
  }

  return value.trim()
}

export function normalizeEmail(email: unknown) {
  return requireNonEmptyString(email, 'email').toLowerCase()
}

export function createAuditLogEntry(input: {
  action: PlatformAuditAction
  actorUid: string
  actorEmail: string
  targetType: 'user' | 'organization'
  targetId: string
  metadata?: Record<string, unknown>
  targetEmail?: string
  orgId?: string
}): PlatformAuditLogEntry {
  return {
    action: input.action,
    actorUid: input.actorUid,
    actorEmail: input.actorEmail,
    targetType: input.targetType,
    targetId: input.targetId,
    targetEmail: input.targetEmail,
    orgId: input.orgId,
    metadata: input.metadata ?? {},
  }
}
