import { useState, useEffect } from 'react'
import { onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import {
  UserPlus,
  Crown,
  Shield,
  User,
  Users,
  Copy,
  Check,
  X,
  FolderKanban,
  LayoutPanelTop,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { useOrgStore } from '@/stores/orgStore'
import { useAuthStore } from '@/stores/authStore'
import { useProjects } from '@/hooks/useProjects'
import {
  orgMembersRef,
  invitationsRef,
} from '@/utils/firestore'
import { subscribeToTeams } from '@/services/team.service'
import {
  subscribeToProjectMemberships,
  subscribeToTeamMemberships,
  setProjectMembership,
  removeProjectMembership,
  setTeamMembership,
  removeTeamMembership,
} from '@/services/access.service'
import type {
  OrgRole,
  AccessLevel,
  ProjectRole,
} from '@/types/enums'
import type {
  Project,
  Team,
  ProjectMembership,
  TeamMembership,
} from '@/types/models'

interface OrgMember {
  id: string
  displayName: string
  email: string
  photoUrl?: string
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
  owner: <Crown className="h-3.5 w-3.5 text-yellow-500" />,
  admin: <Shield className="h-3.5 w-3.5 text-blue-500" />,
  standard: <User className="h-3.5 w-3.5 text-gray-400" />,
  client: <Users className="h-3.5 w-3.5 text-purple-400" />,
}

const ACCESS_LABELS: Record<AccessLevel, string> = {
  read: 'Olvasás',
  write: 'Szerkesztés',
  manage: 'Kezelés',
}

const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  developer: 'Fejlesztő',
  po: 'PO',
  client: 'Kliens',
  stakeholder: 'Stakeholder',
}

function generateToken() {
  return crypto.randomUUID()
}

function MembershipSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: AccessLevel | ''
  onChange: (value: AccessLevel | '') => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AccessLevel | '')}
      disabled={disabled}
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
    >
      <option value="">Nincs hozzáférés</option>
      <option value="read">{ACCESS_LABELS.read}</option>
      <option value="write">{ACCESS_LABELS.write}</option>
      <option value="manage">{ACCESS_LABELS.manage}</option>
    </select>
  )
}

