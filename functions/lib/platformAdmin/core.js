import { HttpsError } from 'firebase-functions/v2/https';
export function requireSuperAdmin(auth) {
    if (!auth?.uid) {
        throw new HttpsError('unauthenticated', 'Bejelentkezés szükséges.');
    }
    if (auth.token?.platformRole !== 'super_admin') {
        throw new HttpsError('permission-denied', 'Ehhez super admin jogosultság szükséges.');
    }
    return {
        actorUid: auth.uid,
        actorEmail: auth.token?.email ?? '',
    };
}
export function requireNonEmptyString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new HttpsError('invalid-argument', `A(z) ${fieldName} mező kötelező.`);
    }
    return value.trim();
}
export function normalizeEmail(email) {
    return requireNonEmptyString(email, 'email').toLowerCase();
}
export function createAuditLogEntry(input) {
    return {
        action: input.action,
        actorUid: input.actorUid,
        actorEmail: input.actorEmail,
        targetType: input.targetType,
        targetId: input.targetId,
        targetEmail: input.targetEmail,
        orgId: input.orgId,
        metadata: input.metadata ?? {},
    };
}
