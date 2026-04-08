import { useEffect, useMemo, useState } from 'react'
import { Building2, Search, Shield, Trash2, Unplug } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import {
  deleteAuthUserByEmail,
  deleteOrganizationWithCleanup,
  detachUserFromOrganization,
  findUserFootprintByEmail,
  hardDeleteUserFootprint,
  listAuditLogs,
  listOrganizationsForPlatformAdmin,
  type PlatformOrganization,
  type PlatformAuditLogEntry,
  type PlatformOrganizationDeletionPreview,
  type PlatformUserFootprint,
  previewOrganizationDeletion,
} from '@/services/platformAdmin.service'
import { toast } from '@/stores/uiStore'

type PendingAction =
  | { type: 'detach'; orgId: string; orgName: string }
  | { type: 'hard-delete' }
  | { type: 'delete-auth-user' }
  | null

type OrganizationDeletionState = {
  org: PlatformOrganization
  preview: PlatformOrganizationDeletionPreview | null
  loading: boolean
  deleteRegisteredUsers: boolean
} | null

const kindLabels: Record<string, string> = {
  user: 'User doc',
  orgMembership: 'User orgMembership',
  notification: 'Notification',
  orgMember: 'Org member',
  projectMembership: 'Project membership',
  teamMembership: 'Team membership',
  invitation: 'Invitation',
}

const auditActionLabels: Record<PlatformAuditLogEntry['action'], string> = {
  detach_user_from_organization: 'User leválasztása szervezetről',
  hard_delete_user_footprint: 'Firestore user cleanup',
  delete_auth_user: 'Auth user törlése',
  delete_organization: 'Szervezet törlése',
}

