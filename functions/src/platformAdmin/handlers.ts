import type { CallableRequest } from 'firebase-functions/v2/https'
import {
  createAuditLogEntry,
  normalizeEmail,
  requireNonEmptyString,
  requireSuperAdmin,
} from './core.js'
import type {
  DeleteAuthUserResult,
  DeleteOrganizationResult,
  DeleteUserFootprintResult,
  PlatformAuditLogEntry,
  PlatformDeleteAuthUserRequest,
  PlatformDeleteOrganizationRequest,
  PlatformDeleteUserFootprintRequest,
  PlatformDetachUserFromOrganizationRequest,
  PlatformFindUserFootprintRequest,
  PlatformListAuditLogsRequest,
  PlatformOrganizationDeletionPreview,
  PlatformPreviewOrganizationDeletionRequest,
  PlatformUserFootprint,
} from './contracts.js'

export interface PlatformAdminRepository {
  findUserFootprintByEmail: (email: string) => Promise<PlatformUserFootprint>
  listAuditLogs: (limit: number) => Promise<PlatformAuditLogEntry[]>
  detachUserFromOrganization: (email: string, orgId: string) => Promise<{ deletedCount: number }>
  hardDeleteUserFootprint: (email: string) => Promise<DeleteUserFootprintResult>
  deleteAuthUser: (email: string) => Promise<DeleteAuthUserResult>
  previewOrganizationDeletion: (orgId: string) => Promise<PlatformOrganizationDeletionPreview>
  deleteOrganization: (orgId: string, deleteRegisteredUsers: boolean) => Promise<DeleteOrganizationResult>
  writeAuditLog: (entry: PlatformAuditLogEntry) => Promise<void>
}

export function createPlatformAdminHandlers(repository: PlatformAdminRepository) {
  return {
    async findUserFootprint(request: CallableRequest<PlatformFindUserFootprintRequest>) {
      requireSuperAdmin(request.auth)
      const email = normalizeEmail(request.data?.email)
      return repository.findUserFootprintByEmail(email)
    },

    async listAuditLogs(request: CallableRequest<PlatformListAuditLogsRequest>) {
      requireSuperAdmin(request.auth)
      const limit = typeof request.data?.limit === 'number' && request.data.limit > 0
        ? Math.min(Math.floor(request.data.limit), 100)
        : 25
      return repository.listAuditLogs(limit)
    },

    async detachUserFromOrganization(request: CallableRequest<PlatformDetachUserFromOrganizationRequest>) {
      const actor = requireSuperAdmin(request.auth)
      const email = normalizeEmail(request.data?.email)
      const orgId = requireNonEmptyString(request.data?.orgId, 'orgId')

      const result = await repository.detachUserFromOrganization(email, orgId)
      await repository.writeAuditLog(createAuditLogEntry({
        action: 'detach_user_from_organization',
        actorUid: actor.actorUid,
        actorEmail: actor.actorEmail,
        targetType: 'user',
        targetId: email,
        targetEmail: email,
        orgId,
        metadata: {
          deletedCount: result.deletedCount,
        },
      }))

      return result
    },

    async hardDeleteUserFootprint(request: CallableRequest<PlatformDeleteUserFootprintRequest>) {
      const actor = requireSuperAdmin(request.auth)
      const email = normalizeEmail(request.data?.email)
      const result = await repository.hardDeleteUserFootprint(email)

      await repository.writeAuditLog(createAuditLogEntry({
        action: 'hard_delete_user_footprint',
        actorUid: actor.actorUid,
        actorEmail: actor.actorEmail,
        targetType: 'user',
        targetId: email,
        targetEmail: email,
        metadata: {
          deletedCount: result.deletedCount,
        },
      }))

      return result
    },

    async deleteAuthUser(request: CallableRequest<PlatformDeleteAuthUserRequest>) {
      const actor = requireSuperAdmin(request.auth)
      const email = normalizeEmail(request.data?.email)
      const result = await repository.deleteAuthUser(email)

      await repository.writeAuditLog(createAuditLogEntry({
        action: 'delete_auth_user',
        actorUid: actor.actorUid,
        actorEmail: actor.actorEmail,
        targetType: 'user',
        targetId: email,
        targetEmail: email,
        metadata: {
          deletedAuthUser: result.deletedAuthUser,
        },
      }))

      return result
    },

    async previewOrganizationDeletion(request: CallableRequest<PlatformPreviewOrganizationDeletionRequest>) {
      requireSuperAdmin(request.auth)
      const orgId = requireNonEmptyString(request.data?.orgId, 'orgId')
      return repository.previewOrganizationDeletion(orgId)
    },

    async deleteOrganization(request: CallableRequest<PlatformDeleteOrganizationRequest>) {
      const actor = requireSuperAdmin(request.auth)
      const orgId = requireNonEmptyString(request.data?.orgId, 'orgId')
      const deleteRegisteredUsers = Boolean(request.data?.deleteRegisteredUsers)
      const result = await repository.deleteOrganization(orgId, deleteRegisteredUsers)

      await repository.writeAuditLog(createAuditLogEntry({
        action: 'delete_organization',
        actorUid: actor.actorUid,
        actorEmail: actor.actorEmail,
        targetType: 'organization',
        targetId: orgId,
        orgId,
        metadata: {
          deleteRegisteredUsers,
          deletedCount: result.deletedCount,
          deletedUserCount: result.deletedUserCount,
          skippedUserCount: result.skippedUserCount,
        },
      }))

      return result
    },
  }
}
