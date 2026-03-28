import { create } from 'zustand'
import type { Organization, OrgMembership } from '@/types/models'

interface OrgState {
  currentOrg: Organization | null
  memberships: OrgMembership[]
  loading: boolean

  setCurrentOrg: (org: Organization | null) => void
  setMemberships: (memberships: OrgMembership[]) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useOrgStore = create<OrgState>((set) => ({
  currentOrg: null,
  memberships: [],
  loading: false,

  setCurrentOrg: (org) => set({ currentOrg: org }),
  setMemberships: (memberships) => set({ memberships }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ currentOrg: null, memberships: [], loading: false }),
}))
