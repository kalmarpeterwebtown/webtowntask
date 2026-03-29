import { useState } from 'react'
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth'
import { updateDoc, serverTimestamp } from 'firebase/firestore'
import { Check, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { auth } from '@/config/firebase'
import { userRef } from '@/utils/firestore'

export function ProfilePage() {
  const { userProfile, firebaseUser } = useAuthStore()
  const { currentOrg, orgRole } = useOrgStore()

  const [displayName, setDisplayName] = useState(userProfile?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

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
    client: 'Kliens',
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
        {resetSent ? (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            Jelszó-visszaállítási emailt küldtük a <strong>{firebaseUser?.email}</strong> címre.
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Küldünk egy emailt, amellyel új jelszót állíthatsz be.
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
      </section>
    </div>
  )
}
