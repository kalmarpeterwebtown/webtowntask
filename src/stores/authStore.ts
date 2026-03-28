import { create } from 'zustand'
import type { User as FirebaseUser } from 'firebase/auth'
import type { User } from '@/types/models'
import type { OrgRole } from '@/types/enums'

export interface AuthClaims {
  orgId?: string
  orgRole?: OrgRole
}

interface AuthState {
  firebaseUser: FirebaseUser | null
  userProfile: User | null
  claims: AuthClaims
  loading: boolean
  initialized: boolean

  setFirebaseUser: (user: FirebaseUser | null) => void
  setUserProfile: (profile: User | null) => void
  setClaims: (claims: AuthClaims) => void
  setLoading: (loading: boolean) => void
  setInitialized: (initialized: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  userProfile: null,
  claims: {},
  loading: true,
  initialized: false,

  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setUserProfile: (profile) => set({ userProfile: profile }),
  setClaims: (claims) => set({ claims }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  reset: () => set({
    firebaseUser: null,
    userProfile: null,
    claims: {},
    loading: false,
  }),
}))
