import { beforeEach, describe, expect, it, vi } from 'vitest'

const callableMock = vi.fn()
const listOrganizationsForPlatformAdminDirectMock = vi.fn()
const findUserFootprintByEmailDirectMock = vi.fn()
const detachUserFromOrganizationDirectMock = vi.fn()
const hardDeleteUserFootprintDirectMock = vi.fn()
const deleteAuthUserDirectMock = vi.fn()
const listAuditLogsDirectMock = vi.fn()
const previewOrganizationDeletionDirectMock = vi.fn()
const deleteOrganizationWithCleanupDirectMock = vi.fn()

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => callableMock),
}))

vi.mock('@/config/firebase', () => ({
  functions: {},
}))

vi.mock('@/services/platformAdmin.firestore', () => ({
  listOrganizationsForPlatformAdminDirect: (...args: unknown[]) => listOrganizationsForPlatformAdminDirectMock(...args),
  findUserFootprintByEmailDirect: (...args: unknown[]) => findUserFootprintByEmailDirectMock(...args),
  detachUserFromOrganizationDirect: (...args: unknown[]) => detachUserFromOrganizationDirectMock(...args),
  hardDeleteUserFootprintDirect: (...args: unknown[]) => hardDeleteUserFootprintDirectMock(...args),
  deleteAuthUserDirect: (...args: unknown[]) => deleteAuthUserDirectMock(...args),
  listAuditLogsDirect: (...args: unknown[]) => listAuditLogsDirectMock(...args),
  previewOrganizationDeletionDirect: (...args: unknown[]) => previewOrganizationDeletionDirectMock(...args),
  deleteOrganizationWithCleanupDirect: (...args: unknown[]) => deleteOrganizationWithCleanupDirectMock(...args),
}))

describe('platformAdmin.service callable fallback', () => {
  beforeEach(() => {
    callableMock.mockReset()
    listOrganizationsForPlatformAdminDirectMock.mockReset()
    findUserFootprintByEmailDirectMock.mockReset()
    detachUserFromOrganizationDirectMock.mockReset()
    hardDeleteUserFootprintDirectMock.mockReset()
    deleteAuthUserDirectMock.mockReset()
    listAuditLogsDirectMock.mockReset()
    previewOrganizationDeletionDirectMock.mockReset()
    deleteOrganizationWithCleanupDirectMock.mockReset()
  })

  it('uses callable result for footprint lookups when backend is available', async () => {
    const footprint = { email: 'dev@webtown.hu', userId: 'user-1', hits: [], warnings: [] }
    callableMock.mockResolvedValue({ data: footprint })

    const { findUserFootprintByEmail } = await import('@/services/platformAdmin.service')
    const result = await findUserFootprintByEmail(' DEV@WEBTOWN.HU ')

    expect(callableMock).toHaveBeenCalledWith({ email: 'dev@webtown.hu' })
    expect(result).toEqual(footprint)
    expect(findUserFootprintByEmailDirectMock).not.toHaveBeenCalled()
  })

  it('falls back to direct Firestore deletion when callable backend is unavailable', async () => {
    callableMock.mockRejectedValue({ code: 'functions/unavailable' })
    deleteOrganizationWithCleanupDirectMock.mockResolvedValue({
      deletedCount: 12,
      deletedUserCount: 1,
      skippedUserCount: 0,
    })

    const { deleteOrganizationWithCleanup } = await import('@/services/platformAdmin.service')
    const result = await deleteOrganizationWithCleanup('org-1', { deleteRegisteredUsers: true })

    expect(deleteOrganizationWithCleanupDirectMock).toHaveBeenCalledWith('org-1', { deleteRegisteredUsers: true })
    expect(result.deletedCount).toBe(12)
  })

  it('does not swallow non-availability callable errors', async () => {
    callableMock.mockRejectedValue({ code: 'functions/permission-denied' })

    const { previewOrganizationDeletion } = await import('@/services/platformAdmin.service')

    await expect(previewOrganizationDeletion('org-1')).rejects.toMatchObject({
      code: 'functions/permission-denied',
    })
    expect(previewOrganizationDeletionDirectMock).not.toHaveBeenCalled()
  })

  it('loads audit logs through the callable when available', async () => {
    callableMock.mockResolvedValue({
      data: [
        {
          action: 'delete_organization',
          actorUid: 'admin-1',
          actorEmail: 'admin@webtown.hu',
          targetType: 'organization',
          targetId: 'org-1',
          metadata: {},
        },
      ],
    })

    const { listAuditLogs } = await import('@/services/platformAdmin.service')
    const result = await listAuditLogs(10)

    expect(callableMock).toHaveBeenCalledWith({ limit: 10 })
    expect(result).toHaveLength(1)
  })

  it('does not fall back for auth user deletion when backend is unavailable', async () => {
    callableMock.mockRejectedValue({ code: 'functions/unavailable' })
    deleteAuthUserDirectMock.mockRejectedValue(new Error('Az Auth user törléséhez backend callable function szükséges.'))

    const { deleteAuthUserByEmail } = await import('@/services/platformAdmin.service')

    await expect(deleteAuthUserByEmail('dev@webtown.hu')).rejects.toThrow('backend callable function')
  })
})
