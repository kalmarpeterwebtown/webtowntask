import { describe, expect, it } from 'vitest'
import { canManage, canWrite, hasAccess, isOrgAdmin } from '@/utils/permissions'

describe('permissions utils', () => {
  it('recognizes organization admins correctly', () => {
    expect(isOrgAdmin('owner')).toBe(true)
    expect(isOrgAdmin('admin')).toBe(true)
    expect(isOrgAdmin('standard')).toBe(false)
    expect(isOrgAdmin('client')).toBe(false)
    expect(isOrgAdmin(undefined)).toBe(false)
  })

  it('compares access levels in ascending strength order', () => {
    expect(hasAccess('manage', 'read')).toBe(true)
    expect(hasAccess('write', 'read')).toBe(true)
    expect(hasAccess('read', 'write')).toBe(false)
    expect(hasAccess(undefined, 'read')).toBe(false)
  })

  it('provides convenient write and manage guards', () => {
    expect(canWrite('write')).toBe(true)
    expect(canWrite('manage')).toBe(true)
    expect(canWrite('read')).toBe(false)

    expect(canManage('manage')).toBe(true)
    expect(canManage('write')).toBe(false)
    expect(canManage(undefined)).toBe(false)
  })
})
