import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { AuthShell } from './LoginPage'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { ROUTES } from '@/config/constants'
import type { Invitation } from '@/types/models'

type PageStatus = 'loading' | 'valid' | 'invalid' | 'accepting' | 'accepted' | 'error'

export function InvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const orgId = params.get('orgId')
  const { firebaseUser } = useAuthStore()
  const { setCurrentOrg } = useOrgStore()

  const [status, setStatus] = useState<PageStatus>('loading')
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token || !orgId) {
      setStatus('invalid')
      return
    }

    async function loadInvitation() {
      try {
        const invRef = doc(db, 'organizations', orgId!, 'invitations', token!)
        const snap = await getDoc(invRef)
        if (!snap.exists()) {
          setStatus('invalid')
          return
        }
        const inv = { id: snap.id, ...snap.data() } as Invitation
        if (inv.status !== 'pending') {
          setStatus('invalid')
          return
        }
        const now = new Date()
        const expires = inv.expiresAt instanceof Date
          ? inv.expiresAt
          : (inv.expiresAt as { toDate?: () => Date })?.toDate?.() ?? new Date(0)
        if (expires < now) {
          setStatus('invalid')
          return
        }
        setInvitation(inv)
        setStatus('valid')
      } catch {
        setStatus('invalid')
      }
    }

    loadInvitation()
  }, [token, orgId])

  const handleAccept = async () => {
    if (!firebaseUser) {
      const redirectTo = encodeURIComponent(`/invite?token=${token}&orgId=${orgId}`)
      navigate(`${ROUTES.LOGIN}?redirect=${redirectTo}`)
      return
    }
    if (!invitation || !orgId || !token) return

    setStatus('accepting')
    try {
      // 1. Create member doc (Firestore rule validates invitationToken + email match)
      await setDoc(
        doc(db, 'organizations', orgId, 'members', firebaseUser.uid),
        {
          userId: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName ?? firebaseUser.email ?? 'Felhasználó',
          role: invitation.orgRole,
          joinedAt: serverTimestamp(),
          invitationToken: token, // used by Firestore rules to validate
        },
      )

      // 2. Mark invitation as accepted
      await updateDoc(doc(db, 'organizations', orgId, 'invitations', token), {
        status: 'accepted',
      })

      // 3. Update user profile with currentOrgId
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        currentOrgId: orgId,
        updatedAt: serverTimestamp(),
      })

      // 4. Load the org into store so OrgGuard passes
      const orgSnap = await getDoc(doc(db, 'organizations', orgId))
      if (orgSnap.exists()) {
        setCurrentOrg({ id: orgSnap.id, ...orgSnap.data() } as Parameters<typeof setCurrentOrg>[0])
      }

      setStatus('accepted')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ismeretlen hiba')
      setStatus('error')
    }
  }

  if (status === 'loading') {
    return (
      <AuthShell title="Meghívó ellenőrzése" subtitle="">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      </AuthShell>
    )
  }

  if (status === 'invalid') {
    return (
      <AuthShell title="Érvénytelen meghívó" subtitle="">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <XCircle className="h-12 w-12 text-red-400" />
          <p className="text-sm text-gray-600">
            Ez a meghívó link lejárt vagy érvénytelen.
            Kérd meg az adminisztrátort, hogy küldjön új meghívót.
          </p>
          <Link to={ROUTES.LOGIN} className="text-sm text-primary-600 hover:underline">
            Vissza a bejelentkezéshez
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (status === 'accepted') {
    return (
      <AuthShell title="Sikeresen csatlakoztál!" subtitle={invitation?.orgName ?? ''}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <p className="text-sm text-gray-600">
            Üdvözlünk a <strong>{invitation?.orgName}</strong> szervezetben!
          </p>
          <Button onClick={() => navigate(ROUTES.DASHBOARD, { replace: true })}>
            Ugrás az áttekintőre
          </Button>
        </div>
      </AuthShell>
    )
  }

  if (status === 'error') {
    return (
      <AuthShell title="Hiba" subtitle="">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <XCircle className="h-12 w-12 text-red-400" />
          <p className="text-sm text-gray-600">{errorMsg}</p>
          <button onClick={() => setStatus('valid')} className="text-sm text-primary-600 hover:underline">
            Újrapróbálás
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Meghívó elfogadása" subtitle={invitation?.orgName ?? ''}>
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-600">
          Meghívtak a <strong>{invitation?.orgName}</strong> szervezetbe.
        </p>
        {!firebaseUser && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            A meghívó elfogadásához be kell jelentkezned vagy regisztrálnod kell.
          </p>
        )}
        {firebaseUser && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Bejelentkezve: <strong>{firebaseUser.email}</strong>
          </p>
        )}
        <Button
          className="w-full"
          loading={status === 'accepting'}
          onClick={handleAccept}
        >
          {firebaseUser ? 'Meghívó elfogadása' : 'Bejelentkezés és elfogadás'}
        </Button>
        <Link
          to={ROUTES.LOGIN}
          className="block text-sm text-gray-500 hover:text-gray-700"
        >
          Mégsem
        </Link>
      </div>
    </AuthShell>
  )
}
