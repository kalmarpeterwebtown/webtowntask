import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOrgStore } from '@/stores/orgStore'
import { subscribeToTeam, updateTeamColumns } from '@/services/team.service'
import { updateDoc } from 'firebase/firestore'
import { teamRef } from '@/utils/firestore'
import { serverTimestamp } from 'firebase/firestore'
import { useProjects } from '@/hooks/useProjects'
import { ROUTES } from '@/config/constants'
import type { Team, BoardColumn } from '@/types/models'

export function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { currentOrg } = useOrgStore()
  const { projects } = useProjects()

  const [team, setTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!currentOrg || !teamId) return
    const unsub = subscribeToTeam(currentOrg.id, teamId, (t) => {
      setTeam(t)
      if (t && !teamName) setTeamName(t.name)
    })
    return unsub
  }, [currentOrg, teamId])

  const handleSaveName = async () => {
    if (!currentOrg || !teamId || !teamName.trim()) return
    setSaving(true)
    try {
      await updateDoc(teamRef(currentOrg.id, teamId), {
        name: teamName.trim(),
        updatedAt: serverTimestamp(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleProject = async (projectId: string) => {
    if (!currentOrg || !teamId || !team) return
    const connected = team.connectedProjectIds ?? []
    const isConnected = connected.includes(projectId)

    const newIds = isConnected
      ? connected.filter((id) => id !== projectId)
      : [...connected, projectId]

    await updateDoc(teamRef(currentOrg.id, teamId), {
      connectedProjectIds: newIds,
      updatedAt: serverTimestamp(),
    })
  }

  const handleAddColumn = async () => {
    if (!currentOrg || !teamId || !team) return
    const cols = team.boardConfig.columns
    const lastOrder = cols[cols.length - 1]?.order ?? 'a0'
    const newCol: BoardColumn = {
      id: `col-${Date.now()}`,
      name: 'Új oszlop',
      order: lastOrder + '1',
      isDoneColumn: false,
      color: '#6B7280',
    }
    await updateTeamColumns(currentOrg.id, teamId, [...cols, newCol])
  }

  const handleDeleteColumn = async (colId: string) => {
    if (!currentOrg || !teamId || !team) return
    const cols = team.boardConfig.columns.filter((c) => c.id !== colId)
    await updateTeamColumns(currentOrg.id, teamId, cols)
  }

  const handleRenameColumn = async (colId: string, name: string) => {
    if (!currentOrg || !teamId || !team) return
    const cols = team.boardConfig.columns.map((c) =>
      c.id === colId ? { ...c, name } : c
    )
    await updateTeamColumns(currentOrg.id, teamId, cols)
  }

  const handleToggleDoneColumn = async (colId: string) => {
    if (!currentOrg || !teamId || !team) return
    const cols = team.boardConfig.columns.map((c) =>
      c.id === colId ? { ...c, isDoneColumn: !c.isDoneColumn } : c
    )
    await updateTeamColumns(currentOrg.id, teamId, cols)
  }

  if (!team) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  const columns = [...team.boardConfig.columns].sort((a, b) => a.order.localeCompare(b.order))

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      {/* Back */}
      <Link
        to={ROUTES.BOARD(team.id)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Vissza a boardra
      </Link>

      <h1 className="text-xl font-semibold text-gray-900">Csapat beállítások</h1>

      {/* Team name */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Csapat neve</h2>
        <div className="flex gap-2">
          <Input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Csapat neve"
            className="max-w-sm"
          />
          <Button onClick={handleSaveName} loading={saving} variant={saved ? 'secondary' : 'primary'}>
            {saved ? <><Check className="h-4 w-4" /> Mentve</> : 'Mentés'}
          </Button>
        </div>
      </section>

      {/* Connected projects */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-gray-700">Kapcsolt projektek</h2>
        <p className="mb-3 text-xs text-gray-500">
          A kijelölt projektekből kerülnek a story-k erre a board-ra.
        </p>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-400">Nincs még projekt. Hozz létre egyet a Projektek menüpontban.</p>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => {
              const connected = (team.connectedProjectIds ?? []).includes(project.id)
              return (
                <button
                  key={project.id}
                  onClick={() => handleToggleProject(project.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                    connected
                      ? 'border-primary-300 bg-primary-50 text-primary-800'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                    connected ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {project.prefix || project.name[0]}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-gray-400">{project.storyCount ?? 0} story</p>
                  </div>
                  {connected && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Board columns */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Board oszlopok</h2>
            <p className="text-xs text-gray-500 mt-0.5">A "Kész" oszlopra jelöld be az "Ez a Done oszlop" jelölőt.</p>
          </div>
          <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={handleAddColumn}>
            Oszlop
          </Button>
        </div>

        <div className="space-y-2">
          {columns.map((col) => (
            <div key={col.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
              <div
                className="h-3 w-3 rounded-full shrink-0 border border-gray-300"
                style={{ backgroundColor: col.color ?? '#6B7280' }}
              />
              <input
                defaultValue={col.name}
                onBlur={(e) => handleRenameColumn(col.id, e.target.value)}
                className="flex-1 text-sm text-gray-700 outline-none focus:ring-0 bg-transparent"
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={col.isDoneColumn}
                  onChange={() => handleToggleDoneColumn(col.id)}
                  className="accent-primary-600"
                />
                Done
              </label>
              <button
                onClick={() => handleDeleteColumn(col.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
