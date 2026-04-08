import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  normalizePlatformAdminEmail,
  type DeleteAuthUserResult,
  type DeleteOrganizationResult,
  type PlatformAuditLogEntry,
  type PlatformOrganization,
  type PlatformOrganizationDeletionPreview,
  type PlatformRegisteredUser,
  type PlatformUserFootprint,
} from '@/shared/platformAdmin'

function docRefFromPath(path: string) {
  const segments = path.split('/') as [string, string, ...string[]]
  return doc(db, ...segments)
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'Ismeretlen Firestore hiba'
}

async function listDocPaths(...segments: string[]) {
  const path = segments.join('/')
  const snap = await getDocs(collection(db, path))
  return snap.docs.map((entry) => entry.ref.path)
}

async function getDocPathIfExists(...segments: string[]) {
  const path = segments.join('/')
  const snap = await getDoc(doc(db, path))
  return snap.exists() ? snap.ref.path : null
}

async function deletePaths(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths))
  const chunkSize = 25

  for (let index = 0; index < uniquePaths.length; index += chunkSize) {
    const slice = uniquePaths.slice(index, index + chunkSize)
    await Promise.all(slice.map((path) => deleteDoc(docRefFromPath(path))))
  }

  return uniquePaths.length
}

async function collectStoryPaths(orgId: string, projectId: string, storyId: string) {
  const [taskPaths, commentPaths, worklogPaths, attachmentPaths] = await Promise.all([
    listDocPaths('organizations', orgId, 'projects', projectId, 'stories', storyId, 'tasks'),
    listDocPaths('organizations', orgId, 'projects', projectId, 'stories', storyId, 'comments'),
    listDocPaths('organizations', orgId, 'projects', projectId, 'stories', storyId, 'worklogs'),
    listDocPaths('organizations', orgId, 'projects', projectId, 'stories', storyId, 'attachments'),
  ])

  return [
    ...taskPaths,
    ...commentPaths,
    ...worklogPaths,
    ...attachmentPaths,
    `organizations/${orgId}/projects/${projectId}/stories/${storyId}`,
  ]
}

async function collectProjectPaths(orgId: string, projectId: string) {
  const [
    membershipPaths,
    storySnap,
    tagPaths,
    topicPaths,
    dividerPaths,
    activityLogPaths,
    savedFilterPaths,
    statsPath,
  ] = await Promise.all([
    listDocPaths('organizations', orgId, 'projects', projectId, 'memberships'),
    getDocs(collection(db, 'organizations', orgId, 'projects', projectId, 'stories')),
    listDocPaths('organizations', orgId, 'projects', projectId, 'tags'),
    listDocPaths('organizations', orgId, 'projects', projectId, 'topics'),
    listDocPaths('organizations', orgId, 'projects', projectId, 'dividers'),
    listDocPaths('organizations', orgId, 'projects', projectId, 'activityLogs'),
    listDocPaths('organizations', orgId, 'projects', projectId, 'savedFilters'),
    getDocPathIfExists('organizations', orgId, 'projects', projectId, 'stats', 'current'),
  ])

  const storyPaths = (await Promise.all(
    storySnap.docs.map((storyDoc) => collectStoryPaths(orgId, projectId, storyDoc.id)),
  )).flat()

  return [
    ...membershipPaths,
    ...storyPaths,
    ...tagPaths,
    ...topicPaths,
    ...dividerPaths,
    ...activityLogPaths,
    ...savedFilterPaths,
    ...(statsPath ? [statsPath] : []),
    `organizations/${orgId}/projects/${projectId}`,
  ]
}

async function collectTeamPaths(orgId: string, teamId: string) {
  const [membershipPaths, sprintSnap] = await Promise.all([
    listDocPaths('organizations', orgId, 'teams', teamId, 'memberships'),
    getDocs(collection(db, 'organizations', orgId, 'teams', teamId, 'sprints')),
  ])

  const sprintPaths = (await Promise.all(
    sprintSnap.docs.map(async (sprintDoc) => {
      const dailySnapshotPaths = await listDocPaths(
        'organizations',
        orgId,
        'teams',
        teamId,
        'sprints',
        sprintDoc.id,
        'dailySnapshots',
      )

      return [
        ...dailySnapshotPaths,
        `organizations/${orgId}/teams/${teamId}/sprints/${sprintDoc.id}`,
      ]
    }),
  )).flat()

  return [
    ...membershipPaths,
    ...sprintPaths,
    `organizations/${orgId}/teams/${teamId}`,
  ]
}

