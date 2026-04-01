import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useProjectAccessMap } from '@/hooks/useAccess'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'

const onSnapshotMock = vi.fn()

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore')
  return {
    ...actual,
    onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
  }
})

describe('useProjectAccessMap', () => {
  beforeEach(() => {
    onSnapshotMock.mockReset()

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

  it('keeps projects visible for admins resolved from membership fallback', async () => {
    const projects = [
      { id: 'project-1', name: 'Alpha', status: 'active' },
      { id: 'project-2', name: 'Beta', status: 'active' },
    ] as never

    const { result } = renderHook(() => useProjectAccessMap(projects))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(onSnapshotMock).not.toHaveBeenCalled()
    expect(result.current.projects.map((project) => project.id)).toEqual(['project-1', 'project-2'])
    expect(result.current.accessByProjectId).toMatchObject({
      'project-1': 'manage',
      'project-2': 'manage',
    })
  })
})
