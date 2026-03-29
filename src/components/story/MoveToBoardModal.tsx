import { useState, useEffect } from 'react'
import { Layout } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useOrgStore } from '@/stores/orgStore'
import { useTeamAccessMap } from '@/hooks/useAccess'
import { subscribeToTeams } from '@/services/team.service'
import { moveStoryToBoard } from '@/services/story.service'
import { initialKey } from '@/utils/fractionalIndex'
import type { Story, Team } from '@/types/models'

interface Props {
  story: Story
  isOpen: boolean
  onClose: () => void
}

export function MoveToBoardModal({ story, isOpen, onClose }: Props) {
  const { currentOrg } = useOrgStore()
  const orgId = currentOrg?.id ?? null
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedColumnId, setSelectedColumnId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { teams: visibleTeams } = useTeamAccessMap(teams)

  useEffect(() => {
    if (!orgId || !isOpen) return
    const unsub = subscribeToTeams(orgId, (t) => {
      setTeams(t)
    })
    return unsub
  }, [orgId, isOpen])

  useEffect(() => {
    if (visibleTeams.length === 0) {
      setSelectedTeam(null)
      setSelectedColumnId('')
      return
    }

    if (!selectedTeam || !visibleTeams.some((team) => team.id === selectedTeam.id)) {
      setSelectedTeam(visibleTeams[0])
      setSelectedColumnId(visibleTeams[0].boardConfig.columns[0]?.id ?? '')
    }
  }, [visibleTeams, selectedTeam])

  useEffect(() => {
    if (selectedTeam) {
      setSelectedColumnId(selectedTeam.boardConfig.columns[0]?.id ?? '')
    }
  }, [selectedTeam])

  const handleMove = async () => {
    if (!currentOrg || !selectedTeam || !selectedColumnId) return
    setLoading(true)
    setError('')
    try {
      await moveStoryToBoard(
        currentOrg.id,
        story.projectId,
        story.id,
        selectedTeam.id,
        selectedColumnId,
        initialKey(),
      )
      onClose()
    } catch (err) {
      setError('Nem sikerült áthelyezni a story-t.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const columns = selectedTeam?.boardConfig.columns
    .slice()
    .sort((a, b) => a.order.localeCompare(b.order)) ?? []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Áthelyezés boardra" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Válassz csapatot és oszlopot a <span className="font-medium text-gray-700">"{story.title}"</span> story-hoz.
        </p>

        {visibleTeams.length === 0 ? (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Nincs még csapat. Előbb hozz létre egyet a Csapatok menüpontban.
          </p>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Csapat</label>
              <div className="space-y-1">
                {visibleTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selectedTeam?.id === team.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Layout className="h-4 w-4 shrink-0" />
                    {team.name}
                  </button>
                ))}
              </div>
            </div>

            {columns.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">Oszlop</label>
                <div className="flex flex-wrap gap-2">
                  {columns.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => setSelectedColumnId(col.id)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedColumnId === col.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: col.color ?? '#6B7280' }}
                      />
                      {col.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Mégse</Button>
          <Button
            onClick={handleMove}
            loading={loading}
            disabled={!selectedTeam || !selectedColumnId || visibleTeams.length === 0}
          >
            Áthelyezés
          </Button>
        </div>
      </div>
    </Modal>
  )
}