async function loadOrganizationRegisteredUsers(orgId: string, memberUserIds: string[]) {
  const users = await Promise.all(memberUserIds.map(async (userId) => {
    const userDocRef = doc(db, 'users', userId)
    const [userSnap, orgMembershipsSnap] = await Promise.all([
      getDoc(userDocRef),
      getDocs(collection(db, 'users', userId, 'orgMemberships')),
    ])

    if (!userSnap.exists()) return null

    const data = userSnap.data()
    const otherOrgIds = orgMembershipsSnap.docs
      .map((membershipDoc) => membershipDoc.id)
      .filter((membershipOrgId) => membershipOrgId !== orgId)

    return {
      userId,
      email: (data.email as string | undefined) ?? '',
      displayName: (data.displayName as string | undefined) ?? (data.email as string | undefined) ?? userId,
      otherOrgIds,
      canDeleteProfile: otherOrgIds.length === 0,
    } satisfies PlatformRegisteredUser
  }))

  return users.filter((user): user is PlatformRegisteredUser => user !== null)
}

async function collectOrganizationDeletionPlan(
  orgId: string,
  deleteRegisteredUsers: boolean,
) {
  const orgDocRef = doc(db, 'organizations', orgId)
  const orgSnap = await getDoc(orgDocRef)
  if (!orgSnap.exists()) {
    throw new Error('A szervezet nem található.')
  }

  const [membersSnap, invitationsSnap, projectsSnap, teamsSnap] = await Promise.all([
    getDocs(collection(db, 'organizations', orgId, 'members')),
    getDocs(collection(db, 'organizations', orgId, 'invitations')),
    getDocs(collection(db, 'organizations', orgId, 'projects')),
    getDocs(collection(db, 'organizations', orgId, 'teams')),
  ])

  const projectPaths = (await Promise.all(
    projectsSnap.docs.map((projectDoc) => collectProjectPaths(orgId, projectDoc.id)),
  )).flat()

  const teamPaths = (await Promise.all(
    teamsSnap.docs.map((teamDoc) => collectTeamPaths(orgId, teamDoc.id)),
  )).flat()

  const memberPaths = membersSnap.docs.map((memberDoc) => memberDoc.ref.path)
  const invitationPaths = invitationsSnap.docs.map((invitationDoc) => invitationDoc.ref.path)
  const registeredUsers = await loadOrganizationRegisteredUsers(
    orgId,
    membersSnap.docs.map((memberDoc) => memberDoc.id),
  )

  const userPathsToDelete: string[] = []
  const userUpdates: Array<{ userId: string; nextCurrentOrgId: string | null }> = []
  let deletedUserCount = 0
  let skippedUserCount = 0

  await Promise.all(registeredUsers.map(async (registeredUser) => {
    const [orgMembershipsSnap, notificationsSnap, userSnap] = await Promise.all([
      getDocs(collection(db, 'users', registeredUser.userId, 'orgMemberships')),
      getDocs(collection(db, 'users', registeredUser.userId, 'notifications')),
      getDoc(doc(db, 'users', registeredUser.userId)),
    ])

    const orgMembershipPaths = orgMembershipsSnap.docs
      .filter((membershipDoc) => membershipDoc.id === orgId)
      .map((membershipDoc) => membershipDoc.ref.path)

    const orgNotificationPaths = notificationsSnap.docs
      .filter((notificationDoc) => notificationDoc.data().orgId === orgId)
      .map((notificationDoc) => notificationDoc.ref.path)

    if (deleteRegisteredUsers && registeredUser.canDeleteProfile) {
      userPathsToDelete.push(
        ...orgMembershipsSnap.docs.map((membershipDoc) => membershipDoc.ref.path),
        ...notificationsSnap.docs.map((notificationDoc) => notificationDoc.ref.path),
        userSnap.exists() ? userSnap.ref.path : '',
      )
      deletedUserCount += 1
      return
    }

    if (deleteRegisteredUsers && !registeredUser.canDeleteProfile) {
      skippedUserCount += 1
    }

    userPathsToDelete.push(...orgMembershipPaths, ...orgNotificationPaths)

    if (userSnap.exists() && userSnap.data().currentOrgId === orgId) {
      userUpdates.push({
        userId: registeredUser.userId,
        nextCurrentOrgId: registeredUser.otherOrgIds[0] ?? null,
      })
    }
  }))

  const deletionPaths = [
    ...projectPaths,
    ...teamPaths,
    ...memberPaths,
    ...invitationPaths,
    ...userPathsToDelete.filter(Boolean),
    orgDocRef.path,
  ]

  return {
    orgName: (orgSnap.data().name as string | undefined) ?? orgId,
    membersSnap,
    invitationsSnap,
    projectsSnap,
    teamsSnap,
    registeredUsers,
    deletionPaths,
    userUpdates,
    deletedUserCount,
    skippedUserCount,
    storyCount: projectPaths.filter((path) =>
      path.includes('/stories/')
      && !path.includes('/tasks/')
      && !path.includes('/comments/')
      && !path.includes('/worklogs/')
      && !path.includes('/attachments/')).length,
  }
}

