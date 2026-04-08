import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useProjects } from '@/hooks/useProjects'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'

const subscribeToProjectsMock = vi.fn()
const subscribeProjectsByIdsMock = vi.fn()
const subscribeToCurrentUserProjectIdsMock = vi.fn()

vi.mock('@/services/project.service', () => ({
  subscribeToProjects: (...args: unknown[]) => subscribeToProjectsMock(...args),
  subscribeProjectsByIds: (...args: unknown[]) => subscribeProjectsByIdsMock(...args),
}))

vi.mock('@/services/access.service', () => ({
  subscribeToCurrentUserProjectIds: (...args: unknown[]) => subscribeToCurrentUserProjectIdsMock(...args),
}))

describe('useProjects', () => {
  beforeEach(() => {
    subscribeToProjectsMock.mockReset()
    subscribeProjectsByIdsMock.mockReset()
    subscribeToCurrentUserProjectIdsMock.mockReset()

    useAuthStore.setState({
      firebaseUser: { uid: 'user-1' } as never,
      userProfile: null,
      claims: {},
      loading: false,
      initialized: true,
    })
    useOrgStore.setState({
      currentOrg: { id: 'org-1', name: 'Webtown Test Organisation', slug: 'webtown-test' } as never,
      memberships: [{ orgId: 'org-1' }] as never,
      membershipsLoaded: true,
      orgRole: 'standard',
      loading: false,
    })
  })

  afterEach(() => {
    useAuthStore.setState({
      firebaseUser: null,
      userProfile: null,
      claims: {},
      loading: false,
      initialized: true,
    })
    useOrgStore.getState().reset()
  })

  it('loads all projects directly for org admins', async () => {
    subscribeToProjectsMock.mockImplementation((_orgId, callback) => {
      callback([{ id: 'project-1', name: 'Alpha', status: 'active' }])
      return vi.fn()
    })
    useOrgStore.setState({ orgRole: 'admin' })

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(subscribeToProjectsMock).toHaveBeenCalledWith('org-1', expect.any(Function), expect.any(Function))
    expect(result.current.projects).toHaveLength(1)
  })

  it('treats membership role fallback as admin when orgRole is still null', async () => {
    subscribeToProjectsMock.mockImplementation((_orgId, callback) => {
      callback([{ id: 'project-1', name: 'Alpha', status: 'active' }])
      return vi.fn()
    })
    useOrgStore.setState({
      orgRole: null,
      memberships: [{ id: 'org-1', orgName: 'Webtown Test Organisation', role: 'admin' }] as never,
    })

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(subscribeToProjectsMock).toHaveBeenCalledWith('org-1', expect.any(Function), expect.any(Function))
    expect(result.current.projects).toHaveLength(1)
  })

  it('loads only assigned projects for scoped users', async () => {
    const membershipUnsub = vi.fn()
    const projectUnsub = vi.fn()

    subscribeToCurrentUserProjectIdsMock.mockImplementation((_orgId, _userId, callback) => {
      callback(['project-2', 'project-3'])
      return membershipUnsub
    })
    subscribeProjectsByIdsMock.mockImplementation((_orgId, projectIds, callback) => {
      callback(projectIds.map((id: string) => ({ id, name: `Project ${id}`, status: 'active' })))
      return projectUnsub
    })

    const { result, unmount } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(subscribeToCurrentUserProjectIdsMock).toHaveBeenCalledWith('org-1', 'user-1', expect.any(Function))
    expect(subscribeProjectsByIdsMock).toHaveBeenCalledWith(
      'org-1',
      ['project-2', 'project-3'],
      expect.any(Function),
      expect.any(Function),
    )
    expect(result.current.projects.map((project) => project.id)).toEqual(['project-2', 'project-3'])

    unmount()
    expect(projectUnsub).toHaveBeenCalled()
    expect(membershipUnsub).toHaveBeenCalled()
  })

  it('surfaces a readable error when scoped project loading fails', async () => {
    subscribeToCurrentUserProjectIdsMock.mockImplementation((_orgId, _userId, callback) => {
      callback(['project-2'])
      return vi.fn()
    })
    subscribeProjectsByIdsMock.mockImplementation((_orgId, _projectIds, _callback, onError) => {
      onError?.(new Error('permission-denied'))
      return vi.fn()
    })

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('A projektek betöltése átmenetileg nem sikerült.')
    expect(result.current.projects).toEqual([])
  })
})
