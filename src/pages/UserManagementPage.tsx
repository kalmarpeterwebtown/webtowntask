import { useState, useEffect } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { UserPlus, Crown, Shield, User, Users, Copy, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { useOrgStore } from '@/stores/orgStore'
import { orgMembersRef, invitationsRef } from '@/utils/firestore'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import type { OrgRole } from '@/types/enums'

interface OrgMember {
  id: string
  displayName: string
  email: string
  role: OrgRole
  joinedAt: { toDate?: () => Date } | null
}

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Tulajdonos',
  admin: 'Admin',
  standard: 'Standard',
  client: 'Kliens',
}

const ROLE_ICONS: Record<OrgRole, React.ReactNode> = {
  owner:    <Crown className="h-3.5 w-3.5 text-yellow-500" />,
  admin:    <Shield className="h-3.5 w-3.5 text-blue-500" />,
  standard: <User className="h-3.5 w-3.5 text-gray-400" />,
  client:   <Users className="h-3.5 w-3.5 text-purple-400" />,
}

function generateToken() {
  return crypto.randomUUID()
}

export function UserManagementPage() {
  const { currentOrg } = useOrgStore()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'standard' | 'client'>('standard')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!currentOrg) return
    setLoadingMembers(true)
    const unsub = onSnapshot(orgMembersRef(currentOrg.id), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrgMember))
      setMembers(data)
      setLoadingMembers(false)
    })
    return unsub
  }, [currentOrg?.id])

  const handleInvite = async () => {
    if (!currentOrg || !inviteEmail.trim()) return
    setInviting(true)
    try {
      const token = generateToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      await setDoc(doc(invitationsRef(currentOrg.id), token), {
        email: inviteEmail.trim().toLowerCase(),
        orgId: currentOrg.id,
        orgName: currentOrg.name,
        orgRole: inviteRole,
        token,
        status: 'pending',
        invitedBy: '',
        invitedByName: '',
        expiresAt,
        createdAt: serverTimestamp(),
      })

      const baseUrl = window.location.origin + window.location.pathname
      setInviteLink(`${baseUrl}#/invite?token=${token}&orgId=${currentOrg.id}`)
      setInviteEmail('')
    } finally {
      setInviting(false)
    }
  }

  const handleCopy = async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseInvite = () => {
    setShowInvite(false)
    setInviteLink(null)
    setInviteEmail('')
  }

  if (!currentOrg) return null

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Felhasználók</h1>
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setShowInvite(true)}>
          Meghívó
        </Button>
      </div>

      {/* Members list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Szervezet tagjai ({members.length})
        </h2>
        {loadingMembers ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400">Nincs még tag.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <Avatar name={m.displayName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {ROLE_ICONS[m.role]}
                  {ROLE_LABELS[m.role]}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invite modal */}
      <Modal isOpen={showInvite} onClose={handleCloseInvite} title="Meghívó küldése">
        {inviteLink ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              A meghívó link létrejött! Küldd el a felhasználónak.
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 bg-gray-50 select-all"
              />
              <Button
                variant="outline"
                icon={copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                onClick={handleCopy}
              >
                {copied ? 'Másolva' : 'Másolás'}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              A link 7 napig érvényes. A felhasználónak be kell jelentkeznie a meghívó elfogadásához.
            </p>
            <Button className="w-full" variant="outline" onClick={handleCloseInvite}>
              Bezárás
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-600">Email cím</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="kolega@ceg.hu"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-600">Szerepkör</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'standard' | 'client')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-primary-500 focus:outline-none"
              >
                <option value="standard">Standard (fejlesztő / PO)</option>
                <option value="client">Kliens (csak olvasás)</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                icon={<X className="h-4 w-4" />}
                onClick={handleCloseInvite}
              >
                Mégse
              </Button>
              <Button
                className="flex-1"
                icon={<UserPlus className="h-4 w-4" />}
                loading={inviting}
                onClick={handleInvite}
                disabled={!inviteEmail.trim()}
              >
                Link generálása
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
