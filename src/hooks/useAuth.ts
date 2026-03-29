import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot, doc } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { userRef, orgRef } from '@/utils/firestore'
import type { User, Organization } from '@/types/models'
import type { OrgRole } from '@/types/enums'
import type { AuthClaims } from '@/stores/authStore'

export function useAuthInit() {
  const { setFirebaseUser, setUserProfile, setClaims, setLoading, setInitialized } = useAuthStore()
  const { setCurrentOrg, setOrgRole, setLoading: setOrgLoading } = useOrgStore()

  useEffect(() => {
    let unsubOrg: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser)

      if (!firebaseUser) {
        setUserProfile(null)
        setClaims({})
        setCurrentOrg(null)
        setLoading(false)
        setInitialized(true)
        unsubOrg?.()
        return
      }

      // Custom claims lekérése (Cloud Function állítja be, ha már létezik)
      const idTokenResult = await firebaseUser.getIdTokenResult()
      const claims: AuthClaims = {
        orgId:   idTokenResult.claims['orgId'] as string | undefined,
        orgRole: idTokenResult.claims['orgRole'] as AuthClaims['orgRole'],
      }
      setClaims(claims)

      // User profil realtime figyelés
      const unsubUser = onSnapshot(userRef(firebaseUser.uid), (snap) => {
        if (snap.exists()) {
          const profileData = { id: snap.id, ...snap.data() } as User
          setUserProfile(profileData)

          // Org betöltése: custom claim → user profil currentOrgId fallback
          const resolvedOrgId = claims.orgId ?? profileData.currentOrgId
          if (resolvedOrgId && !unsubOrg) {
            setOrgLoading(true)
            unsubOrg = onSnapshot(orgRef(resolvedOrgId), (orgSnap) => {
              if (orgSnap.exists()) {
                setCurrentOrg({ id: orgSnap.id, ...orgSnap.data() } as Organization)
              } else {
                setCurrentOrg(null)
              }
              setOrgLoading(false)
            })

            // Load user's role from Firestore member doc (no Cloud Functions needed)
            const memberRef = doc(db, 'organizations', resolvedOrgId, 'members', firebaseUser.uid)
            onSnapshot(memberRef, (snap) => {
              if (snap.exists()) {
                setOrgRole(snap.data().role as OrgRole)
              } else {
                setOrgRole(null)
              }
            })
          } else if (!resolvedOrgId) {
            setCurrentOrg(null)
            setOrgRole(null)
            setOrgLoading(false)
          }
        }
        setLoading(false)
        setInitialized(true)
      })

      return () => {
        unsubUser()
        unsubOrg?.()
      }
    })

    return () => {
      unsubAuth()
      unsubOrg?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export function useAuth() {
  return useAuthStore()
}
