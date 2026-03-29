import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot, doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { userRef, orgRef, orgMembershipsRef } from '@/utils/firestore'
import type { User, Organization, OrgMembership } from '@/types/models'
import type { OrgRole } from '@/types/enums'
import type { AuthClaims } from '@/stores/authStore'

export function useAuthInit() {
  const { setFirebaseUser, setUserProfile, setClaims, setLoading, setInitialized } = useAuthStore()
  const {
    setCurrentOrg,
    setMemberships,
    setMembershipsLoaded,
    setOrgRole,
    setLoading: setOrgLoading,
  } = useOrgStore()

  useEffect(() => {
    let unsubUser: (() => void) | undefined
    let unsubOrgMemberships: (() => void) | undefined
    let unsubOrg: (() => void) | undefined
    let unsubMember: (() => void) | undefined
    let activeOrgId: string | null = null
    let orgMemberships: OrgMembership[] = []

    const cleanupOrgSubscriptions = () => {
      unsubOrg?.()
      unsubMember?.()
      unsubOrg = undefined
      unsubMember = undefined
      activeOrgId = null
    }

    const activateOrg = (resolvedOrgId: string, firebaseUserId: string) => {
      if (activeOrgId === resolvedOrgId) return

      cleanupOrgSubscriptions()
      activeOrgId = resolvedOrgId
      setOrgLoading(true)

      unsubOrg = onSnapshot(orgRef(resolvedOrgId), (orgSnap) => {
        if (orgSnap.exists()) {
          setCurrentOrg({ id: orgSnap.id, ...orgSnap.data() } as Organization)
        } else {
          setCurrentOrg(null)
        }
        setOrgLoading(false)
      })

      const memberRef = doc(db, 'organizations', resolvedOrgId, 'members', firebaseUserId)
      unsubMember = onSnapshot(memberRef, (memberSnap) => {
        if (memberSnap.exists()) {
          setOrgRole(memberSnap.data().role as OrgRole)
        } else {
          setOrgRole(null)
        }
      })
    }

    const cleanupAllSubscriptions = () => {
      unsubUser?.()
      unsubUser = undefined
      unsubOrgMemberships?.()
      unsubOrgMemberships = undefined
      cleanupOrgSubscriptions()
    }

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      cleanupAllSubscriptions()
      setFirebaseUser(firebaseUser)

      if (!firebaseUser) {
        setUserProfile(null)
        setClaims({})
        setMemberships([])
        setMembershipsLoaded(false)
        setCurrentOrg(null)
        setOrgRole(null)
        setOrgLoading(false)
        setLoading(false)
        setInitialized(true)
        return
      }

      // Custom claims lekérése (Cloud Function állítja be, ha már létezik)
      const idTokenResult = await firebaseUser.getIdTokenResult()
      const claims: AuthClaims = {
        orgId:   idTokenResult.claims['orgId'] as string | undefined,
        orgRole: idTokenResult.claims['orgRole'] as AuthClaims['orgRole'],
      }
      setClaims(claims)

      unsubOrgMemberships = onSnapshot(
        orgMembershipsRef(firebaseUser.uid),
        { includeMetadataChanges: true },
        (snap) => {
          const waitingForServerConfirmation = snap.metadata.fromCache && snap.empty
          if (waitingForServerConfirmation) {
            return
          }

          orgMemberships = snap.docs.map((membershipDoc) => ({
            id: membershipDoc.id,
            ...membershipDoc.data(),
          } as OrgMembership))
          setMemberships(orgMemberships)
          setMembershipsLoaded(true)
          if (orgMemberships[0]?.id) {
            if (!activeOrgId) {
              activateOrg(orgMemberships[0].id, firebaseUser.uid)
            }

            const currentProfile = useAuthStore.getState().userProfile
            if (!currentProfile?.currentOrgId) {
              void setDoc(userRef(firebaseUser.uid), {
                currentOrgId: orgMemberships[0].id,
              }, { merge: true })
            }
          }
        },
        (error) => {
          console.error('orgMemberships subscription failed:', error)
          setMemberships([])
          setMembershipsLoaded(true)
        },
      )

      // User profil realtime figyelés
      unsubUser = onSnapshot(userRef(firebaseUser.uid), (snap) => {
        if (snap.exists()) {
          const profileData = { id: snap.id, ...snap.data() } as User
          setUserProfile(profileData)

          // Org betöltése: custom claim → user profil currentOrgId → memberships fallback
          const resolvedOrgId = claims.orgId ?? profileData.currentOrgId ?? orgMemberships[0]?.id
          if (resolvedOrgId) {
            activateOrg(resolvedOrgId, firebaseUser.uid)
            if (!profileData.currentOrgId) {
              void setDoc(userRef(firebaseUser.uid), {
                currentOrgId: resolvedOrgId,
              }, { merge: true })
            }
          } else if (!resolvedOrgId) {
            cleanupOrgSubscriptions()
            setCurrentOrg(null)
            setOrgRole(null)
            setOrgLoading(false)
          }
        } else {
          setUserProfile(null)
          setMemberships([])
          setMembershipsLoaded(false)
          cleanupOrgSubscriptions()
          setCurrentOrg(null)
          setOrgRole(null)
          setOrgLoading(false)
        }
        setLoading(false)
        setInitialized(true)
      })
    })

    return () => {
      cleanupAllSubscriptions()
      unsubAuth()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export function useAuth() {
  return useAuthStore()
}
