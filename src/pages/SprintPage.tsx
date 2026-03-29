import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Play, CheckSquare, Calendar, Flag, X } from 'lucide-react'
import {
  onSnapshot, query, orderBy, addDoc, updateDoc, doc, serverTimestamp, where,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useOrgStore } from '@/stores/orgStore'
import { subscribeToTeam } from '@/services/team.service'
import { sprintsRef, storiesRef } from '@/utils/firestore'
import { ROUTES, STATUS_COLORS } from '@/config/constants'
import type { Sprint, Team, Story } from '@/types/models'

const SPRINT_STATUS_LABELS: Record<string, string> = {
  planning: 'Tervezés',
  active: 'Aktív',
  completed: 'Befejezett',
}

const SPRINT_STATUS_COLORS: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}


export function SprintPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { currentOrg } = useOrgStore()
  const [team, setTeam] = useState<Team | null>(null)
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sprintStories, setSprintStories] = useState<Record<string, Story[]>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedSprint, setExpandedSprint] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrg || !teamId) return
    return subscribeToTeam(currentOrg.id, teamId, setTeam)
  }, [currentOrg?.id, teamId])

  useEffect(() => {
    if (!currentOrg || !teamId) return
    const q = query(sprintsRef(currentOrg.id, teamId), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setSprints(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sprint)))
    })
  }, [currentOrg?.id, teamId])

  // Load stories for expanded sprint
  useEffect(() => {
    if (!currentOrg || !expandedSprint || !team) return
    if (team.connectedProjectIds.length === 0) return

    const unsubs: Array<() => void> = []
    const map: Record<string, Story[]> = { [expandedSprint]: [] }

    for (const projectId of team.connectedProjectIds) {
      const q = query(storiesRef(currentOrg.id, projectId), where('sprintId', '==', expandedSprint))
      const unsub = onSnapshot(q, (snap) => {
        const existing = map[expandedSprint] ?? []
        map[expandedSprint] = [
          ...existing.filter((s) => s.projectId !== projectId),
          ...snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story)),
        ]
        setSprintStories((prev) => ({ ...prev, [expandedSprint]: map[expandedSprint] }))
      })
      unsubs.push(unsub)
    }
    return () => unsubs.forEach((u) => u())
  }, [currentOrg?.id, expandedSprint, team])

  const handleCreate = async () => {
    if (!currentOrg || !teamId || !newName.trim() || !newStart || !newEnd) return
    setCreating(true)
    try {
      await addDoc(sprintsRef(currentOrg.id, teamId), {
        teamId,
        name: newName.trim(),
        goal: newGoal.trim(),
        status: 'planning',
        startDate: new Date(newStart),
        endDate: new Date(newEnd),
        stats: {
          totalStories: 0, completedStories: 0,
          totalPoints: 0, completedPoints: 0,
          addedAfterStart: 0, removedDuringSprint: 0,
        },
        createdAt: serverTimestamp(),
        createdBy: '',
      })
      setShowCreate(false)
      setNewName('')
      setNewGoal('')
      setNewStart('')
      setNewEnd('')
    } finally {
      setCreating(false)
    }
  }

  const handleStartSprint = async (sprintId: string) => {
    if (!currentOrg || !teamId) return
    const hasActive = sprints.some((s) => s.status === 'active')
    if (hasActive) {
      alert('Már van aktív sprint! Fejezd be azt előbb.')
      return
    }
    await updateDoc(doc(db, 'organizations', currentOrg.id, 'teams', teamId, 'sprints', sprintId), {
      status: 'active',
    })
  }

  const handleCompleteSprint = async (sprintId: string) => {
    if (!currentOrg || !teamId) return
    if (!confirm('Befejezed a sprintet?')) return
    await updateDoc(doc(db, 'organizations', currentOrg.id, 'teams', teamId, 'sprints', sprintId), {
      status: 'completed',
      completedAt: serverTimestamp(),
    })
  }

  if (!team) {
    return (
      <div className="p-6 flex justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  const activeSprint = sprints.find((s) => s.status === 'active')
  const planningSprints = sprints.filter((s) => s.status === 'planning')
  const completedSprints = sprints.filter((s) => s.status === 'completed')

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={ROUTES.BOARD(team.id)} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Sprintek</h1>
            <p className="text-sm text-gray-500">{team.name}</p>
          </div>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => { setNewName(`Sprint ${sprints.length + 1}`); setShowCreate(true) }}
        >
          Új sprint
        </Button>
      </div>

      {activeSprint && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">Aktív sprint</h2>
          <SprintCard
            sprint={activeSprint}
            stories={sprintStories[activeSprint.id] ?? []}
            expanded={expandedSprint === activeSprint.id}
            onToggle={() => setExpandedSprint(expandedSprint === activeSprint.id ? null : activeSprint.id)}
            onComplete={() => handleCompleteSprint(activeSprint.id)}
            showComplete
          />
        </section>
      )}

      {planningSprints.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Tervezés alatt</h2>
          <div className="space-y-2">
            {planningSprints.map((s) => (
              <SprintCard
                key={s.id}
                sprint={s}
                stories={sprintStories[s.id] ?? []}
                expanded={expandedSprint === s.id}
                onToggle={() => setExpandedSprint(expandedSprint === s.id ? null : s.id)}
                onStart={!activeSprint ? () => handleStartSprint(s.id) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {completedSprints.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Befejezett sprintek</h2>
          <div className="space-y-2">
            {completedSprints.map((s) => (
              <SprintCard
                key={s.id}
                sprint={s}
                stories={sprintStories[s.id] ?? []}
                expanded={expandedSprint === s.id}
                onToggle={() => setExpandedSprint(expandedSprint === s.id ? null : s.id)}
              />
            ))}
          </div>
        </section>
      )}

      {sprints.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <Flag className="h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">Még nincs sprint. Hozz létre egyet!</p>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Új sprint létrehozása">
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">Sprint neve</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`Sprint ${sprints.length + 1}`} />
          </div>
          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">Cél (opcionális)</label>
            <textarea
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              rows={2}
              placeholder="Mi a sprint fő célja?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-primary-500 focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-600">Kezdés</label>
              <Input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-600">Befejezés</label>
              <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" icon={<X className="h-4 w-4" />} onClick={() => setShowCreate(false)}>
              Mégse
            </Button>
            <Button
              className="flex-1"
              loading={creating}
              disabled={!newName.trim() || !newStart || !newEnd}
              onClick={handleCreate}
            >
              Létrehozás
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function SprintCard({
  sprint,
  stories,
  expanded,
  onToggle,
  onStart,
  onComplete,
  showComplete,
}: {
  sprint: Sprint
  stories: Story[]
  expanded: boolean
  onToggle: () => void
  onStart?: () => void
  onComplete?: () => void
  showComplete?: boolean
}) {
  const done = stories.filter((s) => s.status === 'done' || s.status === 'delivered').length
  const total = stories.length
  type TS = { toDate?: () => Date }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">{sprint.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SPRINT_STATUS_COLORS[sprint.status]}`}>
              {SPRINT_STATUS_LABELS[sprint.status]}
            </span>
          </div>
          {sprint.goal && <p className="text-xs text-gray-500 truncate mt-0.5">{sprint.goal}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {(sprint.startDate as unknown as TS)?.toDate?.()?.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }) ?? '–'}
            {' – '}
            {(sprint.endDate as unknown as TS)?.toDate?.()?.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }) ?? '–'}
          </span>
          {total > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3.5 w-3.5" />
              {done}/{total}
            </span>
          )}
        </div>
        {onStart && (
          <Button size="sm" variant="outline" icon={<Play className="h-3.5 w-3.5 text-green-600" />}
            onClick={(e) => { e.stopPropagation(); onStart() }}>
            Indítás
          </Button>
        )}
        {showComplete && onComplete && (
          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onComplete() }}>
            Befejezés
          </Button>
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-3">
          {stories.length === 0 ? (
            <p className="py-3 text-sm text-gray-400">Nincs story ebben a sprintben.</p>
          ) : (
            <div className="space-y-1 pt-2">
              {stories.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm py-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                    {s.status}
                  </span>
                  <span className="text-gray-700 truncate">{s.title}</span>
                  {s.estimate && <span className="ml-auto shrink-0 text-xs text-gray-400">{s.estimate} SP</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