export function UserManagementPage() {
  const { currentOrg } = useOrgStore()
  const { userProfile, firebaseUser } = useAuthStore()
  const orgId = currentOrg?.id ?? null
  const { projects } = useProjects()

  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'standard' | 'client'>('standard')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([])
  const [projectMembershipsByProjectId, setProjectMembershipsByProjectId] = useState<Record<string, Record<string, ProjectMembership>>>({})
  const [teamMembershipsByTeamId, setTeamMembershipsByTeamId] = useState<Record<string, Record<string, TeamMembership>>>({})

  useEffect(() => {
    if (!orgId) return
    setLoadingMembers(true)
    const unsub = onSnapshot(orgMembersRef(orgId), (snap) => {
      const data = snap.docs.map((memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() } as OrgMember))
      setMembers(data)
      setExpandedMemberIds((prev) => {
        if (prev.length > 0) return prev.filter((id) => data.some((member) => member.id === id))
        return data.length > 0 ? [data[0].id] : []
      })
      setLoadingMembers(false)
    })
    return unsub
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    const unsub = subscribeToTeams(orgId, setTeams)
    return unsub
  }, [orgId])

  useEffect(() => {
    if (!orgId || projects.length === 0) {
      setProjectMembershipsByProjectId({})
      return
    }

    const unsubs = projects.map((project) =>
      subscribeToProjectMemberships(orgId, project.id, (projectMemberships) => {
        setProjectMembershipsByProjectId((prev) => ({
          ...prev,
          [project.id]: Object.fromEntries(projectMemberships.map((membership) => [membership.id, membership])),
        }))
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [orgId, projects])

  useEffect(() => {
    if (!orgId || teams.length === 0) {
      setTeamMembershipsByTeamId({})
      return
    }

    const unsubs = teams.map((team) =>
      subscribeToTeamMemberships(orgId, team.id, (teamMemberships) => {
        setTeamMembershipsByTeamId((prev) => ({
          ...prev,
          [team.id]: Object.fromEntries(teamMemberships.map((membership) => [membership.id, membership])),
        }))
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [orgId, teams])

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
        invitedBy: firebaseUser?.uid ?? '',
        invitedByName: userProfile?.displayName ?? firebaseUser?.displayName ?? firebaseUser?.email ?? '',
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

  const toggleMember = (memberId: string) => {
    setExpandedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    )
  }

  const handleProjectAccessChange = async (
    member: OrgMember,
    project: Project,
    access: AccessLevel | '',
  ) => {
    if (!orgId) return
    const savingId = `project:${project.id}:${member.id}`
    setSavingKey(savingId)
    try {
      if (!access) {
        await removeProjectMembership(orgId, project.id, member.id)
      } else {
        const currentMembership = projectMembershipsByProjectId[project.id]?.[member.id]
        await setProjectMembership(
          orgId,
          project.id,
          member,
          access,
          currentMembership?.role ?? (member.role === 'client' ? 'client' : 'developer'),
        )
      }
    } finally {
      setSavingKey(null)
    }
  }

  const handleProjectRoleChange = async (
    member: OrgMember,
    project: Project,
    role: ProjectRole,
  ) => {
    if (!orgId) return
    const savingId = `project-role:${project.id}:${member.id}`
    setSavingKey(savingId)
    try {
      const currentMembership = projectMembershipsByProjectId[project.id]?.[member.id]
      await setProjectMembership(
        orgId,
        project.id,
        member,
        currentMembership?.access ?? (member.role === 'client' ? 'read' : 'write'),
        role,
      )
    } finally {
      setSavingKey(null)
    }
  }

  const handleTeamAccessChange = async (
    member: OrgMember,
    team: Team,
    access: AccessLevel | '',
  ) => {
    if (!orgId) return
    const savingId = `team:${team.id}:${member.id}`
    setSavingKey(savingId)
    try {
      if (!access) {
        await removeTeamMembership(orgId, team.id, member.id)
      } else {
        await setTeamMembership(orgId, team.id, member, access)
      }
    } finally {
      setSavingKey(null)
    }
  }

  if (!currentOrg) return null

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Felhasználók és hozzáférések</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Állítsd be, ki melyik projektek backlogját és melyik csapat boardját lássa.
          </p>
        </div>
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setShowInvite(true)}>
          Meghívó
        </Button>
      </div>

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
          <div className="space-y-3">
            {members.map((member) => {
              const isExpanded = expandedMemberIds.includes(member.id)
              return (
                <div
                  key={member.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50"
                  >
                    <Avatar name={member.displayName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">{member.displayName}</p>
                      <p className="truncate text-xs text-gray-400">{member.email}</p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
                      {ROLE_ICONS[member.role]}
                      {ROLE_LABELS[member.role]}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="space-y-6 border-t border-gray-100 px-4 py-4">
                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <FolderKanban className="h-4 w-4 text-primary-600" />
                          <h3 className="text-sm font-semibold text-gray-800">Projekt hozzáférések</h3>
                        </div>
                        {projects.length === 0 ? (
                          <p className="text-sm text-gray-400">Még nincs projekt.</p>
                        ) : (
                          <div className="space-y-3">
                            {projects.map((project) => {
                              const membership = projectMembershipsByProjectId[project.id]?.[member.id]
                              const isSaving = savingKey === `project:${project.id}:${member.id}`
                                || savingKey === `project-role:${project.id}:${member.id}`
                              return (
                                <div
                                  key={project.id}
                                  className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 md:grid-cols-[minmax(0,1fr)_180px_180px]"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                                        {project.prefix}
                                      </span>
                                      <p className="truncate text-sm font-medium text-gray-800">{project.name}</p>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                      {membership?.access
                                        ? `Jelenlegi hozzáférés: ${ACCESS_LABELS[membership.access]}`
                                        : 'Még nincs projekthez rendelve'}
                                    </p>
                                  </div>
                                  <MembershipSelect
                                    value={membership?.access ?? ''}
                                    onChange={(value) => handleProjectAccessChange(member, project, value)}
                                    disabled={isSaving}
                                  />
                                  <select
                                    value={membership?.role ?? (member.role === 'client' ? 'client' : 'developer')}
                                    onChange={(e) => handleProjectRoleChange(member, project, e.target.value as ProjectRole)}
                                    disabled={!membership?.access || isSaving}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                                  >
                                    {Object.entries(PROJECT_ROLE_LABELS).map(([role, label]) => (
                                      <option key={role} value={role}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </section>

                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <LayoutPanelTop className="h-4 w-4 text-primary-600" />
                          <h3 className="text-sm font-semibold text-gray-800">Csapat hozzáférések</h3>
                        </div>
                        {teams.length === 0 ? (
                          <p className="text-sm text-gray-400">Még nincs csapat.</p>
                        ) : (
                          <div className="space-y-3">
                            {teams.map((team) => {
                              const membership = teamMembershipsByTeamId[team.id]?.[member.id]
                              const isSaving = savingKey === `team:${team.id}:${member.id}`
                              return (
                                <div
                                  key={team.id}
                                  className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 md:grid-cols-[minmax(0,1fr)_220px]"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-gray-800">{team.name}</p>
                                    <p className="mt-1 text-xs text-gray-500">
                                      {membership?.access
                                        ? `Jelenlegi hozzáférés: ${ACCESS_LABELS[membership.access]}`
                                        : 'Még nincs csapathoz rendelve'}
                                    </p>
                                  </div>
                                  <MembershipSelect
                                    value={membership?.access ?? ''}
                                    onChange={(value) => handleTeamAccessChange(member, team, value)}
                                    disabled={isSaving}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </section>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <Modal isOpen={showInvite} onClose={handleCloseInvite} title="Meghívó küldése">
        {inviteLink ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              A meghívó link létrejött. A csatlakozás után itt tudod projektekhez és csapatokhoz rendelni a felhasználót.
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 select-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
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
              A link 7 napig érvényes. Belépés után a felhasználó bekerül a szervezetbe, a projekt- és team-hozzáférést itt tudod finomhangolni.
            </p>
            <Button className="w-full" variant="outline" onClick={handleCloseInvite}>
              Bezárás
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Email cím</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="kolega@ceg.hu"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Szervezeti szerepkör</label>
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
