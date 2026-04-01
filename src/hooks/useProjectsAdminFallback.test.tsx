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

describe('useProjects admin role fallback', () => {
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
      memberships: [{ id: 'org-1', orgName: 'Webtown Test Organisation', role: 'admin' }] as never,
      membershipsLoaded: true,
      orgRole: null,
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

  it('loads all projects when membership role already marks the user as admin', async () => {
    subscribeToProjectsMock.mockImplementation((_orgId, callback) => {
      callback([{ id: 'project-1', name: 'Alpha', status: 'active' }])
      return vi.fn()
    })

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(subscribeToProjectsMock).toHaveBeenCalledWith('org-1', expect.any(Function), expect.any(Function))
    expect(result.current.projects).toHaveLength(1)
  })
})
