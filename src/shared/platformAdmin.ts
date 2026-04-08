export type PlatformOrganization = {
  id: string
  name: string
  slug: string
  plan: string
  memberCount: number
}

export type PlatformDocHitKind =
  | 'user'
  | 'orgMembership'
  | 'notification'
  | 'orgMember'
  | 'projectMembership'
  | 'teamMembership'
  | 'invitation'

export type PlatformDocHit = {
  id: string
  path: string
  kind: PlatformDocHitKind
  orgId?: string
  projectId?: string
  teamId?: string
  userId?: string
  email?: string
}

export type PlatformUserFootprint = {
  email: string
  userId: string | null
  hits: PlatformDocHit[]
  warnings: string[]
}

export type PlatformRegisteredUser = {
  userId: string
  email: string
  displayName: string
  otherOrgIds: string[]
  canDeleteProfile: boolean
}

export type PlatformOrganizationDeletionPreview = {
  orgId: string
  orgName: string
  memberCount: number
  invitationCount: number
  projectCount: number
  teamCount: number
  storyCount: number
  registeredUsers: PlatformRegisteredUser[]
  deletableUserCount: number
  sharedUserCount: number
  estimatedDeleteCount: number
}

export type DeleteOrganizationResult = {
  deletedCount: number
  deletedUserCount: number
  skippedUserCount: number
}

export type DeleteUserFootprintResult = {
  deletedCount: number
}

export type DetachUserFromOrganizationResult = {
  deletedCount: number
}

export type DeleteAuthUserResult = {
  deletedAuthUser: boolean
}

export type PlatformDeleteOrganizationRequest = {
  orgId: string
  deleteRegisteredUsers: boolean
}

export type PlatformPreviewOrganizationDeletionRequest = {
  orgId: string
}

export type PlatformFindUserFootprintRequest = {
  email: string
}

export type PlatformDeleteUserFootprintRequest = {
  email: string
}

export type PlatformDetachUserFromOrganizationRequest = {
  email: string
  orgId: string
}

export type PlatformDeleteAuthUserRequest = {
  email: string
}

export type PlatformListAuditLogsRequest = {
  limit?: number
}

export type PlatformAuditAction =
  | 'detach_user_from_organization'
  | 'hard_delete_user_footprint'
  | 'delete_auth_user'
  | 'delete_organization'

export type PlatformAuditLogEntry = {
  id?: string
  action: PlatformAuditAction
  actorUid: string
  actorEmail: string
  targetType: 'user' | 'organization'
  targetId: string
  targetEmail?: string
  orgId?: string
  metadata: Record<string, unknown>
  createdAt?: string
}

export const PLATFORM_ADMIN_CALLABLES = {
  findUserFootprint: 'platformAdminFindUserFootprint',
  detachUserFromOrganization: 'platformAdminDetachUserFromOrganization',
  hardDeleteUserFootprint: 'platformAdminHardDeleteUserFootprint',
  deleteAuthUser: 'platformAdminDeleteAuthUser',
  previewOrganizationDeletion: 'platformAdminPreviewOrganizationDeletion',
  deleteOrganization: 'platformAdminDeleteOrganization',
  listAuditLogs: 'platformAdminListAuditLogs',
} as const

export function normalizePlatformAdminEmail(email: string) {
  return email.trim().toLowerCase()
}
