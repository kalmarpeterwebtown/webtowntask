import { httpsCallable } from 'firebase/functions'
import { functions } from '@/config/firebase'
import {
  PLATFORM_ADMIN_CALLABLES,
  type DeleteAuthUserResult,
  normalizePlatformAdminEmail,
  type DeleteOrganizationResult,
  type PlatformAuditLogEntry,
  type PlatformDeleteAuthUserRequest,
  type PlatformDeleteOrganizationRequest,
  type PlatformDeleteUserFootprintRequest,
  type PlatformDetachUserFromOrganizationRequest,
  type PlatformFindUserFootprintRequest,
  type PlatformListAuditLogsRequest,
  type PlatformOrganization,
  type PlatformOrganizationDeletionPreview,
  type PlatformPreviewOrganizationDeletionRequest,
  type PlatformUserFootprint,
} from '@/shared/platformAdmin'
import {
  deleteAuthUserDirect,
  deleteOrganizationWithCleanupDirect,
  detachUserFromOrganizationDirect,
  findUserFootprintByEmailDirect,
  hardDeleteUserFootprintDirect,
  listAuditLogsDirect,
  listOrganizationsForPlatformAdminDirect,
  previewOrganizationDeletionDirect,
} from '@/services/platformAdmin.firestore'

function isCallableUnavailable(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const code = 'code' in error ? String(error.code) : ''
  return code === 'functions/unavailable'
    || code === 'functions/not-found'
    || code === 'functions/internal'
}

async function callWithFallback<Request, Response>(
  callableName: string,
  payload: Request,
  fallback: () => Promise<Response>,
) {
  try {
    const callable = httpsCallable<Request, Response>(functions, callableName)
    const result = await callable(payload)
    return result.data
  } catch (error) {
    if (!isCallableUnavailable(error)) throw error
    return fallback()
  }
}

export type {
  DeleteAuthUserResult,
  DeleteOrganizationResult,
  PlatformAuditLogEntry,
  PlatformOrganization,
  PlatformOrganizationDeletionPreview,
  PlatformUserFootprint,
} from '@/shared/platformAdmin'

export async function listOrganizationsForPlatformAdmin(): Promise<PlatformOrganization[]> {
  return listOrganizationsForPlatformAdminDirect()
}

export async function findUserFootprintByEmail(rawEmail: string): Promise<PlatformUserFootprint> {
  const email = normalizePlatformAdminEmail(rawEmail)

  return callWithFallback<PlatformFindUserFootprintRequest, PlatformUserFootprint>(
    PLATFORM_ADMIN_CALLABLES.findUserFootprint,
    { email },
    () => findUserFootprintByEmailDirect(email),
  )
}

export async function listAuditLogs(limit = 25): Promise<PlatformAuditLogEntry[]> {
  return callWithFallback<PlatformListAuditLogsRequest, PlatformAuditLogEntry[]>(
    PLATFORM_ADMIN_CALLABLES.listAuditLogs,
    { limit },
    () => listAuditLogsDirect(),
  )
}

export async function detachUserFromOrganization(footprint: PlatformUserFootprint, orgId: string) {
  return callWithFallback<PlatformDetachUserFromOrganizationRequest, { deletedCount: number }>(
    PLATFORM_ADMIN_CALLABLES.detachUserFromOrganization,
    { email: footprint.email, orgId },
    async () => ({ deletedCount: await detachUserFromOrganizationDirect(footprint, orgId) }),
  ).then((result) => result.deletedCount)
}

export async function hardDeleteUserFootprint(footprint: PlatformUserFootprint) {
  return callWithFallback<PlatformDeleteUserFootprintRequest, { deletedCount: number }>(
    PLATFORM_ADMIN_CALLABLES.hardDeleteUserFootprint,
    { email: footprint.email },
    async () => ({ deletedCount: await hardDeleteUserFootprintDirect(footprint) }),
  ).then((result) => result.deletedCount)
}

export async function deleteAuthUserByEmail(email: string): Promise<DeleteAuthUserResult> {
  const normalizedEmail = normalizePlatformAdminEmail(email)
  return callWithFallback<PlatformDeleteAuthUserRequest, DeleteAuthUserResult>(
    PLATFORM_ADMIN_CALLABLES.deleteAuthUser,
    { email: normalizedEmail },
    () => deleteAuthUserDirect(),
  )
}

export async function previewOrganizationDeletion(orgId: string): Promise<PlatformOrganizationDeletionPreview> {
  return callWithFallback<PlatformPreviewOrganizationDeletionRequest, PlatformOrganizationDeletionPreview>(
    PLATFORM_ADMIN_CALLABLES.previewOrganizationDeletion,
    { orgId },
    () => previewOrganizationDeletionDirect(orgId),
  )
}

export async function deleteOrganizationWithCleanup(
  orgId: string,
  options: { deleteRegisteredUsers: boolean },
): Promise<DeleteOrganizationResult> {
  const payload: PlatformDeleteOrganizationRequest = {
    orgId,
    deleteRegisteredUsers: options.deleteRegisteredUsers,
  }

  return callWithFallback<PlatformDeleteOrganizationRequest, DeleteOrganizationResult>(
    PLATFORM_ADMIN_CALLABLES.deleteOrganization,
    payload,
    () => deleteOrganizationWithCleanupDirect(orgId, options),
  )
}
