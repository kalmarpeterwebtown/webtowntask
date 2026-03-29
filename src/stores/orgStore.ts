import { create } from 'zustand'
import type { Organization, OrgMembership } from '@/types/models'
import type { OrgRole } from '@/types/enums'

interface OrgState {
  currentOrg: Organization | null
  memberships: OrgMembership[]
  membershipsLoaded: boolean
  /** Current user's role in the currentOrg, loaded from Firestore member doc */
  orgRole: OrgRole | null
  loading: boolean

  setCurrentOrg: (org: Organization | null) => void
  setMemberships: (memberships: OrgMembership[]) => void
  setMembershipsLoaded: (loaded: boolean) => void
  setOrgRole: (role: OrgRole | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useOrgStore = create<OrgState>((set) => ({
  currentOrg: null,
  memberships: [],
  membershipsLoaded: false,
  orgRole: null,
  loading: false,

  setCurrentOrg: (org) => set({ currentOrg: org }),
  setMemberships: (memberships) => set({ memberships }),
  setMembershipsLoaded: (loaded) => set({ membershipsLoaded: loaded }),
  setOrgRole: (role) => set({ orgRole: role }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({
    currentOrg: null,
    memberships: [],
    membershipsLoaded: false,
    orgRole: null,
    loading: false,
  }),
}))
