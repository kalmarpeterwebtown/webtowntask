import { createAuditLogEntry, normalizeEmail, requireNonEmptyString, requireSuperAdmin, } from './core.js';
export function createPlatformAdminHandlers(repository) {
    return {
        async findUserFootprint(request) {
            requireSuperAdmin(request.auth);
            const email = normalizeEmail(request.data?.email);
            return repository.findUserFootprintByEmail(email);
        },
        async listAuditLogs(request) {
            requireSuperAdmin(request.auth);
            const limit = typeof request.data?.limit === 'number' && request.data.limit > 0
                ? Math.min(Math.floor(request.data.limit), 100)
                : 25;
            return repository.listAuditLogs(limit);
        },
        async detachUserFromOrganization(request) {
            const actor = requireSuperAdmin(request.auth);
            const email = normalizeEmail(request.data?.email);
            const orgId = requireNonEmptyString(request.data?.orgId, 'orgId');
            const result = await repository.detachUserFromOrganization(email, orgId);
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
            }));
            return result;
        },
        async hardDeleteUserFootprint(request) {
            const actor = requireSuperAdmin(request.auth);
            const email = normalizeEmail(request.data?.email);
            const result = await repository.hardDeleteUserFootprint(email);
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
            }));
            return result;
        },
        async deleteAuthUser(request) {
            const actor = requireSuperAdmin(request.auth);
            const email = normalizeEmail(request.data?.email);
            const result = await repository.deleteAuthUser(email);
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
            }));
            return result;
        },
        async previewOrganizationDeletion(request) {
            requireSuperAdmin(request.auth);
            const orgId = requireNonEmptyString(request.data?.orgId, 'orgId');
            return repository.previewOrganizationDeletion(orgId);
        },
        async deleteOrganization(request) {
            const actor = requireSuperAdmin(request.auth);
            const orgId = requireNonEmptyString(request.data?.orgId, 'orgId');
            const deleteRegisteredUsers = Boolean(request.data?.deleteRegisteredUsers);
            const result = await repository.deleteOrganization(orgId, deleteRegisteredUsers);
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
            }));
            return result;
        },
    };
}