export async function listOrganizationsForPlatformAdminDirect(): Promise<PlatformOrganization[]> {
  const orgsSnap = await getDocs(query(collection(db, 'organizations'), orderBy('createdAt', 'desc'), limit(100)))

  return Promise.all(orgsSnap.docs.map(async (orgDoc) => {
    const data = orgDoc.data()
    const membersSnap = await getDocs(collection(db, 'organizations', orgDoc.id, 'members'))
    return {
      id: orgDoc.id,
      name: data.name as string,
      slug: data.slug as string,
      plan: (data.plan as string | undefined) ?? 'free',
      memberCount: membersSnap.size,
    }
  }))
}

export async function findUserFootprintByEmailDirect(rawEmail: string): Promise<PlatformUserFootprint> {
  const email = normalizePlatformAdminEmail(rawEmail)
  const hits = []
  const warnings: string[] = []

  const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(1)))
  let userId: string | null = userSnap.docs[0]?.id ?? null

  if (userSnap.docs[0]) {
    hits.push({
      id: userSnap.docs[0].id,
      path: userSnap.docs[0].ref.path,
      kind: 'user' as const,
      userId,
      email,
    })
  }

  const [orgMembersResult, membershipsResult, invitationsResult] = await Promise.allSettled([
    getDocs(query(collectionGroup(db, 'members'), where('email', '==', email))),
    getDocs(query(collectionGroup(db, 'memberships'), where('email', '==', email))),
    getDocs(query(collectionGroup(db, 'invitations'), where('email', '==', email))),
  ])

  if (orgMembersResult.status === 'rejected') {
    warnings.push(`Szervezeti tagok lekérdezése sikertelen: ${extractErrorMessage(orgMembersResult.reason)}`)
  }
  if (membershipsResult.status === 'rejected') {
    warnings.push(`Projekt vagy team memberships lekérdezése sikertelen: ${extractErrorMessage(membershipsResult.reason)}`)
  }
  if (invitationsResult.status === 'rejected') {
    warnings.push(`Invitationök lekérdezése sikertelen: ${extractErrorMessage(invitationsResult.reason)}`)
  }

  const orgMembersSnap = orgMembersResult.status === 'fulfilled' ? orgMembersResult.value : null
  const membershipsSnap = membershipsResult.status === 'fulfilled' ? membershipsResult.value : null
  const invitationsSnap = invitationsResult.status === 'fulfilled' ? invitationsResult.value : null

  orgMembersSnap?.docs.forEach((memberDoc) => {
    const segments = memberDoc.ref.path.split('/')
    userId ??= memberDoc.id
    hits.push({
      id: memberDoc.id,
      path: memberDoc.ref.path,
      kind: 'orgMember' as const,
      orgId: segments[1],
      userId: (memberDoc.data().userId as string | undefined) ?? memberDoc.id,
      email,
    })
  })

  membershipsSnap?.docs.forEach((membershipDoc) => {
    const segments = membershipDoc.ref.path.split('/')
    const isProjectMembership = segments[2] === 'projects'
    userId ??= (membershipDoc.data().userId as string | undefined) ?? membershipDoc.id
    hits.push({
      id: membershipDoc.id,
      path: membershipDoc.ref.path,
      kind: isProjectMembership ? 'projectMembership' as const : 'teamMembership' as const,
      orgId: segments[1],
      projectId: isProjectMembership ? segments[3] : undefined,
      teamId: isProjectMembership ? undefined : segments[3],
      userId: (membershipDoc.data().userId as string | undefined) ?? membershipDoc.id,
      email,
    })
  })

  invitationsSnap?.docs.forEach((invitationDoc) => {
    const segments = invitationDoc.ref.path.split('/')
    hits.push({
      id: invitationDoc.id,
      path: invitationDoc.ref.path,
      kind: 'invitation' as const,
      orgId: segments[1],
      email,
    })
  })

  if (userId) {
    const [orgMembershipsResult, notificationsResult] = await Promise.allSettled([
      getDocs(collection(db, 'users', userId, 'orgMemberships')),
      getDocs(collection(db, 'users', userId, 'notifications')),
    ])

    if (orgMembershipsResult.status === 'rejected') {
      warnings.push(`Felhasználó orgMemberships lekérdezése sikertelen: ${extractErrorMessage(orgMembershipsResult.reason)}`)
    }
    if (notificationsResult.status === 'rejected') {
      warnings.push(`Felhasználó notificationök lekérdezése sikertelen: ${extractErrorMessage(notificationsResult.reason)}`)
    }

    const orgMembershipsSnap = orgMembershipsResult.status === 'fulfilled' ? orgMembershipsResult.value : null
    const notificationsSnap = notificationsResult.status === 'fulfilled' ? notificationsResult.value : null

    orgMembershipsSnap?.docs.forEach((membershipDoc) => {
      hits.push({
        id: membershipDoc.id,
        path: membershipDoc.ref.path,
        kind: 'orgMembership' as const,
        orgId: membershipDoc.id,
        userId,
      })
    })

    notificationsSnap?.docs.forEach((notificationDoc) => {
      hits.push({
        id: notificationDoc.id,
        path: notificationDoc.ref.path,
        kind: 'notification' as const,
        userId,
      })
    })
  }

  return {
    email,
    userId,
    hits: hits.sort((a, b) => a.path.localeCompare(b.path)),
    warnings,
  }
}

