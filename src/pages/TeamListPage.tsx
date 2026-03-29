import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, Layout, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useOrgStore } from '@/stores/orgStore'
import { subscribeToTeams, createTeam } from '@/services/team.service'
import { ROUTES } from '@/config/constants'
import type { Team } from '@/types/models'

export function TeamListPage() {
  const { currentOrg } = useOrgStore()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentOrg) return
    const unsub = subscribeToTeams(currentOrg.id, (t) => {
      setTeams(t)
      setLoading(false)
    })
    return unsub
  }, [currentOrg])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !currentOrg) return
    setCreating(true)
    setError('')
    try {
      await createTeam(currentOrg.id, name.trim(), description.trim())
      setModalOpen(false)
      setName('')
      setDescription('')
    } catch (err) {
      setError('Nem sikerült létrehozni a csapatot.')
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Csapatok</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? '…' : `${teams.length} csapat`}
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
          Új csapat
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Még nincs csapat"
          description="Hozz létre egy csapatot és kapcsold össze projektekkel."
          action={
            <Button onClick={() => setModalOpen(true)}>Csapat létrehozása</Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={ROUTES.BOARD(team.id)}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:border-primary-300 hover:shadow-sm transition-all group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <Users className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  {team.name}
                </p>
                {team.description && (
                  <p className="text-sm text-gray-500 truncate">{team.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {team.boardConfig.mode === 'kanban' ? 'Kanban' : 'Scrum'} ·{' '}
                  {team.boardConfig.columns.length} oszlop
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  <Layout className="h-3.5 w-3.5" />
                  Board
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setError('') }}
        title="Új csapat"
        size="sm"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Csapat neve"
            placeholder="pl. Frontend csapat"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Leírás"
            placeholder="Rövid leírás (opcionális)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Mégse
            </Button>
            <Button type="submit" loading={creating}>
              Létrehozás
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
