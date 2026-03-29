import { useMemo, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { CheckCircle, LogOut, XCircle } from 'lucide-react'
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { AuthShell } from './LoginPage'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { ROUTES } from '@/config/constants'
import { signOut } from '@/services/auth.service'
import type { Invitation } from '@/types/models'

type PageStatus = 'valid' | 'invalid' | 'accepting' | 'accepted' | 'error'

function extractInviteParam(name: 'token' | 'orgId', params: URLSearchParams, fallbackParams: URLSearchParams) {
  const directValue = params.get(name) ?? fallbackParams.get(name)
  if (directValue) return directValue

  const href = window.location.href
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = href.match(new RegExp(`[?&#]${escapedName}=([^&#]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function InvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const fallbackParams = useMemo(() => {
    const hash = window.location.hash
    const queryIndex = hash.indexOf('?')
    if (queryIndex === -1) return new URLSearchParams(window.location.search)
    return new URLSearchParams(hash.slice(queryIndex + 1))
  }, [])
  const token = extractInviteParam('token', params, fallbackParams)
  const orgId = extractInviteParam('orgId', params, fallbackParams)
  const hasValidParams = Boolean(token && orgId)
  const { firebaseUser } = useAuthStore()
  const { setCurrentOrg } = useOrgStore()

  const [status, setStatus] = useState<PageStatus>(hasValidParams ? 'valid' : 'invalid')
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleAccept = async () => {
    if (!firebaseUser) {
      const redirectTo = encodeURIComponent(`/invite?token=${token}&orgId=${orgId}`)
      navigate(`${ROUTES.LOGIN}?redirect=${redirectTo}`)
      return
    }
    if (!orgId || !token) return

    setStatus('accepting')
    try {
      const invRef = doc(db, 'organizations', orgId, 'invitations', token)
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

      const inviteEmail = inv.email.trim().toLowerCase()
      const userEmail = (firebaseUser.email ?? '').trim().toLowerCase()
      if (inviteEmail && userEmail && inviteEmail !== userEmail) {
        setErrorMsg('A meghívó másik email címhez tartozik. Jelentkezz be a megfelelő fiókkal.')
        setStatus('error')
        return
      }

      setInvitation(inv)

      // 1. Add the user to the org first.
      await setDoc(
        doc(db, 'organizations', orgId, 'members', firebaseUser.uid),
        {
          userId: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName ?? firebaseUser.email ?? 'Felhasználó',
          role: inv.orgRole,
          joinedAt: serverTimestamp(),
          invitationToken: token, // used by Firestore rules to validate
        },
      )

      // 2. Persist org selection on the user profile.
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        email: firebaseUser.email ?? '',
        displayName: firebaseUser.displayName ?? firebaseUser.email ?? 'Felhasználó',
        photoUrl: firebaseUser.photoURL ?? null,
        currentOrgId: orgId,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true })

      await setDoc(doc(db, 'users', firebaseUser.uid, 'orgMemberships', orgId), {
        orgName: inv.orgName,
        role: inv.orgRole,
        joinedAt: serverTimestamp(),
      }, { merge: true })

      // 3. Mark the invitation as accepted. If this fails, the user can still enter via membership fallback.
      try {
        await updateDoc(invRef, {
          status: 'accepted',
        })
      } catch (invitationError) {
        console.warn('Invitation status update failed after successful join:', invitationError)
      }

      // 4. Load the org into store so OrgGuard passes
      const orgSnap = await getDoc(doc(db, 'organizations', orgId))
      if (orgSnap.exists()) {
        setCurrentOrg({ id: orgSnap.id, ...orgSnap.data() } as Parameters<typeof setCurrentOrg>[0])
      }

      setStatus('accepted')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba'
      if (message.toLowerCase().includes('permission')) {
        setErrorMsg('A meghívó ellenőrzése nem sikerült. Valószínűleg nem a meghívott email címmel vagy bejelentkezve.')
      } else {
        setErrorMsg(message)
      }
      setStatus('error')
    }
  }

  const handleSwitchAccount = async () => {
    setErrorMsg('')
    setInvitation(null)
    await signOut()
    navigate(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(`/invite?token=${token}&orgId=${orgId}`)}`, {
      replace: true,
    })
  }

  if (!hasValidParams || status === 'invalid') {
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
          {invitation?.orgName
            ? <>Meghívtak a <strong>{invitation.orgName}</strong> szervezetbe.</>
            : 'A meghívó elfogadásához jelentkezz be ugyanazzal az email címmel, amire a meghívó érkezett.'}
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
        {firebaseUser && (
          <Button
            variant="outline"
            className="w-full"
            icon={<LogOut className="h-4 w-4" />}
            onClick={handleSwitchAccount}
          >
            Kijelentkezés és másik fiók
          </Button>
        )}
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
