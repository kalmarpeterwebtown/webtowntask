import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlatformAdminHandlers, type PlatformAdminRepository } from './handlers.js'
import type { PlatformUserFootprint } from './contracts.js'

function createRepositoryMock(): PlatformAdminRepository {
  return {
    findUserFootprintByEmail: vi.fn(),
    listAuditLogs: vi.fn(),
    detachUserFromOrganization: vi.fn(),
    hardDeleteUserFootprint: vi.fn(),
    deleteAuthUser: vi.fn(),
    previewOrganizationDeletion: vi.fn(),
    deleteOrganization: vi.fn(),
    writeAuditLog: vi.fn(),
  }
}

const superAdminAuth = {
  uid: 'admin-1',
  rawToken: 'token',
  token: {
    email: 'admin@webtown.hu',
    platformRole: 'super_admin',
  },
} as never

function createCallableRequest<T>(data: T, auth = superAdminAuth) {
  return {
    data,
    auth,
    rawRequest: {} as never,
    acceptsStreaming: false,
  } as never
}

describe('platform admin handlers', () => {
  let repository: PlatformAdminRepository
  let handlers: ReturnType<typeof createPlatformAdminHandlers>

  beforeEach(() => {
    repository = createRepositoryMock()
    handlers = createPlatformAdminHandlers(repository)
  })

  it('rejects footprint reads for non-super-admin users', async () => {
    await expect(handlers.findUserFootprint(createCallableRequest(
      { email: 'dev@webtown.hu' },
      {
        uid: 'user-1',
        token: { platformRole: 'standard' },
        rawToken: 'token',
      } as never,
    ))).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  it('normalizes email when finding a user footprint', async () => {
    const footprint: PlatformUserFootprint = {
      email: 'dev@webtown.hu',
      userId: 'user-1',
      hits: [],
      warnings: [],
    }
    vi.mocked(repository.findUserFootprintByEmail).mockResolvedValue(footprint)

    const result = await handlers.findUserFootprint(createCallableRequest({ email: ' DEV@WEBTOWN.HU ' }))

    expect(repository.findUserFootprintByEmail).toHaveBeenCalledWith('dev@webtown.hu')
    expect(result).toEqual(footprint)
  })

  it('lists recent audit logs for super admins', async () => {
    vi.mocked(repository.listAuditLogs).mockResolvedValue([
      {
        action: 'delete_organization',
        actorUid: 'admin-1',
        actorEmail: 'admin@webtown.hu',
        targetType: 'organization',
        targetId: 'org-1',
        metadata: {},
      },
    ])

    const result = await handlers.listAuditLogs(createCallableRequest({ limit: 10 }))

    expect(repository.listAuditLogs).toHaveBeenCalledWith(10)
    expect(result).toHaveLength(1)
  })

  it('writes an audit log when deleting an organization', async () => {
    vi.mocked(repository.deleteOrganization).mockResolvedValue({
      deletedCount: 42,
      deletedUserCount: 2,
      skippedUserCount: 1,
    })

    const result = await handlers.deleteOrganization(createCallableRequest({
        orgId: 'org-1',
        deleteRegisteredUsers: true,
      }))

    expect(result.deletedCount).toBe(42)
    expect(repository.deleteOrganization).toHaveBeenCalledWith('org-1', true)
    expect(repository.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'delete_organization',
      actorUid: 'admin-1',
      targetType: 'organization',
      targetId: 'org-1',
      metadata: expect.objectContaining({
        deleteRegisteredUsers: true,
        deletedCount: 42,
      }),
    }))
  })

  it('writes an audit log when detaching a user from an organization', async () => {
    vi.mocked(repository.detachUserFromOrganization).mockResolvedValue({ deletedCount: 5 })

    await handlers.detachUserFromOrganization(createCallableRequest({
        email: ' Test@Example.com ',
        orgId: 'org-42',
      }))

    expect(repository.detachUserFromOrganization).toHaveBeenCalledWith('test@example.com', 'org-42')
    expect(repository.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'detach_user_from_organization',
      targetEmail: 'test@example.com',
      orgId: 'org-42',
    }))
  })

  it('writes an audit log when deleting an auth user', async () => {
    vi.mocked(repository.deleteAuthUser).mockResolvedValue({ deletedAuthUser: true })

    const result = await handlers.deleteAuthUser(createCallableRequest({
      email: 'someone@webtown.hu',
    }))

    expect(result.deletedAuthUser).toBe(true)
    expect(repository.deleteAuthUser).toHaveBeenCalledWith('someone@webtown.hu')
    expect(repository.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'delete_auth_user',
      targetEmail: 'someone@webtown.hu',
    }))
  })

  it('validates required organization id for preview', async () => {
    await expect(handlers.previewOrganizationDeletion(createCallableRequest({ orgId: '   ' }))).rejects.toMatchObject({
      code: 'invalid-argument',
    })
  })
})
