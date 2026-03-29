import { useState } from 'react'
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth'
import { updateDoc, serverTimestamp } from 'firebase/firestore'
import { Check, KeyRound, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { auth } from '@/config/firebase'
import { userRef } from '@/utils/firestore'
import { changePassword } from '@/services/auth.service'

export function ProfilePage() {
  const { userProfile, firebaseUser } = useAuthStore()
  const { currentOrg, orgRole } = useOrgStore()

  const [displayName, setDisplayName] = useState(userProfile?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const handleSave = async () => {
    if (!firebaseUser || !displayName.trim()) return
    setSaving(true)
    try {
      await updateProfile(firebaseUser, { displayName: displayName.trim() })
      await updateDoc(userRef(firebaseUser.uid), {
        displayName: displayName.trim(),
        updatedAt: serverTimestamp(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!firebaseUser) return

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Minden jelszó mező kitöltése kötelező.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Az új jelszónak legalább 8 karakter hosszúnak kell lennie.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Az új jelszó és a megerősítés nem egyezik.')
      return
    }

    setPasswordError('')
    setPasswordSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSaved(true)
      setTimeout(() => setPasswordSaved(false), 2500)
    } catch (error) {
      const errorCode = typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : ''

      if (errorCode.includes('invalid-credential') || errorCode.includes('wrong-password')) {
        setPasswordError('A jelenlegi jelszó hibás.')
      } else if (errorCode.includes('too-many-requests')) {
        setPasswordError('Túl sok próbálkozás történt. Próbáld újra később.')
      } else {
        setPasswordError('A jelszó módosítása nem sikerült.')
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  const hasPasswordProvider = firebaseUser?.providerData.some((provider) => provider.providerId === 'password') ?? false

  const handleResetPassword = async () => {
    if (!firebaseUser?.email) return
    setResetLoading(true)
    try {
      await sendPasswordResetEmail(auth, firebaseUser.email)
      setResetSent(true)
    } finally {
      setResetLoading(false)
    }
  }

  const ROLE_LABELS: Record<string, string> = {
    owner: 'Tulajdonos',
    admin: 'Admin',
    standard: 'Standard',
    client: 'Ügyfél',
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Profilom</h1>

      {/* Avatar + info */}
      <section className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
        <Avatar name={userProfile?.displayName} src={userProfile?.photoUrl} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900 truncate">
            {userProfile?.displayName ?? '–'}
          </p>
          <p className="text-sm text-gray-500 truncate">{userProfile?.email}</p>
          {currentOrg && (
            <p className="mt-0.5 text-xs text-gray-400">
              {currentOrg.name}
              {orgRole && ` · ${ROLE_LABELS[orgRole] ?? orgRole}`}
            </p>
          )}
        </div>
      </section>

      {/* Edit name */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Megjelenített név</h2>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Teljes neved"
          className="max-w-sm"
        />
        <Button
          onClick={handleSave}
          loading={saving}
          variant={saved ? 'secondary' : 'primary'}
          className="gap-1.5"
          disabled={!displayName.trim()}
        >
          {saved ? <><Check className="h-4 w-4" /> Mentve</> : 'Mentés'}
        </Button>
      </section>

      {/* Password reset */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Jelszó</h2>
        {hasPasswordProvider ? (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <Input
              label="Jelenlegi jelszó"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Add meg a jelenlegi jelszót"
            />
            <Input
              label="Új jelszó"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Legalább 8 karakter"
            />
            <Input
              label="Új jelszó megerősítése"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Írd be újra az új jelszót"
            />

            {passwordError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {passwordError}
              </div>
            )}

            {passwordSaved && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                A jelszavad sikeresen frissült.
              </div>
            )}

            <Button
              onClick={handleChangePassword}
              loading={passwordSaving}
              icon={<KeyRound className="h-4 w-4" />}
            >
              Jelszó módosítása
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {resetSent ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                Jelszó-visszaállítási emailt küldtük a <strong>{firebaseUser?.email}</strong> címre.
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  Ennél a fióknál közvetlen jelszóváltás helyett emailes visszaállítás érhető el.
                </p>
                <Button
                  variant="outline"
                  loading={resetLoading}
                  icon={<Mail className="h-4 w-4" />}
                  onClick={handleResetPassword}
                >
                  Jelszó-visszaállítási email küldése
                </Button>
              </>
            )}
          </div>
        )}

        {!hasPasswordProvider && !resetSent && (
          <>
            <p className="text-sm text-gray-500">
              Ha később email/jelszó alapú belépést is használsz, itt közvetlen módosítás is elérhető lesz.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
