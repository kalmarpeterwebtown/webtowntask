import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp, } from 'firebase-admin/firestore';
if (getApps().length === 0) {
    initializeApp();
}
const db = getFirestore();
const auth = getAuth();
function docPath(...segments) {
    return segments.join('/');
}
async function listCollectionPaths(collectionRef) {
    const snap = await collectionRef.get();
    return snap.docs.map((entry) => entry.ref.path);
}
async function getExistingDocPath(...segments) {
    const snap = await db.doc(docPath(...segments)).get();
    return snap.exists ? snap.ref.path : null;
}
async function collectStoryPaths(orgId, projectId, storyId) {
    const storyRef = db.doc(docPath('organizations', orgId, 'projects', projectId, 'stories', storyId));
    const [taskPaths, commentPaths, worklogPaths, attachmentPaths] = await Promise.all([
        listCollectionPaths(storyRef.collection('tasks')),
        listCollectionPaths(storyRef.collection('comments')),
        listCollectionPaths(storyRef.collection('worklogs')),
        listCollectionPaths(storyRef.collection('attachments')),
    ]);
    return [
        ...taskPaths,
        ...commentPaths,
        ...worklogPaths,
        ...attachmentPaths,
        storyRef.path,
    ];
}
async function collectProjectPaths(orgId, projectId) {
    const projectRef = db.doc(docPath('organizations', orgId, 'projects', projectId));
    const [membershipPaths, storySnap, tagPaths, topicPaths, dividerPaths, activityLogPaths, savedFilterPaths, statsPath,] = await Promise.all([
        listCollectionPaths(projectRef.collection('memberships')),
        projectRef.collection('stories').get(),
        listCollectionPaths(projectRef.collection('tags')),
        listCollectionPaths(projectRef.collection('topics')),
        listCollectionPaths(projectRef.collection('dividers')),
        listCollectionPaths(projectRef.collection('activityLogs')),
        listCollectionPaths(projectRef.collection('savedFilters')),
        getExistingDocPath('organizations', orgId, 'projects', projectId, 'stats', 'current'),
    ]);
    const storyPaths = (await Promise.all(storySnap.docs.map((storyDoc) => collectStoryPaths(orgId, projectId, storyDoc.id)))).flat();
    return [
        ...membershipPaths,
        ...storyPaths,
        ...tagPaths,
        ...topicPaths,
        ...dividerPaths,
        ...activityLogPaths,
        ...savedFilterPaths,
        ...(statsPath ? [statsPath] : []),
        projectRef.path,
    ];
}
async function collectTeamPaths(orgId, teamId) {
    const teamRef = db.doc(docPath('organizations', orgId, 'teams', teamId));
    const [membershipPaths, sprintSnap] = await Promise.all([
        listCollectionPaths(teamRef.collection('memberships')),
        teamRef.collection('sprints').get(),
    ]);
    const sprintPaths = (await Promise.all(sprintSnap.docs.map(async (sprintDoc) => {
        const dailySnapshotPaths = await listCollectionPaths(sprintDoc.ref.collection('dailySnapshots'));
        return [
            ...dailySnapshotPaths,
            sprintDoc.ref.path,
        ];
    }))).flat();
    return [
        ...membershipPaths,
        ...sprintPaths,
        teamRef.path,
    ];
}
async function loadOrganizationRegisteredUsers(orgId, memberUserIds) {
    const users = await Promise.all(memberUserIds.map(async (userId) => {
        const userRef = db.doc(docPath('users', userId));
        const [userSnap, orgMembershipsSnap] = await Promise.all([
            userRef.get(),
            userRef.collection('orgMemberships').get(),
        ]);
        if (!userSnap.exists)
            return null;
        const data = userSnap.data() ?? {};
        const otherOrgIds = orgMembershipsSnap.docs
            .map((membershipDoc) => membershipDoc.id)
            .filter((membershipOrgId) => membershipOrgId !== orgId);
        return {
            userId,
            email: typeof data.email === 'string' ? data.email : '',
            displayName: typeof data.displayName === 'string'
                ? data.displayName
                : (typeof data.email === 'string' ? data.email : userId),
            otherOrgIds,
            canDeleteProfile: otherOrgIds.length === 0,
        };
    }));
    return users.filter((user) => user !== null);
}
async function collectOrganizationDeletionPlan(orgId, deleteRegisteredUsers) {
    const orgRef = db.doc(docPath('organizations', orgId));
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
        throw new Error('A szervezet nem található.');
    }
    const [membersSnap, invitationsSnap, projectsSnap, teamsSnap] = await Promise.all([
        orgRef.collection('members').get(),
        orgRef.collection('invitations').get(),
        orgRef.collection('projects').get(),
        orgRef.collection('teams').get(),
    ]);
    const projectPaths = (await Promise.all(projectsSnap.docs.map((projectDoc) => collectProjectPaths(orgId, projectDoc.id)))).flat();
    const teamPaths = (await Promise.all(teamsSnap.docs.map((teamDoc) => collectTeamPaths(orgId, teamDoc.id)))).flat();
    const registeredUsers = await loadOrganizationRegisteredUsers(orgId, membersSnap.docs.map((memberDoc) => memberDoc.id));
    const sharedUserCleanups = [];
    const deletableUserIds = [];
    let deletedUserCount = 0;
    let skippedUserCount = 0;
    await Promise.all(registeredUsers.map(async (registeredUser) => {
        const userRef = db.doc(docPath('users', registeredUser.userId));
        const [userSnap, notificationSnap] = await Promise.all([
            userRef.get(),
            userRef.collection('notifications').where('orgId', '==', orgId).get(),
        ]);
        if (deleteRegisteredUsers && registeredUser.canDeleteProfile) {
            deletableUserIds.push(registeredUser.userId);
            deletedUserCount += 1;
            return;
        }
        if (deleteRegisteredUsers && !registeredUser.canDeleteProfile) {
            skippedUserCount += 1;
        }
        sharedUserCleanups.push({
            userId: registeredUser.userId,
            nextCurrentOrgId: userSnap.exists && userSnap.data()?.currentOrgId === orgId
                ? (registeredUser.otherOrgIds[0] ?? null)
                : null,
            notificationPaths: notificationSnap.docs.map((entry) => entry.ref.path),
        });
    }));
    const baseDeleteCount = Array.from(new Set([
        orgRef.path,
        ...membersSnap.docs.map((entry) => entry.ref.path),
        ...invitationsSnap.docs.map((entry) => entry.ref.path),
        ...projectPaths,
        ...teamPaths,
        ...sharedUserCleanups.flatMap((cleanup) => [
            docPath('users', cleanup.userId, 'orgMemberships', orgId),
            ...cleanup.notificationPaths,
        ]),
        ...deletableUserIds.map((userId) => docPath('users', userId)),
    ])).length;
    return {
        orgRef,
        orgName: typeof orgSnap.data()?.name === 'string' ? orgSnap.data()?.name : orgId,
        memberCount: membersSnap.size,
        invitationCount: invitationsSnap.size,
        projectCount: projectsSnap.size,
        teamCount: teamsSnap.size,
        storyCount: projectPaths.filter((path) => path.includes('/stories/')
            && !path.includes('/tasks/')
            && !path.includes('/comments/')
            && !path.includes('/worklogs/')
            && !path.includes('/attachments/')).length,
        registeredUsers,
        deletableUserIds,
        sharedUserCleanups,
        estimatedDeleteCount: baseDeleteCount,
        deletedUserCount,
        skippedUserCount,
    };
}
async function deleteDocumentPaths(paths) {
    const uniquePaths = Array.from(new Set(paths));
    for (const path of uniquePaths) {
        await db.doc(path).delete();
    }
}
export function createPlatformAdminRepository() {
    const findUserFootprintByEmail = async (email) => {
        const warnings = [];
        const hits = [];
        const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
        let userId = userSnap.docs[0]?.id ?? null;
        if (userSnap.docs[0]) {
            hits.push({
                id: userSnap.docs[0].id,
                path: userSnap.docs[0].ref.path,
                kind: 'user',
                userId,
                email,
            });
        }
        const [orgMembersSnap, membershipsSnap, invitationsSnap] = await Promise.all([
            db.collectionGroup('members').where('email', '==', email).get(),
            db.collectionGroup('memberships').where('email', '==', email).get(),
            db.collectionGroup('invitations').where('email', '==', email).get(),
        ]);
        orgMembersSnap.docs.forEach((memberDoc) => {
            const segments = memberDoc.ref.path.split('/');
            userId ??= memberDoc.id;
            hits.push({
                id: memberDoc.id,
                path: memberDoc.ref.path,
                kind: 'orgMember',
                orgId: segments[1],
                userId: typeof memberDoc.data().userId === 'string' ? memberDoc.data().userId : memberDoc.id,
                email,
            });
        });
        membershipsSnap.docs.forEach((membershipDoc) => {
            const segments = membershipDoc.ref.path.split('/');
            const isProjectMembership = segments[2] === 'projects';
            userId ??= typeof membershipDoc.data().userId === 'string' ? membershipDoc.data().userId : membershipDoc.id;
            hits.push({
                id: membershipDoc.id,
                path: membershipDoc.ref.path,
                kind: isProjectMembership ? 'projectMembership' : 'teamMembership',
                orgId: segments[1],
                projectId: isProjectMembership ? segments[3] : undefined,
                teamId: isProjectMembership ? undefined : segments[3],
                userId: typeof membershipDoc.data().userId === 'string' ? membershipDoc.data().userId : membershipDoc.id,
                email,
            });
        });
        invitationsSnap.docs.forEach((invitationDoc) => {
            const segments = invitationDoc.ref.path.split('/');
            hits.push({
                id: invitationDoc.id,
                path: invitationDoc.ref.path,
                kind: 'invitation',
                orgId: segments[1],
                email,
            });
        });
        if (userId) {
            const userRef = db.doc(docPath('users', userId));
            const [orgMembershipsSnap, notificationsSnap] = await Promise.all([
                userRef.collection('orgMemberships').get(),
                userRef.collection('notifications').get(),
            ]);
            orgMembershipsSnap.docs.forEach((membershipDoc) => {
                hits.push({
                    id: membershipDoc.id,
                    path: membershipDoc.ref.path,
                    kind: 'orgMembership',
                    orgId: membershipDoc.id,
                    userId: userId ?? undefined,
                });
            });
            notificationsSnap.docs.forEach((notificationDoc) => {
                hits.push({
                    id: notificationDoc.id,
                    path: notificationDoc.ref.path,
                    kind: 'notification',
                    userId: userId ?? undefined,
                });
            });
        }
        return {
            email,
            userId,
            hits: hits.sort((a, b) => a.path.localeCompare(b.path)),
            warnings,
        };
    };
    const repository = {
        findUserFootprintByEmail,
        async listAuditLogs(limit) {
            const snap = await db.collection('platformAuditLogs')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
            return snap.docs.map((entry) => {
                const data = entry.data();
                return {
                    id: entry.id,
                    action: data.action,
                    actorUid: data.actorUid,
                    actorEmail: data.actorEmail,
                    targetType: data.targetType,
                    targetId: data.targetId,
                    targetEmail: data.targetEmail,
                    orgId: data.orgId,
                    metadata: typeof data.metadata === 'object' && data.metadata !== null ? data.metadata : {},
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
                };
            });
        },
        async detachUserFromOrganization(email, orgId) {
            const footprint = await findUserFootprintByEmail(email);
            const deletableHits = footprint.hits.filter((hit) => hit.orgId === orgId && ['orgMember', 'projectMembership', 'teamMembership', 'invitation', 'orgMembership', 'notification'].includes(hit.kind));
            if (footprint.userId) {
                const userRef = db.doc(docPath('users', footprint.userId));
                const userSnap = await userRef.get();
                if (userSnap.exists && userSnap.data()?.currentOrgId === orgId) {
                    const orgMembershipsSnap = await userRef.collection('orgMemberships').get();
                    const nextOrgId = orgMembershipsSnap.docs.find((membershipDoc) => membershipDoc.id !== orgId)?.id ?? null;
                    await userRef.set({ currentOrgId: nextOrgId }, { merge: true });
                }
            }
            await deleteDocumentPaths(deletableHits.map((hit) => hit.path));
            return { deletedCount: deletableHits.length };
        },
        async hardDeleteUserFootprint(email) {
            const footprint = await findUserFootprintByEmail(email);
            if (footprint.userId) {
                await db.recursiveDelete(db.doc(docPath('users', footprint.userId)));
            }
            const otherPaths = footprint.hits
                .filter((hit) => !(footprint.userId && hit.path.startsWith(docPath('users', footprint.userId))))
                .map((hit) => hit.path);
            await deleteDocumentPaths(otherPaths);
            const totalDeleted = new Set([
                ...(footprint.userId ? [docPath('users', footprint.userId)] : []),
                ...otherPaths,
            ]).size;
            return { deletedCount: totalDeleted };
        },
        async deleteAuthUser(email) {
            try {
                const userRecord = await auth.getUserByEmail(email);
                await auth.deleteUser(userRecord.uid);
                return { deletedAuthUser: true };
            }
            catch (error) {
                const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
                if (code === 'auth/user-not-found') {
                    return { deletedAuthUser: false };
                }
                throw error;
            }
        },
        async previewOrganizationDeletion(orgId) {
            const plan = await collectOrganizationDeletionPlan(orgId, false);
            return {
                orgId,
                orgName: plan.orgName,
                memberCount: plan.memberCount,
                invitationCount: plan.invitationCount,
                projectCount: plan.projectCount,
                teamCount: plan.teamCount,
                storyCount: plan.storyCount,
                registeredUsers: plan.registeredUsers,
                deletableUserCount: plan.registeredUsers.filter((user) => user.canDeleteProfile).length,
                sharedUserCount: plan.registeredUsers.filter((user) => !user.canDeleteProfile).length,
                estimatedDeleteCount: plan.estimatedDeleteCount,
            };
        },
        async deleteOrganization(orgId, deleteRegisteredUsers) {
            const plan = await collectOrganizationDeletionPlan(orgId, deleteRegisteredUsers);
            for (const cleanup of plan.sharedUserCleanups) {
                const userRef = db.doc(docPath('users', cleanup.userId));
                if (cleanup.nextCurrentOrgId !== null) {
                    await userRef.set({ currentOrgId: cleanup.nextCurrentOrgId }, { merge: true });
                }
                else {
                    const userSnap = await userRef.get();
                    if (userSnap.exists && userSnap.data()?.currentOrgId === orgId) {
                        await userRef.set({ currentOrgId: null }, { merge: true });
                    }
                }
                await deleteDocumentPaths([
                    docPath('users', cleanup.userId, 'orgMemberships', orgId),
                    ...cleanup.notificationPaths,
                ]);
            }
            for (const userId of plan.deletableUserIds) {
                await db.recursiveDelete(db.doc(docPath('users', userId)));
                try {
                    await auth.deleteUser(userId);
                }
                catch {
                    // Auth user hiánya ne akadályozza az org cleanupot.
                }
            }
            await db.recursiveDelete(plan.orgRef);
            return {
                deletedCount: plan.estimatedDeleteCount,
                deletedUserCount: plan.deletedUserCount,
                skippedUserCount: plan.skippedUserCount,
            };
        },
        async writeAuditLog(entry) {
            await db.collection('platformAuditLogs').add({
                ...entry,
                createdAt: Timestamp.now(),
                serverCreatedAt: FieldValue.serverTimestamp(),
            });
        },
    };
    return repository;
}
