import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'
import { Plus, Settings, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useOrgStore } from '@/stores/orgStore'
import { useProjects } from '@/hooks/useProjects'
import { subscribeToTeam, subscribeToBoardStories, moveStoryToColumn } from '@/services/team.service'
import { createStory } from '@/services/story.service'
import { toast } from '@/stores/uiStore'
import { ROUTES, TYPE_COLORS, PRIORITY_COLORS } from '@/config/constants'
import { keyBetween } from '@/utils/fractionalIndex'
import type { Team, BoardColumn, Story } from '@/types/models'
import type { StoryType, StoryPriority } from '@/types/enums'

// ── Story Card ────────────────────────────────────────────────────────────────

function StoryCard({ story, projectId, overlay = false }: { story: Story; projectId: string; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: story.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={clsx(
        'rounded-lg border bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing transition-shadow',
        isDragging || overlay ? 'opacity-50 shadow-lg border-primary-300' : 'border-gray-200 hover:border-gray-300 hover:shadow',
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className={clsx('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', TYPE_COLORS[story.type])}>
          {story.type === 'tech_debt' ? 'Tech' : story.type.charAt(0).toUpperCase() + story.type.slice(1)}
        </span>
        <span className="text-[10px] font-mono text-gray-400">#{story.sequenceNumber}</span>
      </div>

      <Link
        to={ROUTES.STORY(projectId, story.id)}
        onClick={(e) => e.stopPropagation()}
        className="block text-sm font-medium text-gray-800 hover:text-primary-600 leading-snug mb-2 line-clamp-2"
      >
        {story.title}
      </Link>

      <div className="flex items-center gap-2 mt-2">
        <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[story.priority])}>
          {story.priority === 'critical' ? 'Krit.' : story.priority === 'high' ? 'Magas' : story.priority === 'medium' ? 'Köz.' : 'Ala.'}
        </span>
        {story.estimate != null && (
          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
            {story.estimate} SP
          </span>
        )}
        {story.assigneeNames.length > 0 && (
          <div className="flex -space-x-1 ml-auto">
            {story.assigneeNames.slice(0, 2).map((name, i) => (
              <div key={i} title={name}
                className="h-5 w-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[9px] font-bold ring-1 ring-white">
                {name[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>

      {story.taskCount > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-primary-500"
              style={{ width: `${(story.taskDoneCount / story.taskCount) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-400">{story.taskDoneCount}/{story.taskCount}</span>
        </div>
      )}
    </div>
  )
}

// ── Board Column ──────────────────────────────────────────────────────────────

function BoardColumnView({
  column,
  stories,
  onAddStory,
}: {
  column: BoardColumn
  stories: Story[]
  onAddStory: (columnId: string) => void
}) {
  const wipOver = column.wipLimit != null && stories.length > column.wipLimit
  // Make the column itself a drop target (for empty columns)
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className={clsx(
        'flex items-center gap-2 rounded-t-xl px-3 py-2.5 border-b',
        wipOver ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200',
      )}>
        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color ?? '#6B7280' }} />
        <span className={clsx('flex-1 text-sm font-semibold', wipOver ? 'text-yellow-800' : 'text-gray-700')}>
          {column.name}
        </span>
        <span className={clsx(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          wipOver ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-600',
        )}>
          {stories.length}{column.wipLimit != null ? `/${column.wipLimit}` : ''}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 rounded-b-xl border border-t-0 border-gray-200 p-2 space-y-2 min-h-[200px] transition-colors',
          wipOver && 'border-yellow-200',
          isOver && !wipOver ? 'bg-primary-50/60 border-primary-200' : 'bg-gray-50/50',
        )}
      >
        <SortableContext items={stories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} projectId={story.projectId} />
          ))}
        </SortableContext>

        {stories.length === 0 && (
          <div className={clsx(
            'flex items-center justify-center h-16 text-xs rounded-lg border border-dashed transition-colors',
            isOver ? 'border-primary-300 text-primary-500' : 'border-gray-200 text-gray-400',
          )}>
            {isOver ? 'Elengedés ide' : 'Húzz ide story-t'}
          </div>
        )}

        <button
          onClick={() => onAddStory(column.id)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Story hozzáadása
        </button>
      </div>
    </div>
  )
}

// ── Quick Story Create Modal ──────────────────────────────────────────────────

function QuickCreateModal({
  isOpen,
  onClose,
  onSubmit,
  projects,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (title: string, type: StoryType, priority: StoryPriority, projectId: string, estimate?: number) => Promise<void>
  projects: { id: string; name: string; prefix: string }[]
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<StoryType>('feature')
  const [priority, setPriority] = useState<StoryPriority>('medium')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [estimate, setEstimate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setTitle(''); setType('feature'); setPriority('medium')
      setProjectId(projects[0]?.id ?? ''); setEstimate(''); setError('')
    }
  }, [isOpen, projects])

  const handleSubmit = async () => {
    if (!title.trim()) { setError('A cím kötelező.'); return }
    if (!projectId) { setError('Válassz projektet.'); return }
    setLoading(true)
    try {
      await onSubmit(title.trim(), type, priority, projectId, estimate ? Number(estimate) : undefined)
      onClose()
    } catch {
      setError('Nem sikerült létrehozni.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Story hozzáadása a board-ra">
      <div className="space-y-4">
        <div>
          <Input
            label="Cím"
            placeholder="Story neve..."
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError('') }}
            autoFocus
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        {projects.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Projekt</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.prefix} — {p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Típus</label>
            <select value={type} onChange={(e) => setType(e.target.value as StoryType)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="tech_debt">Tech Debt</option>
              <option value="chore">Chore</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prioritás</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as StoryPriority)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none">
              <option value="critical">Kritikus</option>
              <option value="high">Magas</option>
              <option value="medium">Közepes</option>
              <option value="low">Alacsony</option>
            </select>
          </div>
        </div>

        <Input label="Becslés (SP)" type="number" placeholder="pl. 3" value={estimate}
          onChange={(e) => setEstimate(e.target.value)} min={0} />

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Mégse</Button>
          <Button className="flex-1" loading={loading} onClick={handleSubmit}>Létrehozás</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Board Page ────────────────────────────────────────────────────────────────

export function BoardPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { currentOrg } = useOrgStore()
  const { projects } = useProjects()

  const [team, setTeam] = useState<Team | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  // Quick create state
  const [createColumnId, setCreateColumnId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (!currentOrg || !teamId) return
    const unsub = subscribeToTeam(currentOrg.id, teamId, (t) => {
      setTeam(t)
      setLoading(false)
    })
    return unsub
  }, [currentOrg, teamId])

  useEffect(() => {
    if (!currentOrg || !teamId || !team) return
    const unsub = subscribeToBoardStories(currentOrg.id, teamId, team.connectedProjectIds, setStories)
    return unsub
  }, [currentOrg, teamId, team?.connectedProjectIds.join(',')])

  const columns = useMemo(() => {
    if (!team) return []
    return [...team.boardConfig.columns].sort((a, b) => a.order.localeCompare(b.order))
  }, [team])

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns])

  const storiesByColumn = useMemo(() => {
    const map = new Map<string, Story[]>()
    for (const col of columns) map.set(col.id, [])
    for (const story of stories) {
      if (story.columnId && map.has(story.columnId)) {
        map.get(story.columnId)!.push(story)
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => (a.columnOrder ?? '').localeCompare(b.columnOrder ?? ''))
    }
    return map
  }, [stories, columns])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveStory(stories.find((s) => s.id === event.active.id) ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveStory(null)
    if (!over || active.id === over.id || !currentOrg || !teamId) return

    const draggedStory = stories.find((s) => s.id === active.id)
    if (!draggedStory) return

    let targetColumnId: string | null = null
    let targetList: Story[] = []

    // Dropped over another story?
    const overStory = stories.find((s) => s.id === over.id)
    if (overStory) {
      targetColumnId = overStory.columnId ?? null
    } else if (columnIds.includes(over.id as string)) {
      // Dropped directly onto an empty column droppable
      targetColumnId = over.id as string
    }

    if (!targetColumnId) return
    targetList = storiesByColumn.get(targetColumnId) ?? []

    let newOrder: string
    if (overStory) {
      const overIdx = targetList.findIndex((s) => s.id === over.id)
      const prevOrder = targetList[overIdx - 1]?.columnOrder ?? null
      const nextOrder = targetList[overIdx]?.columnOrder ?? null
      newOrder = keyBetween(prevOrder, nextOrder)
    } else {
      // Dropped on empty column — place at end
      const lastOrder = targetList[targetList.length - 1]?.columnOrder ?? null
      newOrder = keyBetween(lastOrder, null)
    }

    await moveStoryToColumn(currentOrg.id, draggedStory.projectId, draggedStory.id, teamId, targetColumnId, newOrder)
  }

  const handleAddStory = (columnId: string) => {
    setCreateColumnId(columnId)
  }

  const handleCreateStory = async (
    title: string,
    type: StoryType,
    priority: StoryPriority,
    projectId: string,
    estimate?: number,
  ) => {
    if (!currentOrg || !teamId || !createColumnId) return
    const colStories = storiesByColumn.get(createColumnId) ?? []
    const lastOrder = colStories[colStories.length - 1]?.columnOrder ?? null
    const columnOrder = keyBetween(lastOrder, null)

    await createStory(currentOrg.id, projectId, {
      title,
      type,
      priority,
      location: 'board',
      estimate,
      boardId: teamId,
      columnId: createColumnId,
      columnOrder,
    })
    toast.success('Story létrehozva!')
  }

  // Collect connected projects for the quick-create modal
  const connectedProjects = useMemo(() => {
    if (!team) return []
    return projects.filter((p) => team.connectedProjectIds.includes(p.id))
      .map((p) => ({ id: p.id, name: p.name, prefix: p.prefix }))
  }, [team, projects])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!team) {
    return <div className="p-6"><p className="text-sm text-gray-500">Csapat nem található.</p></div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Board header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <Users className="h-5 w-5 text-gray-400" />
        <h1 className="text-base font-semibold text-gray-900">{team.name}</h1>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {team.boardConfig.mode === 'kanban' ? 'Kanban' : 'Scrum'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {team.connectedProjectIds.length === 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 rounded-full px-3 py-1">
              Nincs kapcsolt projekt — add hozzá a Csapat beállítások alatt
            </span>
          )}
          <Link to={ROUTES.TEAM_SETTINGS(team.id)}>
            <Button variant="ghost" size="sm" icon={<Settings className="h-4 w-4" />}>
              Beállítások
            </Button>
          </Link>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-6 min-h-full">
            {columns.map((col) => (
              <BoardColumnView
                key={col.id}
                column={col}
                stories={storiesByColumn.get(col.id) ?? []}
                onAddStory={handleAddStory}
              />
            ))}
            {columns.length === 0 && (
              <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
                Nincsenek oszlopok. Állítsd be a csapat beállításokban.
              </div>
            )}
          </div>

          <DragOverlay>
            {activeStory && <StoryCard story={activeStory} projectId={activeStory.projectId} overlay />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Quick create modal */}
      <QuickCreateModal
        isOpen={createColumnId !== null && team.connectedProjectIds.length > 0}
        onClose={() => setCreateColumnId(null)}
        onSubmit={handleCreateStory}
        projects={connectedProjects}
      />

      {/* Warning modal when no projects connected */}
      {createColumnId !== null && team.connectedProjectIds.length === 0 && (
        <Modal
          isOpen
          onClose={() => setCreateColumnId(null)}
          title="Nincs kapcsolt projekt"
        >
          <p className="text-sm text-gray-600 mb-4">
            A board-ra való story hozzáadáshoz először kapcsolj projektet a csapathoz.
          </p>
          <Link to={ROUTES.TEAM_SETTINGS(team.id)} onClick={() => setCreateColumnId(null)}>
            <Button className="w-full">Csapat beállítások megnyitása</Button>
          </Link>
        </Modal>
      )}
    </div>
  )
}
