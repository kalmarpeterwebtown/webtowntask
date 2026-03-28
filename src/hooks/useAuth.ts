import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { auth } from '@/config/firebase'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { userRef, orgRef } from '@/utils/firestore'
import type { User } from '@/types/models'
import type { AuthClaims } from '@/stores/authStore'
import type { Organization } from '@/types/models'

export function useAuthInit() {
  const { setFirebaseUser, setUserProfile, setClaims, setLoading, setInitialized } = useAuthStore()
  const { setCurrentOrg } = useOrgStore()

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser)

      if (!firebaseUser) {
        setUserProfile(null)
        setClaims({})
        setCurrentOrg(null)
        setLoading(false)
        setInitialized(true)
        return
      }

      // Custom claims lekérése
      const idTokenResult = await firebaseUser.getIdTokenResult()
      const claims: AuthClaims = {
        orgId:   idTokenResult.claims['orgId'] as string | undefined,
        orgRole: idTokenResult.claims['orgRole'] as AuthClaims['orgRole'],
      }
      setClaims(claims)

      // User profil realtime figyelés
      const unsubUser = onSnapshot(userRef(firebaseUser.uid), (snap) => {
        if (snap.exists()) {
          setUserProfile({ id: snap.id, ...snap.data() } as User)
        }
        setLoading(false)
        setInitialized(true)
      })

      // Jelenlegi org betöltése
      if (claims.orgId) {
        onSnapshot(orgRef(claims.orgId), (snap) => {
          if (snap.exists()) {
            setCurrentOrg({ id: snap.id, ...snap.data() } as Organization)
          }
        })
      } else {
        setLoading(false)
        setInitialized(true)
      }

      return () => unsubUser()
    })

    return () => unsubAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export function useAuth() {
  return useAuthStore()
}