export function PlatformAdminPage() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([])
  const [orgLoading, setOrgLoading] = useState(true)
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [searchEmail, setSearchEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [footprint, setFootprint] = useState<PlatformUserFootprint | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [organizationDeletionState, setOrganizationDeletionState] = useState<OrganizationDeletionState>(null)

  const refreshOrganizations = async () => {
    setOrgLoading(true)
    try {
      setOrganizations(await listOrganizationsForPlatformAdmin())
    } catch {
      toast.error('A szervezetek betöltése nem sikerült.')
    } finally {
      setOrgLoading(false)
    }
  }

  const refreshAuditLogs = async () => {
    setAuditLoading(true)
    try {
      setAuditLogs(await listAuditLogs(20))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba'
      toast.error(`Az audit log betöltése nem sikerült: ${message}`)
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void listOrganizationsForPlatformAdmin()
      .then((orgs) => {
        if (active) setOrganizations(orgs)
      })
      .catch(() => toast.error('A szervezetek betöltése nem sikerült.'))
      .finally(() => {
        if (active) setOrgLoading(false)
      })

    void listAuditLogs(20)
      .then((entries) => {
        if (active) setAuditLogs(entries)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Ismeretlen hiba'
        toast.error(`Az audit log betöltése nem sikerült: ${message}`)
      })
      .finally(() => {
        if (active) setAuditLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const hitsByOrg = useMemo(() => {
    const groups = new Map<string, NonNullable<PlatformUserFootprint['hits']>>()
    if (!footprint) return groups

    footprint.hits.filter((hit) => hit.orgId).forEach((hit) => {
      const orgId = hit.orgId as string
      groups.set(orgId, [...(groups.get(orgId) ?? []), hit])
    })

    return groups
  }, [footprint])

  const standaloneHits = useMemo(
    () => footprint?.hits.filter((hit) => !hit.orgId) ?? [],
    [footprint],
  )

  const handleSearch = async () => {
    if (!searchEmail.trim()) return
    setSearching(true)
    try {
      const result = await findUserFootprintByEmail(searchEmail)
      setFootprint(result)
      result.warnings.forEach((warning) => toast.warning(warning))
      if (result.hits.length === 0) {
        toast.info('Ehhez az emailhez nem találtunk platform footprintet.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba'
      toast.error(`A footprint keresése nem sikerült: ${message}`)
    } finally {
      setSearching(false)
    }
  }

  const refreshFootprint = async () => {
    if (!footprint) return
    setFootprint(await findUserFootprintByEmail(footprint.email))
  }

  const handleConfirm = async () => {
    if (!pendingAction || !footprint) return
    setActionLoading(true)
    try {
      if (pendingAction.type === 'detach') {
        const deletedCount = await detachUserFromOrganization(footprint, pendingAction.orgId)
        toast.success(`${deletedCount} rekord leválasztva a szervezetről.`)
      } else if (pendingAction.type === 'delete-auth-user') {
        const result = await deleteAuthUserByEmail(footprint.email)
        toast.success(
          result.deletedAuthUser
            ? 'Az Auth user törölve lett.'
            : 'Ehhez az emailhez nem volt törölhető Auth user.',
        )
      } else {
        const deletedCount = await hardDeleteUserFootprint(footprint)
        toast.success(`${deletedCount} rekord törölve a Firestore footprintből.`)
      }
      await refreshFootprint()
      await refreshAuditLogs()
      setPendingAction(null)
    } catch {
      toast.error('Az admin művelet nem sikerült.')
    } finally {
      setActionLoading(false)
    }
  }

  const openOrganizationDeleteDialog = async (org: PlatformOrganization) => {
    setOrganizationDeletionState({
      org,
      preview: null,
      loading: true,
      deleteRegisteredUsers: false,
    })

    try {
      const preview = await previewOrganizationDeletion(org.id)
      setOrganizationDeletionState({
        org,
        preview,
        loading: false,
        deleteRegisteredUsers: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba'
      setOrganizationDeletionState(null)
      toast.error(`A szervezet törlési előnézete nem tölthető be: ${message}`)
    }
  }

  const handleOrganizationDelete = async () => {
    if (!organizationDeletionState?.preview) return

    setOrganizationDeletionState((current) => current ? { ...current, loading: true } : current)
    try {
      const result = await deleteOrganizationWithCleanup(
        organizationDeletionState.org.id,
        { deleteRegisteredUsers: organizationDeletionState.deleteRegisteredUsers },
      )

      toast.success(
        `${result.deletedCount} rekord törölve. ${result.deletedUserCount} user profil törölve, ${result.skippedUserCount} megőrizve.`,
      )

      setOrganizationDeletionState(null)
      await refreshOrganizations()
      await refreshFootprint()
      await refreshAuditLogs()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba'
      setOrganizationDeletionState((current) => current ? { ...current, loading: false } : current)
      toast.error(`A szervezet törlése nem sikerült: ${message}`)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <Shield className="h-3.5 w-3.5" />
              Platform Admin
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Super admin központ</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Itt látod a teljes platformot, és email alapján fel tudod tárni vagy takarítani egy user Firestore footprintjét.
            </p>
          </div>
          <div className="flex w-full max-w-xl gap-3">
            <Input
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              placeholder="kalmar.peter@webtown.hu"
              className="flex-1"
              leftIcon={<Search className="h-4 w-4" />}
            />
            <Button onClick={handleSearch} loading={searching}>
              Keresés
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Összes szervezet</h2>
              <p className="text-sm text-slate-500">Platformszintű nézet minden org fölött.</p>
            </div>
            <Badge>{organizations.length} db</Badge>
          </div>

          {orgLoading ? (
            <p className="py-8 text-sm text-slate-500">Szervezetek betöltése...</p>
          ) : organizations.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-8 w-8" />}
              title="Nincs szervezet"
              description="A platformon jelenleg nincs egyetlen szervezet sem."
            />
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <div key={org.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{org.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        `{org.slug}` • {org.plan} • {org.memberCount} tag
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => void openOrganizationDeleteDialog(org)}
                      >
                        Törlés
                      </Button>
                      <Badge variant="info">{org.id}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">User footprint</h2>
              <p className="text-sm text-slate-500">Emailhez tartozó user, membership és invitation rekordok.</p>
            </div>
            {footprint && <Badge>{footprint.hits.length} találat</Badge>}
          </div>

          {!footprint ? (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="Adj meg egy email címet"
              description="A rendszer megmutatja, hol maradt user footprint a teljes platformon."
            />
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{footprint.email}</p>
                    <p className="mt-1 text-xs text-slate-500">UID: {footprint.userId ?? 'nincs user doc'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => setPendingAction({ type: 'delete-auth-user' })}
                    >
                      Auth user törlése
                    </Button>
                    <Button
                      variant="danger"
                      icon={<Trash2 className="h-4 w-4" />}
                      disabled={footprint.hits.length === 0}
                      onClick={() => setPendingAction({ type: 'hard-delete' })}
                    >
                      Teljes Firestore cleanup
                    </Button>
                  </div>
                </div>
              </div>

              {footprint.warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Részleges találatok</p>
                  <div className="mt-2 space-y-2">
                    {footprint.warnings.map((warning) => (
                      <p key={warning} className="text-sm text-amber-800">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {Array.from(hitsByOrg.entries()).map(([orgId, hits]) => {
                const org = organizations.find((entry) => entry.id === orgId)
                return (
                  <div key={orgId} className="rounded-2xl border border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{org?.name ?? orgId}</p>
                        <p className="text-xs text-slate-500">{hits.length} rekord ebben a szervezetben</p>
                      </div>
                      <Button
                        variant="outline"
                        icon={<Unplug className="h-4 w-4" />}
                        onClick={() => setPendingAction({ type: 'detach', orgId, orgName: org?.name ?? orgId })}
                      >
                        Leválasztás a szervezetről
                      </Button>
                    </div>
                    <div className="space-y-2 p-4">
                      {hits.map((hit) => (
                        <div key={hit.path} className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kindLabels[hit.kind]}</p>
                          <p className="mt-1 break-all font-mono text-xs text-slate-700">{hit.path}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {standaloneHits.length > 0 && (
                <div className="rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Orgon kívüli rekordok</p>
                  </div>
                  <div className="space-y-2 p-4">
                    {standaloneHits.map((hit) => (
                      <div key={hit.path} className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kindLabels[hit.kind]}</p>
                        <p className="mt-1 break-all font-mono text-xs text-slate-700">{hit.path}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Legutóbbi admin műveletek</h2>
            <p className="text-sm text-slate-500">Visszakövethető napló a platformszintű beavatkozásokról.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshAuditLogs()} loading={auditLoading}>
            Frissítés
          </Button>
        </div>

        {auditLoading ? (
          <p className="py-8 text-sm text-slate-500">Audit log betöltése...</p>
        ) : auditLogs.length === 0 ? (
          <EmptyState
            icon={<Shield className="h-8 w-8" />}
            title="Még nincs audit bejegyzés"
            description="Az admin műveletek itt fognak megjelenni időrendben."
          />
        ) : (
          <div className="space-y-3">
            {auditLogs.map((entry) => (
              <div key={entry.id ?? `${entry.action}-${entry.targetId}-${entry.createdAt ?? ''}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{auditActionLabels[entry.action]}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.actorEmail || entry.actorUid}
                      {entry.targetEmail ? ` -> ${entry.targetEmail}` : ` -> ${entry.targetId}`}
                    </p>
                  </div>
                  <Badge variant="info">{entry.createdAt ? new Date(entry.createdAt).toLocaleString('hu-HU') : 'ismeretlen idő'}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirm}
        title={
          pendingAction?.type === 'detach'
            ? 'Leválasztás megerősítése'
            : pendingAction?.type === 'delete-auth-user'
              ? 'Auth user törlés megerősítése'
              : 'Teljes cleanup megerősítése'
        }
        message={
          pendingAction?.type === 'detach'
            ? `A user footprintjét eltávolítjuk ebből a szervezetből: ${pendingAction.orgName}.`
            : pendingAction?.type === 'delete-auth-user'
              ? 'A user Firebase Auth fiókja törlődni fog. Ez a Firestore footprintet nem törli automatikusan.'
              : 'A user összes megtalált Firestore rekordja törlődni fog a platformon. Az Auth user külön művelet.'
        }
        confirmLabel={
          pendingAction?.type === 'detach'
            ? 'Leválasztás'
            : pendingAction?.type === 'delete-auth-user'
              ? 'Auth user törlése'
              : 'Teljes törlés'
        }
        danger
        loading={actionLoading}
      />

      <Modal
        isOpen={organizationDeletionState !== null}
        onClose={() => !organizationDeletionState?.loading && setOrganizationDeletionState(null)}
        title="Szervezet törlése"
        size="lg"
      >
        {organizationDeletionState?.loading && !organizationDeletionState.preview ? (
          <p className="text-sm text-slate-500">Törlési előnézet betöltése...</p>
        ) : organizationDeletionState?.preview ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              A <strong>{organizationDeletionState.preview.orgName}</strong> szervezet teljes Firestore tartalma törlődni fog.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                {organizationDeletionState.preview.memberCount} tag, {organizationDeletionState.preview.invitationCount} meghívó
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                {organizationDeletionState.preview.projectCount} projekt, {organizationDeletionState.preview.storyCount} story
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                {organizationDeletionState.preview.teamCount} csapat
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                kb. {organizationDeletionState.preview.estimatedDeleteCount} Firestore rekord
              </div>
            </div>

            {organizationDeletionState.preview.registeredUsers.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Kapcsolódó regisztrált userek</p>
                <p className="mt-1 text-sm text-amber-800">
                  {organizationDeletionState.preview.registeredUsers.length} user kapcsolódik ehhez a szervezethez.
                  {` ${organizationDeletionState.preview.deletableUserCount}`} csak ehhez az egy szervezethez tartozik,
                  {` ${organizationDeletionState.preview.sharedUserCount}`} pedig más szervezet(ek)ben is benne van.
                </p>
                <label className="mt-3 flex items-start gap-3 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-amber-300 text-red-600 focus:ring-red-500"
                    checked={organizationDeletionState.deleteRegisteredUsers}
                    onChange={(event) => setOrganizationDeletionState((current) => current
                      ? { ...current, deleteRegisteredUsers: event.target.checked }
                      : current)}
                  />
                  <span>
                    A csak ehhez a szervezethez tartozó user profilok törlése is.
                    A több szervezethez tartozó userek profilja megmarad, csak az ehhez az orghoz kötődő membership és notification rekordok törlődnek.
                  </span>
                </label>
              </div>
            )}

            {organizationDeletionState.preview.registeredUsers.length > 0 && (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-4">
                {organizationDeletionState.preview.registeredUsers.map((registeredUser) => (
                  <div key={registeredUser.userId} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">
                      {registeredUser.displayName}
                      {registeredUser.email ? ` • ${registeredUser.email}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {registeredUser.canDeleteProfile
                        ? 'Csak ehhez az orghoz tartozik, törölhető.'
                        : `Megmarad, mert más orgokhoz is kapcsolódik: ${registeredUser.otherOrgIds.join(', ')}`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <ModalFooter>
              <Button
                variant="ghost"
                onClick={() => setOrganizationDeletionState(null)}
                disabled={organizationDeletionState.loading}
              >
                Mégsem
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={handleOrganizationDelete}
                loading={organizationDeletionState.loading}
              >
                Szervezet törlése
              </Button>
            </ModalFooter>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
