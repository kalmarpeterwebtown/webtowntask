import type { OrgRole, AccessLevel } from '@/types/enums'

export function isOrgAdmin(role: OrgRole | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

export function hasAccess(
  userAccess: AccessLevel | undefined,
  required: AccessLevel,
): boolean {
  if (!userAccess) return false
  const levels: AccessLevel[] = ['read', 'write', 'manage']
  return levels.indexOf(userAccess) >= levels.indexOf(required)
}

export function canWrite(access: AccessLevel | undefined): boolean {
  return hasAccess(access, 'write')
}

export function canManage(access: AccessLevel | undefined): boolean {
  return hasAccess(access, 'manage')
}
