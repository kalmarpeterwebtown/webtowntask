import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
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
import { useOrgStore } from '@/stores/orgStore'
import { subscribeToTeam, subscribeToBoardStories, moveStoryToColumn } from '@/services/team.service'
import { ROUTES, TYPE_COLORS, PRIORITY_COLORS } from '@/config/constants'
import { keyBetween } from '@/utils/fractionalIndex'
import type { Team, BoardColumn, Story } from '@/types/models'

// ── Story Card ────────────────────────────────────────────────────────────────

function StoryCard({ story, projectId, overlay = false }: { story: Story; projectId: string; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: story.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
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

      <div className="flex items-center justify-between gap-2 mt-2">
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
              <div
                key={i}
                title={name}
                className="h-5 w-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[9px] font-bold ring-1 ring-white"
              >
                {name[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task progress */}
      {story.taskCount > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-500"
              style={{ width: `${(story.taskDoneCount / story.taskCount) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400">
            {story.taskDoneCount}/{story.taskCount}
          </span>
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

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
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

      {/* Story list */}
      <div className={clsx(
        'flex-1 rounded-b-xl border border-t-0 border-gray-200 bg-gray-50/50 p-2 space-y-2 min-h-[200px]',
        wipOver && 'border-yellow-200 bg-yellow-50/30',
      )}>
        <SortableContext items={stories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              projectId={story.projectId}
            />
          ))}
        </SortableContext>

        {stories.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-gray-400">
            Húzz ide story-t
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

// ── Board Page ────────────────────────────────────────────────────────────────

export function BoardPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { currentOrg } = useOrgStore()

  const [team, setTeam] = useState<Team | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStory, setActiveStory] = useState<Story | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

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
    const unsub = subscribeToBoardStories(
      currentOrg.id,
      teamId,
      team.connectedProjectIds,
      setStories,
    )
    return unsub
  }, [currentOrg, teamId, team?.connectedProjectIds.join(',')])

  // Group stories by column
  const columns = useMemo(() => {
    if (!team) return []
    return [...team.boardConfig.columns].sort((a, b) => a.order.localeCompare(b.order))
  }, [team])

  const storiesByColumn = useMemo(() => {
    const map = new Map<string, Story[]>()
    for (const col of columns) map.set(col.id, [])
    for (const story of stories) {
      if (story.columnId && map.has(story.columnId)) {
        map.get(story.columnId)!.push(story)
      }
    }
    // Sort within each column by columnOrder
    for (const [, list] of map) {
      list.sort((a, b) => (a.columnOrder ?? '').localeCompare(b.columnOrder ?? ''))
    }
    return map
  }, [stories, columns])

  const handleDragStart = (event: DragStartEvent) => {
    const story = stories.find((s) => s.id === event.active.id)
    setActiveStory(story ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveStory(null)
    if (!over || active.id === over.id || !currentOrg || !teamId) return

    const draggedStory = stories.find((s) => s.id === active.id)
    if (!draggedStory) return

    // Determine target column: check if dropped over a story or directly over a column
    let targetColumnId: string | null = null
    let targetList: Story[] = []

    // Check if `over` is a story
    const overStory = stories.find((s) => s.id === over.id)
    if (overStory) {
      targetColumnId = overStory.columnId ?? null
    } else {
      // over.id might be a column id — not implemented yet; skip
      return
    }

    if (!targetColumnId) return
    targetList = storiesByColumn.get(targetColumnId) ?? []

    const overIdx = targetList.findIndex((s) => s.id === over.id)
    const prevOrder = targetList[overIdx - 1]?.columnOrder ?? null
    const nextOrder = targetList[overIdx]?.columnOrder ?? null
    const newOrder = keyBetween(prevOrder, nextOrder)

    await moveStoryToColumn(
      currentOrg.id,
      draggedStory.projectId,
      draggedStory.id,
      teamId,
      targetColumnId,
      newOrder,
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Csapat nem található.</p>
      </div>
    )
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
              Nincs kapcsolt projekt — húzz story-kat a Backlog → Board szekcióból
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
                onAddStory={() => {/* TODO: open story form with this column */}}
              />
            ))}

            {columns.length === 0 && (
              <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
                Nincsenek oszlopok.
              </div>
            )}
          </div>

          <DragOverlay>
            {activeStory && (
              <StoryCard story={activeStory} projectId={activeStory.projectId} overlay />
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