export async function detachUserFromOrganizationDirect(footprint: PlatformUserFootprint, orgId: string) {
  const deletableHits = footprint.hits.filter((hit) =>
    hit.orgId === orgId && ['orgMember', 'projectMembership', 'teamMembership', 'invitation', 'orgMembership'].includes(hit.kind))

  if (footprint.userId) {
    const userDocRef = doc(db, 'users', footprint.userId)
    const userDoc = await getDoc(userDocRef)
    if (userDoc.exists() && userDoc.data().currentOrgId === orgId) {
      await updateDoc(userDocRef, { currentOrgId: null })
    }
  }

  await deletePaths(deletableHits.map((hit) => hit.path))
  return deletableHits.length
}

export async function hardDeleteUserFootprintDirect(footprint: PlatformUserFootprint) {
  const uniquePaths = Array.from(new Set(footprint.hits.map((hit) => hit.path)))
  await deletePaths(uniquePaths)
  return uniquePaths.length
}

export async function listAuditLogsDirect(): Promise<PlatformAuditLogEntry[]> {
  return []
}

export async function deleteAuthUserDirect(): Promise<DeleteAuthUserResult> {
  throw new Error('Az Auth user törléséhez backend callable function szükséges.')
}

export async function previewOrganizationDeletionDirect(orgId: string): Promise<PlatformOrganizationDeletionPreview> {
  const plan = await collectOrganizationDeletionPlan(orgId, false)

  return {
    orgId,
    orgName: plan.orgName,
    memberCount: plan.membersSnap.size,
    invitationCount: plan.invitationsSnap.size,
    projectCount: plan.projectsSnap.size,
    teamCount: plan.teamsSnap.size,
    storyCount: plan.storyCount,
    registeredUsers: plan.registeredUsers,
    deletableUserCount: plan.registeredUsers.filter((user) => user.canDeleteProfile).length,
    sharedUserCount: plan.registeredUsers.filter((user) => !user.canDeleteProfile).length,
    estimatedDeleteCount: Array.from(new Set(plan.deletionPaths)).length,
  }
}

export async function deleteOrganizationWithCleanupDirect(
  orgId: string,
  options: { deleteRegisteredUsers: boolean },
): Promise<DeleteOrganizationResult> {
  const plan = await collectOrganizationDeletionPlan(orgId, options.deleteRegisteredUsers)

  for (const userUpdate of plan.userUpdates) {
    await updateDoc(doc(db, 'users', userUpdate.userId), {
      currentOrgId: userUpdate.nextCurrentOrgId,
    })
  }

  const deletedCount = await deletePaths(plan.deletionPaths)

  return {
    deletedCount,
    deletedUserCount: plan.deletedUserCount,
    skippedUserCount: plan.skippedUserCount,
  }
}
