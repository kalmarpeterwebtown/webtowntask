import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'
import { Calendar, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown, EllipsisVertical, ExternalLink, Flag, PackageCheck, PanelLeftClose, Play, Plus, Search, Settings, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { InlineStoryComposer } from '@/components/story/InlineStoryComposer'
import { useOrgStore } from '@/stores/orgStore'
import { useProjectAccessMap, useTeamAccessMap } from '@/hooks/useAccess'
import { useProjects } from '@/hooks/useProjects'
import { subscribeToTeam, subscribeToTeams, subscribeToBoardStories, moveStoryToColumn } from '@/services/team.service'
import { subscribeToProjectMemberships } from '@/services/access.service'
import { createStory, deleteStory, moveStoryOffBoard, moveStoryToBoard, subscribeToBacklog, updateStory } from '@/services/story.service'
import { subscribeToTags } from '@/services/tag.service'
import { toast } from '@/stores/uiStore'
import { ROUTES, TYPE_COLORS, PRIORITY_COLORS } from '@/config/constants'
import { keyBetween, compareFractionalKeys } from '@/utils/fractionalIndex'
import { storyRef, tasksRef, sprintsRef } from '@/utils/firestore'
import { canManage, canWrite } from '@/utils/permissions'
import type { Team, BoardColumn, Story, Tag, Task, ProjectMembership, Sprint } from '@/types/models'

const BOARD_STORY_PREFIX = 'board-story:'
const BACKLOG_STORY_PREFIX = 'backlog-story:'
const EMPTY_COLUMN_DROP_SUFFIX = '__empty-drop'
const TOP_COLUMN_DROP_SUFFIX = '__top-drop'

function toDayKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function enumerateDates(start: Date, end: Date) {
  const dates: Date[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cursor <= endDate) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function buildLinePath(
  values: number[],
  width: number,
  height: number,
  maxValue: number,
) {
  if (values.length === 0) return ''
  const stepX = values.length === 1 ? 0 : width / (values.length - 1)
  return values
    .map((value, index) => {
      const x = index * stepX
      const y = height - (value / Math.max(maxValue, 1)) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

// ── Story Card ────────────────────────────────────────────────────────────────

const QUICK_TYPE_LABELS: Record<string, string> = {
  feature: 'Feature',
  bug: 'Bug',
  tech_debt: 'Tech',
  chore: 'Chore',
}

const QUICK_PRIORITY_LABELS: Record<string, string> = {
  critical: 'Kritikus',
  high: 'Magas',
  medium: 'Közepes',
  low: 'Alacsony',
}

function StoryQuickMenu({
  story,
  onUpdateType,
  onUpdatePriority,
  onMoveToBacklog,
  onMoveToPlanbox,
  onDelete,
  canDelete,
}: {
  story: Story
  onUpdateType: (story: Story, type: Story['type']) => void
  onUpdatePriority: (story: Story, priority: Story['priority']) => void
  onMoveToBacklog?: (story: Story) => void
  onMoveToPlanbox?: (story: Story) => void
  onDelete?: (story: Story) => void
  canDelete?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        title="Gyorsműveletek"
      >
        <EllipsisVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Típus</div>
          {Object.entries(QUICK_TYPE_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { onUpdateType(story, value as Story['type']); setOpen(false) }}
              className={clsx(
                'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50',
                story.type === value ? 'text-primary-700' : 'text-gray-700',
              )}
            >
              <span>{label}</span>
              {story.type === value && <span className="text-xs font-semibold">Aktív</span>}
            </button>
          ))}

          <div className="mt-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Prioritás</div>
          {Object.entries(QUICK_PRIORITY_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { onUpdatePriority(story, value as Story['priority']); setOpen(false) }}
              className={clsx(
                'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50',
                story.priority === value ? 'text-primary-700' : 'text-gray-700',
              )}
            >
              <span>{label}</span>
              {story.priority === value && <span className="text-xs font-semibold">Aktív</span>}
            </button>
          ))}

          {(onMoveToBacklog || onMoveToPlanbox) && (
            <>
              <div className="mt-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Helyszín</div>
              {onMoveToBacklog && (
                <button
                  type="button"
                  onClick={() => { onMoveToBacklog(story); setOpen(false) }}
                  className="flex w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Backlog
                </button>
              )}
              {onMoveToPlanbox && (
                <button
                  type="button"
                  onClick={() => { onMoveToPlanbox(story); setOpen(false) }}
                  className="flex w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Planbox
                </button>
              )}
            </>
          )}

          {canDelete && onDelete && (
            <>
              <div className="mt-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Veszélyzóna</div>
              <button
                type="button"
                onClick={() => { onDelete(story); setOpen(false) }}
                className="flex w-full rounded-lg px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Törlés
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StoryCardBody({
  story,
  projectId,
  quickMenu,
}: {
  story: Story
  projectId: string
  quickMenu?: ReactNode
}) {
  return (
    <>
      <div className="flex items-start gap-2 mb-2">
        <span className={clsx('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', TYPE_COLORS[story.type])}>
          {story.type === 'tech_debt' ? 'Tech' : story.type.charAt(0).toUpperCase() + story.type.slice(1)}
        </span>
        <span className="text-[10px] font-mono text-gray-400">#{story.sequenceNumber}</span>
        {quickMenu && <div className="ml-auto">{quickMenu}</div>}
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
    </>
  )
}

function StoryCard({
  story,
  projectId,
  overlay = false,
  onUpdateType,
  onUpdatePriority,
  onMoveToBacklog,
  onMoveToPlanbox,
  onDeleteStory,
  canDeleteStory,
}: {
  story: Story
  projectId: string
  overlay?: boolean
  onUpdateType: (story: Story, type: Story['type']) => void
  onUpdatePriority: (story: Story, priority: Story['priority']) => void
  onMoveToBacklog: (story: Story) => void
  onMoveToPlanbox: (story: Story) => void
  onDeleteStory: (story: Story) => void
  canDeleteStory: (story: Story) => boolean
}) {
  const sortableId = `${BOARD_STORY_PREFIX}${story.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: {
      type: 'board-story',
      storyId: story.id,
      projectId: story.projectId,
    },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      data-testid={`story-card-${story.id}`}
      data-story-title={story.title}
      className={clsx(
        'rounded-lg border bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing transition-all',
        isDragging || overlay ? 'opacity-50 shadow-lg border-primary-300' : 'border-gray-200 hover:border-gray-300 hover:shadow',
      )}
    >
      <StoryCardBody
        story={story}
        projectId={projectId}
        quickMenu={!overlay ? (
          <StoryQuickMenu
            story={story}
            onUpdateType={onUpdateType}
            onUpdatePriority={onUpdatePriority}
            onMoveToBacklog={onMoveToBacklog}
            onMoveToPlanbox={onMoveToPlanbox}
            onDelete={onDeleteStory}
            canDelete={canDeleteStory(story)}
          />
        ) : undefined}
      />
    </div>
  )
}

function BacklogStoryCard({
  story,
  projectPrefix,
}: {
  story: Story
  projectPrefix: string
}) {
  const draggableId = `${BACKLOG_STORY_PREFIX}${story.projectId}:${story.id}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: {
      type: 'backlog-story',
      storyId: story.id,
      projectId: story.projectId,
    },
  })

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...attributes}
      {...listeners}
      className={clsx(
        'cursor-grab rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all active:cursor-grabbing',
        isDragging ? 'opacity-50 shadow-lg border-primary-300' : 'hover:border-primary-200 hover:shadow',
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-500">
          {projectPrefix}-{story.sequenceNumber}
        </span>
        <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', TYPE_COLORS[story.type])}>
          {story.type === 'tech_debt' ? 'Tech' : story.type.charAt(0).toUpperCase() + story.type.slice(1)}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug text-gray-800">{story.title}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[story.priority])}>
          {story.priority === 'critical' ? 'Krit.' : story.priority === 'high' ? 'Magas' : story.priority === 'medium' ? 'Köz.' : 'Ala.'}
        </span>
        {story.estimate != null && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
            {story.estimate} SP
          </span>
        )}
      </div>
    </div>
  )
}

function BacklogPanel({
  open,
  projects,
  expandedProjectIds,
  onToggleProject,
  onClose,
  onOpen,
  searchQuery,
  onSearchQueryChange,
  tagOptions,
  selectedTagId,
  onSelectedTagIdChange,
}: {
  open: boolean
  projects: Array<{
    id: string
    name: string
    prefix: string
    stories: Story[]
  }>
  expandedProjectIds: string[]
  onToggleProject: (projectId: string) => void
  onClose: () => void
  onOpen: () => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  tagOptions: Array<{ id: string; name: string; color: string; projectPrefix: string }>
  selectedTagId: string | null
  onSelectedTagIdChange: (tagId: string | null) => void
}) {
  return (
    <aside
      className={clsx(
        'relative border-r border-gray-200 bg-white transition-all duration-200',
        open ? 'w-80 min-w-80' : 'w-12 min-w-12',
      )}
    >
      {!open && (
        <button
          type="button"
          onClick={onOpen}
          className="flex h-full w-full flex-col items-center gap-3 px-2 py-4 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          title="Backlog panel megnyitása"
        >
          <ChevronRight className="h-4 w-4 shrink-0" />
          <span
            className="rotate-180 text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ writingMode: 'vertical-rl' }}
          >
            Backlog
          </span>
        </button>
      )}

      <div className={clsx('flex h-full flex-col', !open && 'hidden')}>
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Projekt backlogok</h2>
              <p className="mt-1 text-xs text-gray-500">Húzd a kapcsolt projektek story-jait közvetlenül a board oszlopaira.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Panel bezárása"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 space-y-3">
            <Input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Keresés címre vagy leírásra..."
              leftIcon={<Search className="h-4 w-4" />}
            />
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Tag szűrés</p>
                {selectedTagId && (
                  <button
                    type="button"
                    onClick={() => onSelectedTagIdChange(null)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-3 w-3" />
                    Törlés
                  </button>
                )}
              </div>
              {tagOptions.length === 0 ? (
                <p className="text-xs text-gray-400">Nincsenek tagek a kapcsolt projektekben.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tagOptions.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onSelectedTagIdChange(selectedTagId === tag.id ? null : tag.id)}
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        selectedTagId === tag.id
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                      )}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span>{tag.name}</span>
                      <span className={clsx('rounded px-1 py-0.5 text-[10px]', selectedTagId === tag.id ? 'bg-white/15 text-white/80' : 'bg-gray-100 text-gray-400')}>
                        {tag.projectPrefix}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-4">
            {projects.map((project) => (
              <section key={project.id} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3">
                <button
                  type="button"
                  onClick={() => onToggleProject(project.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                        {project.prefix}
                      </span>
                      <h3 className="truncate text-sm font-semibold text-gray-800">{project.name}</h3>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{project.stories.length} húzható story</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={ROUTES.BACKLOG(project.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                      title="Projekt backlog megnyitása"
                    >
                      Backlog
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <ChevronDown
                      className={clsx(
                        'h-4 w-4 shrink-0 text-gray-400 transition-transform',
                        expandedProjectIds.includes(project.id) && 'rotate-180',
                      )}
                    />
                  </div>
                </button>

                {expandedProjectIds.includes(project.id) && (
                  <div className="mt-3">
                    {project.stories.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-xs text-gray-400">
                        Nincs backlog vagy planbox story ebben a projektben.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {project.stories.map((story) => (
                          <BacklogStoryCard
                            key={story.id}
                            story={story}
                            projectPrefix={project.prefix}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Board Column ──────────────────────────────────────────────────────────────

function BoardColumnView({
  column,
  stories,
  itemIds,
  totalPoints,
  canEditWip,
  onSaveWipLimit,
  onAddStory,
  creating,
  projects,
  membersByProjectId,
  onCreateStory,
  onCancelCreate,
  onUpdateType,
  onUpdatePriority,
  onMoveToBacklog,
  onMoveToPlanbox,
  onDeleteStory,
  canDeleteStory,
}: {
  column: BoardColumn
  stories: Story[]
  itemIds: string[]
  totalPoints: number
  canEditWip: boolean
  onSaveWipLimit: (columnId: string, value: string) => Promise<void>
  onAddStory: (columnId: string) => void
  creating: boolean
  projects: { id: string; name: string; prefix: string }[]
  membersByProjectId: Record<string, ProjectMembership[]>
  onCreateStory: (input: { title: string; estimate?: number; projectId: string; assigneeId?: string; assigneeName?: string }) => Promise<void>
  onCancelCreate: () => void
  onUpdateType: (story: Story, type: Story['type']) => void
  onUpdatePriority: (story: Story, priority: Story['priority']) => void
  onMoveToBacklog: (story: Story) => void
  onMoveToPlanbox: (story: Story) => void
  onDeleteStory: (story: Story) => void
  canDeleteStory: (story: Story) => boolean
}) {
  const wipOver = column.wipLimit != null && stories.length > column.wipLimit
  const [wipDraft, setWipDraft] = useState(column.wipLimit?.toString() ?? '')
  const { setNodeRef: setColumnRef, isOver: isColumnOver } = useDroppable({ id: column.id })
  const { setNodeRef: setEmptyDropRef, isOver: isEmptyDropOver } = useDroppable({ id: `${column.id}${EMPTY_COLUMN_DROP_SUFFIX}` })
  const { setNodeRef: setTopDropRef, isOver: isTopDropOver } = useDroppable({ id: `${column.id}${TOP_COLUMN_DROP_SUFFIX}` })
  const currentWipValue = column.wipLimit?.toString() ?? ''

  // Build a map for fast story lookup by ID
  const storyMap = useMemo(() => {
    const m = new Map<string, Story>()
    for (const s of stories) m.set(s.id, s)
    return m
  }, [stories])

  // SortableContext items — derived from optimistic itemIds (during drag) or stories
  const sortableIds = useMemo(
    () => itemIds.map((id) => `${BOARD_STORY_PREFIX}${id}`),
    [itemIds],
  )

  const handleWipBlur = () => {
    void onSaveWipLimit(column.id, wipDraft)
  }

  return (
    <div className="flex flex-col w-72 shrink-0" data-testid={`board-column-${column.id}`} data-column-name={column.name}>
      <div className={clsx(
        'rounded-t-xl px-3 py-2.5 border-b',
        wipOver ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200',
      )}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color ?? '#6B7280' }} />
          <span className={clsx('flex-1 text-sm font-semibold', wipOver ? 'text-yellow-800' : 'text-gray-700')} data-testid="column-name">
            {column.name}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500">
            {totalPoints} SP
          </span>
          <span className={clsx(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            wipOver ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-600',
          )}>
            {stories.length}{column.wipLimit != null ? `/${column.wipLimit}` : ''}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">WIP limit</span>
          <Input
            type="number"
            min={1}
            step={1}
            value={wipDraft}
            onChange={(e) => setWipDraft(e.target.value)}
            onBlur={handleWipBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setWipDraft(currentWipValue)
                e.currentTarget.blur()
              }
            }}
            disabled={!canEditWip}
            placeholder="nincs"
            className="h-8 w-24 text-right text-xs"
          />
        </div>
      </div>

      <div
        ref={setColumnRef}
        className={clsx(
          'flex-1 rounded-b-xl border border-t-0 border-gray-200 p-2 space-y-2 min-h-[200px] transition-colors',
          wipOver && 'border-yellow-200',
          isColumnOver && !wipOver
            ? 'bg-primary-100/80 border-primary-300 shadow-inner'
            : 'bg-gray-50/50',
        )}
      >
        <div
          ref={setTopDropRef}
          data-testid={`column-top-drop-${column.id}`}
          className={clsx(
            'mb-2 h-6 rounded-md border border-dashed transition-colors',
            isTopDropOver ? 'border-primary-300 bg-primary-50' : 'border-transparent bg-transparent',
          )}
          aria-hidden="true"
        />

        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {itemIds.map((storyId) => {
            const story = storyMap.get(storyId)
            if (!story) return null
            return (
              <StoryCard
                key={story.id}
                story={story}
                projectId={story.projectId}
                onUpdateType={onUpdateType}
                onUpdatePriority={onUpdatePriority}
                onMoveToBacklog={onMoveToBacklog}
                onMoveToPlanbox={onMoveToPlanbox}
                onDeleteStory={onDeleteStory}
                canDeleteStory={canDeleteStory}
              />
            )
          })}
        </SortableContext>

        {stories.length === 0 && (
          <div className={clsx(
            'flex items-center justify-center h-16 text-xs rounded-lg border border-dashed transition-colors',
            isColumnOver || isEmptyDropOver ? 'border-primary-300 text-primary-500' : 'border-gray-200 text-gray-400',
          )}
            ref={setEmptyDropRef}
          >
            {isColumnOver ? 'Elengedés ide' : 'Húzz ide story-t'}
          </div>
        )}

        {creating ? (
          <InlineStoryComposer
            projects={projects}
            membersByProjectId={membersByProjectId}
            onSubmit={onCreateStory}
            onCancel={onCancelCreate}
            submitLabel="Kártya létrehozása"
            className="mt-2"
          />
        ) : (
          <button
            onClick={() => onAddStory(column.id)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Story hozzáadása
          </button>
        )}
      </div>
    </div>
  )
}

function SprintBurndownCard({
  sprint,
  stories,
  collapsed,
  onToggle,
}: {
  sprint: Sprint
  stories: Story[]
  collapsed: boolean
  onToggle: () => void
}) {
  const startDate = (sprint.startDate as { toDate?: () => Date })?.toDate?.() ?? new Date()
  const endDate = (sprint.endDate as { toDate?: () => Date })?.toDate?.() ?? new Date()
  const days = enumerateDates(startDate, endDate)
  const totalPoints = stories.reduce((sum, story) => sum + (story.estimate ?? 0), 0)

  const items = days.map((day, index) => {
    const key = toDayKey(day)
    const completedPoints = stories
      .filter((story) => {
        if (story.status !== 'done' && story.status !== 'delivered') return false
        const updatedAt = (story.updatedAt as { toDate?: () => Date })?.toDate?.()
        return updatedAt ? toDayKey(updatedAt) <= key : false
      })
      .reduce((sum, story) => sum + (story.estimate ?? 0), 0)

    const idealRemaining = Math.max(0, totalPoints - (totalPoints * index) / Math.max(days.length - 1, 1))
    const actualRemaining = Math.max(0, totalPoints - completedPoints)
    return {
      label: day.toLocaleDateString('hu-HU', { month: 'numeric', day: 'numeric' }),
      idealRemaining,
      actualRemaining,
    }
  })

  const maxPoints = Math.max(1, ...items.flatMap((item) => [item.idealRemaining, item.actualRemaining]))
  const completedPoints = stories
    .filter((story) => story.status === 'done' || story.status === 'delivered')
    .reduce((sum, story) => sum + (story.estimate ?? 0), 0)
  const remainingPoints = Math.max(0, totalPoints - completedPoints)
  const chartWidth = 720
  const chartHeight = 240
  const gridSteps = 4
  const actualPath = buildLinePath(items.map((item) => item.actualRemaining), chartWidth, chartHeight, maxPoints)
  const idealPath = buildLinePath(items.map((item) => item.idealRemaining), chartWidth, chartHeight, maxPoints)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Burndown</h2>
          <p className="mt-1 text-xs text-gray-500">
            {sprint.name} · {startDate.toLocaleDateString('hu-HU')} - {endDate.toLocaleDateString('hu-HU')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700">{totalPoints} SP összesen</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
            {completedPoints} SP kész
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">{remainingPoints} SP hátra</span>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-600 hover:border-gray-300"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {collapsed ? 'Megnyitás' : 'Összecsukás'}
          </button>
        </div>
      </div>

      {collapsed ? null : stories.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
          Még nincs ehhez a sprinthez rendelt story, ezért a burndown nem számolható.
        </div>
      ) : (
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px] rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <svg viewBox={`0 0 ${chartWidth + 56} ${chartHeight + 40}`} className="h-[300px] w-full">
            <g transform="translate(40,10)">
              {Array.from({ length: gridSteps + 1 }).map((_, index) => {
                const value = Math.round((maxPoints / gridSteps) * (gridSteps - index))
                const y = (chartHeight / gridSteps) * index
                return (
                  <g key={index}>
                    <line
                      x1={0}
                      y1={y}
                      x2={chartWidth}
                      y2={y}
                      stroke="#E5E7EB"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={-10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#9CA3AF"
                    >
                      {value}
                    </text>
                  </g>
                )
              })}

              {items.map((item, index) => {
                const x = items.length === 1 ? 0 : (chartWidth / (items.length - 1)) * index
                const yActual = chartHeight - (item.actualRemaining / Math.max(maxPoints, 1)) * chartHeight
                return (
                  <g key={item.label}>
                    <line x1={x} y1={0} x2={x} y2={chartHeight} stroke="#F3F4F6" />
                    <circle cx={x} cy={yActual} r={4} fill="#2563EB" />
                    <text x={x} y={chartHeight + 18} textAnchor="middle" fontSize="11" fill="#6B7280">
                      {item.label}
                    </text>
                    <text x={x} y={chartHeight + 32} textAnchor="middle" fontSize="10" fill="#9CA3AF">
                      {item.actualRemaining} SP
                    </text>
                  </g>
                )
              })}

              <path
                d={idealPath}
                fill="none"
                stroke="#9CA3AF"
                strokeWidth="3"
                strokeDasharray="8 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={actualPath}
                fill="none"
                stroke="#2563EB"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>
      </div>
      )}

      {!collapsed && (
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary-500" /> Tényleges hátralévő</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gray-300" /> Ideális hátralévő</span>
      </div>
      )}
    </div>
  )
}

function SprintStatusCard({
  activeSprint,
  planningSprint,
  sprintStories,
  onStartSprint,
  onCloseSprint,
  deliveredCount,
  onOpenDelivered,
  teamId,
}: {
  activeSprint: Sprint | null
  planningSprint: Sprint | null
  sprintStories: Story[]
  onStartSprint: () => void
  onCloseSprint: () => void
  deliveredCount: number
  onOpenDelivered: () => void
  teamId: string
}) {
  if (activeSprint) {
    const startDate = (activeSprint.startDate as { toDate?: () => Date })?.toDate?.()
    const endDate = (activeSprint.endDate as { toDate?: () => Date })?.toDate?.()
    const totalPoints = sprintStories.reduce((sum, story) => sum + (story.estimate ?? 0), 0)
    const donePoints = sprintStories
      .filter((story) => story.status === 'done' || story.status === 'delivered')
      .reduce((sum, story) => sum + (story.estimate ?? 0), 0)

    return (
      <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                Aktiv sprint
              </span>
              <h2 className="text-sm font-semibold text-gray-900">{activeSprint.name}</h2>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
                <Calendar className="h-3.5 w-3.5" />
                {startDate?.toLocaleDateString('hu-HU')} - {endDate?.toLocaleDateString('hu-HU')}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1">{sprintStories.length} story</span>
              <span className="rounded-full bg-white px-2.5 py-1">{totalPoints} SP</span>
              <span className="rounded-full bg-white px-2.5 py-1">{donePoints} SP kesz</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={ROUTES.SPRINTS(teamId)}>
              <Button variant="ghost" size="sm">Sprintek</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={onOpenDelivered}>
              Delivered ({deliveredCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<PackageCheck className="h-4 w-4" />}
              onClick={onCloseSprint}
            >
              Sprint zarasa
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (planningSprint) {
    const startDate = (planningSprint.startDate as { toDate?: () => Date })?.toDate?.()
    const endDate = (planningSprint.endDate as { toDate?: () => Date })?.toDate?.()
    return (
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                Tervezett sprint
              </span>
              <h2 className="text-sm font-semibold text-gray-900">{planningSprint.name}</h2>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              {startDate?.toLocaleDateString('hu-HU')} - {endDate?.toLocaleDateString('hu-HU')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={ROUTES.SPRINTS(teamId)}>
              <Button variant="ghost" size="sm">Sprintek</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={onOpenDelivered}>
              Delivered ({deliveredCount})
            </Button>
            <Button
              size="sm"
              icon={<Play className="h-4 w-4" />}
              onClick={onStartSprint}
            >
              Sprint inditasa
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Nincs aktiv sprint</h2>
          </div>
          <p className="mt-2 text-xs text-gray-500">Hozz letre vagy indits sprintet a csapat boardjahoz.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenDelivered}>
            Delivered ({deliveredCount})
          </Button>
          <Link to={ROUTES.SPRINTS(teamId)}>
            <Button size="sm">Sprint oldal megnyitasa</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Board Page ────────────────────────────────────────────────────────────────

export function BoardPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { currentOrg } = useOrgStore()
  const orgId = currentOrg?.id ?? null
  const { projects: allProjects } = useProjects()
  const {
    accessByProjectId,
    projects,
    loading: projectAccessLoading,
  } = useProjectAccessMap(allProjects)

  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [teamsReady, setTeamsReady] = useState(false)
  const [team, setTeam] = useState<Team | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [backlogStoriesByProject, setBacklogStoriesByProject] = useState<Record<string, Story[]>>({})
  const [tagsByProject, setTagsByProject] = useState<Record<string, Tag[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const [backlogOpen, setBacklogOpen] = useState(true)
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([])
  const [backlogSearchQuery, setBacklogSearchQuery] = useState('')
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [boardSearchQuery, setBoardSearchQuery] = useState('')
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([])
  const [selectedBoardTagIds, setSelectedBoardTagIds] = useState<string[]>([])
  const [taskAssigneesByStory, setTaskAssigneesByStory] = useState<Record<string, Array<{ id: string; name: string }>>>({})
  const [projectMembersByProject, setProjectMembersByProject] = useState<Record<string, ProjectMembership[]>>({})
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [deliveredOpen, setDeliveredOpen] = useState(false)
  const [burndownCollapsed, setBurndownCollapsed] = useState(true)
  const [closeSprintOpen, setCloseSprintOpen] = useState(false)
  const [closeIncompleteMode, setCloseIncompleteMode] = useState<'keep_on_board' | 'move_to_backlog'>('keep_on_board')
  const [sprintPanelOpen, setSprintPanelOpen] = useState(false)
  // Optimistic column items during drag — maps columnId → story ID array.
  // null = not dragging, use Firestore data as source of truth.
  const [columnItems, setColumnItems] = useState<Record<string, string[]> | null>(null)
  const columnItemsRef = useRef<Record<string, string[]> | null>(null)
  // Quick create state
  const [createColumnId, setCreateColumnId] = useState<string | null>(null)

  const {
    accessByTeamId,
    teams: visibleTeams,
    loading: teamAccessLoading,
  } = useTeamAccessMap(allTeams)
  const teamAccess = teamId ? accessByTeamId[teamId] ?? null : null
  const canAccessTeam = visibleTeams.some((visibleTeam) => visibleTeam.id === teamId)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))


  useEffect(() => {
    if (!orgId) return
    setTeamsReady(false)
    const unsub = subscribeToTeams(orgId, (teamsSnapshot) => {
      setAllTeams(teamsSnapshot)
      setTeamsReady(true)
    })
    return unsub
  }, [orgId])

  useEffect(() => {
    if (!orgId || !teamId) return
    if (teamsReady && !canAccessTeam && !teamAccessLoading) {
      setLoading(false)
      setTeam(null)
      return
    }
    if (!canAccessTeam) return
    const unsub = subscribeToTeam(orgId, teamId, (t) => {
      setTeam(t)
      setLoading(false)
    })
    return unsub
  }, [orgId, teamId, canAccessTeam, teamAccessLoading, teamsReady])

  const connectedProjectIds = useMemo(() => {
    if (!team) return []
    const visibleProjectIds = new Set(projects.map((project) => project.id))
    return (team.connectedProjectIds ?? []).filter((projectId) => visibleProjectIds.has(projectId))
  }, [team, projects])
  useEffect(() => {
    if (!orgId || !teamId || !team || !canAccessTeam) return
    const unsub = subscribeToBoardStories(orgId, teamId, connectedProjectIds, setStories)
    return unsub
  }, [orgId, teamId, team, canAccessTeam, connectedProjectIds])

  useEffect(() => {
    if (!orgId || !canAccessTeam || connectedProjectIds.length === 0) {
      setBacklogStoriesByProject({})
      return
    }

    const unsubs = connectedProjectIds.map((projectId) =>
      subscribeToBacklog(orgId, projectId, (projectStories) => {
        setBacklogStoriesByProject((prev) => ({
          ...prev,
          [projectId]: projectStories
            .filter((story) => story.location !== 'board')
            .sort((a, b) => {
              const aOrder = a.location === 'planbox' ? a.planboxOrder : a.backlogOrder
              const bOrder = b.location === 'planbox' ? b.planboxOrder : b.backlogOrder
              return compareFractionalKeys(aOrder, bOrder)
            }),
        }))
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [orgId, canAccessTeam, connectedProjectIds])

  useEffect(() => {
    if (!orgId || !canAccessTeam || connectedProjectIds.length === 0) {
      setTagsByProject({})
      return
    }

    const unsubs = connectedProjectIds.map((projectId) =>
      subscribeToTags(orgId, projectId, (tags) => {
        setTagsByProject((prev) => ({
          ...prev,
          [projectId]: tags,
        }))
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [orgId, canAccessTeam, connectedProjectIds])

  useEffect(() => {
    if (!orgId || !canAccessTeam || connectedProjectIds.length === 0) {
      setProjectMembersByProject({})
      return
    }

    const unsubs = connectedProjectIds.map((projectId) =>
      subscribeToProjectMemberships(orgId, projectId, (members) => {
        setProjectMembersByProject((prev) => ({ ...prev, [projectId]: members }))
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [orgId, canAccessTeam, connectedProjectIds])

  useEffect(() => {
    if (!orgId || !teamId) return
    const sprintQuery = query(sprintsRef(orgId, teamId), orderBy('createdAt', 'desc'))
    return onSnapshot(sprintQuery, (snap) => {
      setSprints(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sprint)))
    })
  }, [orgId, teamId])

  const columns = useMemo(() => {
    if (!team) return []
    return [...team.boardConfig.columns].sort((a, b) => compareFractionalKeys(a.order, b.order))
  }, [team])

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns])
  const resolveColumnDropId = useCallback((dropId: string): string | null => {
    if (columnIds.includes(dropId)) return dropId
    if (dropId.endsWith(EMPTY_COLUMN_DROP_SUFFIX)) {
      const columnId = dropId.slice(0, -EMPTY_COLUMN_DROP_SUFFIX.length)
      return columnIds.includes(columnId) ? columnId : null
    }
    if (dropId.endsWith(TOP_COLUMN_DROP_SUFFIX)) {
      const columnId = dropId.slice(0, -TOP_COLUMN_DROP_SUFFIX.length)
      return columnIds.includes(columnId) ? columnId : null
    }
    return null
  }, [columnIds])

  const boardAssigneeOptions = useMemo(() => {
    const options = new Map<string, { id: string; name: string; photoUrl?: string | null }>()

    for (const story of stories) {
      story.assigneeIds.forEach((assigneeId, index) => {
        const name = story.assigneeNames[index]
        if (assigneeId && name) {
          options.set(assigneeId, { id: assigneeId, name })
        }
      })

      for (const assignee of taskAssigneesByStory[story.id] ?? []) {
        options.set(assignee.id, assignee)
      }
    }

    Object.values(projectMembersByProject).flat().forEach((member) => {
      options.set(member.id, {
        id: member.id,
        name: member.displayName,
        photoUrl: member.photoUrl,
      })
    })

    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  }, [stories, taskAssigneesByStory, projectMembersByProject])

  const filteredBoardStories = useMemo(() => {
    const normalizedQuery = boardSearchQuery.trim().toLowerCase()

    return stories.filter((story) => {
      const taskAssignees = taskAssigneesByStory[story.id] ?? []
      const matchesSearch = normalizedQuery.length === 0
        || story.title.toLowerCase().includes(normalizedQuery)
        || (story.description ?? '').toLowerCase().includes(normalizedQuery)
      const matchesPerson = selectedPersonIds.length === 0
        || selectedPersonIds.some((assigneeId) =>
          story.assigneeIds.includes(assigneeId)
          || taskAssignees.some((assignee) => assignee.id === assigneeId),
        )
      const matchesTag = selectedBoardTagIds.length === 0
        || selectedBoardTagIds.some((tagId) => story.tagIds.includes(tagId))

      return matchesSearch && matchesPerson && matchesTag
    })
  }, [stories, boardSearchQuery, selectedPersonIds, selectedBoardTagIds, taskAssigneesByStory])

  const storiesByColumn = useMemo(() => {
    const map = new Map<string, Story[]>()
    for (const col of columns) map.set(col.id, [])
    for (const story of filteredBoardStories) {
      if (story.status === 'delivered') continue
      if (story.columnId && map.has(story.columnId)) {
        map.get(story.columnId)!.push(story)
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => compareFractionalKeys(a.columnOrder, b.columnOrder))
    }
    return map
  }, [filteredBoardStories, columns])

  // Simple collision detection: prefer story cards under pointer, fall back to closestCenter.
  // No dependencies → no stale closure issues.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const filtered = args.droppableContainers.filter(
      (c) => String(c.id) !== String(args.active.id),
    )
    const pw = pointerWithin({ ...args, droppableContainers: filtered })
    if (pw.length > 0) {
      // Prefer a story card hit for precise positioning within a column
      const storyHit = pw.find((c) => String(c.id).startsWith(BOARD_STORY_PREFIX))
      if (storyHit) return [storyHit]
      const topDropHit = pw.find((c) => String(c.id).endsWith(TOP_COLUMN_DROP_SUFFIX))
      if (topDropHit) return [topDropHit]
      const emptyDropHit = pw.find((c) => String(c.id).endsWith(EMPTY_COLUMN_DROP_SUFFIX))
      if (emptyDropHit) return [emptyDropHit]
      return [pw[0]]
    }
    return closestCenter({ ...args, droppableContainers: filtered })
  }, [])

  const totalBoardPoints = useMemo(
    () => filteredBoardStories.reduce((sum, story) => sum + (story.estimate ?? 0), 0),
    [filteredBoardStories],
  )

  const wipSummary = useMemo(() => {
    const limitedColumns = columns.filter((column) => column.wipLimit != null)
    const exceededColumns = limitedColumns.filter((column) => {
      const columnStories = storiesByColumn.get(column.id) ?? []
      return column.wipLimit != null && columnStories.length > column.wipLimit
    })

    return {
      limitedCount: limitedColumns.length,
      exceededCount: exceededColumns.length,
    }
  }, [columns, storiesByColumn])

  const connectedProjects = useMemo(() => {
    if (!team) return []
    const normalizedQuery = backlogSearchQuery.trim().toLowerCase()
    return projects
      .filter((project) => team.connectedProjectIds.includes(project.id))
      .map((project) => ({
        id: project.id,
        name: project.name,
        prefix: project.prefix,
        stories: (backlogStoriesByProject[project.id] ?? []).filter((story) => {
          const matchesSearch = normalizedQuery.length === 0
            || story.title.toLowerCase().includes(normalizedQuery)
            || (story.description ?? '').toLowerCase().includes(normalizedQuery)
          const matchesTag = !selectedTagId || story.tagIds.includes(selectedTagId)
          return matchesSearch && matchesTag
        }),
      }))
  }, [team, projects, backlogStoriesByProject, backlogSearchQuery, selectedTagId])

  const tagOptions = useMemo(() => {
    return projects
      .filter((project) => connectedProjectIds.includes(project.id))
      .flatMap((project) =>
        (tagsByProject[project.id] ?? []).map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          projectPrefix: project.prefix,
        })),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  }, [projects, connectedProjectIds, tagsByProject])

  const activeSprint = useMemo(
    () => sprints.find((sprint) => sprint.status === 'active') ?? null,
    [sprints],
  )
  const planningSprint = useMemo(
    () => sprints.find((sprint) => sprint.status === 'planning') ?? null,
    [sprints],
  )

  const deliveredStories = useMemo(
    () => stories.filter((story) => story.status === 'delivered'),
    [stories],
  )

  const sprintStories = useMemo(() => {
    if (!activeSprint) return []
    return stories.filter((story) => story.status !== 'delivered')
  }, [activeSprint, stories])

  const deliveredStoriesBySprint = useMemo(() => {
    const sprintNameById = new Map(sprints.map((sprint) => [sprint.id, sprint.name]))
    const groups = new Map<string, { sprintId: string | null; sprintName: string; stories: Story[] }>()

    deliveredStories.forEach((story) => {
      const sprintId = story.sprintId ?? null
      const key = sprintId ?? 'no-sprint'
      if (!groups.has(key)) {
        groups.set(key, {
          sprintId,
          sprintName: sprintId ? (sprintNameById.get(sprintId) ?? 'Korabbi sprint') : 'Sprint nelkuli delivered',
          stories: [],
        })
      }
      groups.get(key)?.stories.push(story)
    })

    return Array.from(groups.values()).sort((a, b) => a.sprintName.localeCompare(b.sprintName, 'hu'))
  }, [deliveredStories, sprints])

  useEffect(() => {
    setExpandedProjectIds((prev) => {
      const validIds = connectedProjects.map((project) => project.id)
      const filtered = prev.filter((id) => validIds.includes(id))
      const next = filtered.length > 0 ? filtered : validIds.slice(0, 1)
      // Return the same reference if the IDs didn't actually change — prevents
      // an infinite re-render loop when connectedProjects keeps producing a new
      // empty [] on every Firestore update while team hasn't loaded yet.
      if (next.length === prev.length && next.every((id, i) => prev[i] === id)) return prev
      return next
    })
  }, [connectedProjects])

  useEffect(() => {
    if (!orgId || stories.length === 0) {
      setTaskAssigneesByStory({})
      return
    }

    const unsubs = stories.map((story) =>
      onSnapshot(tasksRef(orgId, story.projectId, story.id), (snap) => {
        const assignees = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Task))
          .filter((task) => Boolean(task.assigneeId && task.assigneeName))
          .map((task) => ({ id: task.assigneeId as string, name: task.assigneeName as string }))

        setTaskAssigneesByStory((prev) => ({
          ...prev,
          [story.id]: Array.from(new Map(assignees.map((assignee) => [assignee.id, assignee])).values()),
        }))
      }),
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [orgId, stories])

  const toggleProjectAccordion = (projectId: string) => {
    setExpandedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    )
  }

  // ---------------------------------------------------------------------------
  // Drag handlers — uses optimistic `columnItems` state for visual ordering
  // during drag, Firestore as source of truth after drop.
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id)

    // Set activeStory for DragOverlay
    if (id.startsWith(BOARD_STORY_PREFIX)) {
      const storyId = id.slice(BOARD_STORY_PREFIX.length)
      setActiveStory(stories.find((s) => s.id === storyId) ?? null)
    } else if (id.startsWith(BACKLOG_STORY_PREFIX)) {
      const raw = id.slice(BACKLOG_STORY_PREFIX.length)
      const [projectId, storyId] = raw.split(':')
      setActiveStory(backlogStoriesByProject[projectId]?.find((s) => s.id === storyId) ?? null)
    }

    // Snapshot current Firestore state into optimistic local state
    const items: Record<string, string[]> = {}
    for (const [colId, colStories] of storiesByColumn) {
      items[colId] = colStories.map((s) => s.id)
    }
    columnItemsRef.current = items
    setColumnItems(items)
  }, [stories, backlogStoriesByProject, storiesByColumn])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over, collisions } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Resolve active story ID (board story or backlog story)
    const activeStoryId = activeId.startsWith(BOARD_STORY_PREFIX)
      ? activeId.slice(BOARD_STORY_PREFIX.length)
      : null // backlog stories don't participate in column item tracking

    // Only handle cross-column transfers for board stories
    if (!activeStoryId) return

    const prev = columnItemsRef.current
    if (!prev) return

    // Find which column the active item is currently in
    let activeCol: string | null = null
    for (const colId of Object.keys(prev)) {
      if (prev[colId].includes(activeStoryId)) { activeCol = colId; break }
    }

    // Find target column from over id
    let overCol: string | null = null
    let overIndex = -1
    const resolvedColumnId = resolveColumnDropId(overId)
    if (resolvedColumnId) {
      // Hovering over the column droppable itself
      overCol = resolvedColumnId
      if (overId.endsWith(TOP_COLUMN_DROP_SUFFIX)) {
        overIndex = 0
      } else {
        const activeRect = active.rect.current.translated
        const overRect = over.rect
        const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : null
        if (activeCenterY != null && activeCenterY <= overRect.top + 56) {
          overIndex = 0
        }
      }
    } else if (overId.startsWith(BOARD_STORY_PREFIX)) {
      const overStoryId = overId.slice(BOARD_STORY_PREFIX.length)
      for (const colId of Object.keys(prev)) {
        const idx = prev[colId].indexOf(overStoryId)
        if (idx >= 0) { overCol = colId; overIndex = idx; break }
      }
    }

    if (!overCol) {
      const collisionColumnId = collisions
        ?.map((collision) => resolveColumnDropId(String(collision.id)))
        .find((columnId): columnId is string => Boolean(columnId))
      if (collisionColumnId) {
        overCol = collisionColumnId
      }
    }

    if (!overCol) return

    if (activeCol === overCol) {
      if (!activeCol) return

      const activeIndex = prev[activeCol].indexOf(activeStoryId)
      const targetIndex = overId.startsWith(BOARD_STORY_PREFIX) || overId.endsWith(TOP_COLUMN_DROP_SUFFIX) || (resolvedColumnId && overIndex === 0)
        ? overIndex
        : -1
      if (activeIndex < 0 || targetIndex < 0 || activeIndex === targetIndex) return

      const next = {
        ...prev,
        [activeCol]: arrayMove(prev[activeCol], activeIndex, targetIndex),
      }
      columnItemsRef.current = next
      setColumnItems(next)
      return
    }

    // Cross-column transfer
    const next = { ...prev }

    // Remove from source column
    if (activeCol) {
      next[activeCol] = prev[activeCol].filter((id) => id !== activeStoryId)
    }

    // Add to target column
    const target = [...(prev[overCol] ?? [])]
    if (overIndex >= 0) {
      const insertIndex = (overId.endsWith(TOP_COLUMN_DROP_SUFFIX) || (resolvedColumnId && overIndex === 0))
        ? 0
        : overIndex + 1
      target.splice(insertIndex, 0, activeStoryId)
    } else {
      target.push(activeStoryId)
    }
    next[overCol] = target
    columnItemsRef.current = next
    setColumnItems(next)
  }, [resolveColumnDropId])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over, collisions } = event
    const snapshot = columnItemsRef.current // capture latest optimistic snapshot before reset

    // Always reset drag state
    setActiveStory(null)
    columnItemsRef.current = null
    setColumnItems(null)

    if (!over || !currentOrg || !teamId || !snapshot) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const collisionColumnId = collisions
      ?.map((collision) => resolveColumnDropId(String(collision.id)))
      .find((columnId): columnId is string => Boolean(columnId))

    // Identify the dragged story
    const isBacklogStory = activeId.startsWith(BACKLOG_STORY_PREFIX)
    const draggedStory = isBacklogStory
      ? (() => {
          const raw = activeId.slice(BACKLOG_STORY_PREFIX.length)
          const [projectId, storyId] = raw.split(':')
          return backlogStoriesByProject[projectId]?.find((s) => s.id === storyId)
        })()
      : stories.find((s) => `${BOARD_STORY_PREFIX}${s.id}` === activeId)

    if (!draggedStory) return

    // --- Backlog → Board: use over.id to determine target column, append to end ---
    if (isBacklogStory) {
      let targetColumnId: string | null = null
      const resolvedColumnId = resolveColumnDropId(overId) ?? collisionColumnId
      if (resolvedColumnId) {
        targetColumnId = resolvedColumnId
      } else if (overId.startsWith(BOARD_STORY_PREFIX)) {
        const overStoryId = overId.slice(BOARD_STORY_PREFIX.length)
        const overStory = stories.find((s) => s.id === overStoryId)
        targetColumnId = overStory?.columnId ?? null
      }
      if (!targetColumnId) return

      const colStories = storiesByColumn.get(targetColumnId) ?? []
      const lastOrder = colStories[colStories.length - 1]?.columnOrder ?? null
      let newOrder: string
      try { newOrder = keyBetween(lastOrder, null) } catch { newOrder = keyBetween(null, null) }

      await moveStoryToBoard(currentOrg.id, draggedStory.projectId, draggedStory.id, teamId, targetColumnId, newOrder)
      toast.success('Story áthúzva a boardra!')
      return
    }

    // --- Board → Board: determine position from optimistic snapshot ---
    // Find which column the story ended up in
    let targetColumnId: string | null = null
    let finalIds: string[] = []
    for (const [colId, ids] of Object.entries(snapshot)) {
      if (ids.includes(draggedStory.id)) {
        targetColumnId = colId
        finalIds = ids
        break
      }
    }

    if (!targetColumnId) return

    const originalIds = (storiesByColumn.get(draggedStory.columnId ?? '') ?? []).map((story) => story.id)
    const posIndex = finalIds.indexOf(draggedStory.id)
    if (posIndex < 0) return

    if (
      targetColumnId === draggedStory.columnId
      && originalIds.length === finalIds.length
      && originalIds.every((id, index) => id === finalIds[index])
    ) {
      return
    }

    // Cross-column move or same-column reorder: use optimistic snapshot position.
    const colStories = (storiesByColumn.get(targetColumnId) ?? [])
      .filter((s) => s.id !== draggedStory.id)

    // Look up neighbors from the snapshot
    const prevId = posIndex > 0 ? finalIds[posIndex - 1] : null
    const nextId = posIndex < finalIds.length - 1 ? finalIds[posIndex + 1] : null

    const prevOrder = prevId ? colStories.find((s) => s.id === prevId)?.columnOrder ?? null : null
    const nextOrder = nextId ? colStories.find((s) => s.id === nextId)?.columnOrder ?? null : null

    let newOrder: string
    try { newOrder = keyBetween(prevOrder, nextOrder) }
    catch { newOrder = keyBetween(prevOrder, null) }

    await moveStoryToColumn(currentOrg.id, draggedStory.projectId, draggedStory.id, teamId, targetColumnId, newOrder)
  }, [stories, storiesByColumn, backlogStoriesByProject, currentOrg, teamId, resolveColumnDropId])

  const handleAddStory = (columnId: string) => {
    setCreateColumnId(columnId)
  }

  const handleCreateStory = async (
    input: { title: string; estimate?: number; projectId: string; assigneeId?: string; assigneeName?: string },
  ) => {
    if (!currentOrg || !teamId || !createColumnId) return
    const colStories = storiesByColumn.get(createColumnId) ?? []
    const lastOrder = colStories[colStories.length - 1]?.columnOrder ?? null
    const columnOrder = keyBetween(lastOrder, null)

    const storyId = await createStory(currentOrg.id, input.projectId, {
      title: input.title,
      type: 'feature',
      priority: 'medium',
      location: 'board',
      estimate: input.estimate,
      boardId: teamId,
      columnId: createColumnId,
      columnOrder,
    })

    if (input.assigneeId && input.assigneeName) {
      await updateStory(currentOrg.id, input.projectId, storyId, {
        assigneeIds: [input.assigneeId],
        assigneeNames: [input.assigneeName],
      })
    }

    toast.success('Story létrehozva!')
    setCreateColumnId(null)
  }

  const handleQuickTypeUpdate = async (story: Story, type: Story['type']) => {
    if (!currentOrg) return
    await updateStory(currentOrg.id, story.projectId, story.id, { type })
  }

  const handleQuickPriorityUpdate = async (story: Story, priority: Story['priority']) => {
    if (!currentOrg) return
    await updateStory(currentOrg.id, story.projectId, story.id, { priority })
  }

  const handleQuickMoveToBacklog = async (story: Story) => {
    if (!currentOrg) return
    await moveStoryOffBoard(currentOrg.id, story.projectId, story.id, 'backlog', keyBetween(story.backlogOrder ?? null, null))
  }

  const handleQuickMoveToPlanbox = async (story: Story) => {
    if (!currentOrg) return
    await moveStoryOffBoard(currentOrg.id, story.projectId, story.id, 'planbox', keyBetween(story.planboxOrder ?? null, null))
  }

  const canDeleteStory = (story: Story) => canManage(accessByProjectId[story.projectId] ?? undefined)
  const canEditBoardColumns = canWrite(teamAccess ?? undefined)

  const handleDeleteStory = async (story: Story) => {
    if (!currentOrg || !canDeleteStory(story)) return
    if (!confirm(`Biztosan törlöd ezt a story-t?\n\n${story.title}`)) return

    await deleteStory(currentOrg.id, story.projectId, story.id)
    toast.success('Story törölve.')
  }

  const handleSaveColumnWipLimit = async (columnId: string, value: string) => {
    if (!currentOrg || !team || !canEditBoardColumns) return

    const trimmed = value.trim()
    const parsedLimit = trimmed === '' ? null : Number(trimmed)

    if (trimmed !== '') {
      if (parsedLimit == null || !Number.isFinite(parsedLimit) || parsedLimit <= 0 || !Number.isInteger(parsedLimit)) {
        toast.error('A WIP limitnek pozitiv egesz szamnak kell lennie.')
        return
      }
    }

    const nextColumns = team.boardConfig.columns.map((column) => {
      if (column.id !== columnId) return column
      if (parsedLimit == null) {
        return Object.fromEntries(Object.entries(column).filter(([key]) => key !== 'wipLimit')) as BoardColumn
      }
      return { ...column, wipLimit: parsedLimit }
    })

    await updateDoc(doc(db, 'organizations', currentOrg.id, 'teams', team.id), {
      'boardConfig.columns': nextColumns,
      updatedAt: serverTimestamp(),
    })
    toast.success('WIP limit frissitve.')
  }

  const executeCloseSprint = async () => {
    if (!currentOrg || !teamId || !activeSprint) return
    const doneColumnIds = new Set(columns.filter((column) => column.isDoneColumn).map((column) => column.id))
    const sprintScopedStories = stories.filter((story) => story.status !== 'delivered')
    const doneStories = sprintScopedStories.filter((story) => story.columnId && doneColumnIds.has(story.columnId))
    const incompleteStories = sprintScopedStories.filter((story) => !doneStories.some((doneStory) => doneStory.id === story.id))
    const totalPoints = sprintScopedStories.reduce((sum, story) => sum + (story.estimate ?? 0), 0)
    const completedPoints = doneStories.reduce((sum, story) => sum + (story.estimate ?? 0), 0)

    const updates: Promise<void>[] = [
      ...doneStories.map((story) =>
        updateDoc(storyRef(currentOrg.id, story.projectId, story.id), {
          status: 'delivered',
          sprintId: activeSprint.id,
          updatedAt: serverTimestamp(),
        }),
      ),
      updateDoc(doc(sprintsRef(currentOrg.id, teamId), activeSprint.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
        stats: {
          totalStories: sprintScopedStories.length,
          completedStories: doneStories.length,
          totalPoints,
          completedPoints,
          addedAfterStart: activeSprint.stats?.addedAfterStart ?? 0,
          removedDuringSprint: activeSprint.stats?.removedDuringSprint ?? 0,
        },
      }),
    ]

    if (closeIncompleteMode === 'move_to_backlog') {
      incompleteStories.forEach((story) => {
        updates.push(moveStoryOffBoard(
          currentOrg.id,
          story.projectId,
          story.id,
          'backlog',
          keyBetween(story.backlogOrder ?? null, null),
        ))
      })
    }

    await Promise.all(updates)

    toast.success('Sprint lezárva, a kész story-k delivered listába kerültek.')
    setDeliveredOpen(true)
    setCloseSprintOpen(false)
  }

  const handleStartSprint = async () => {
    if (!currentOrg || !teamId || !planningSprint) return
    if (!confirm(`Elinditod ezt a sprintet: ${planningSprint.name}?`)) return

    await updateDoc(doc(sprintsRef(currentOrg.id, teamId), planningSprint.id), {
      status: 'active',
    })

    toast.success('Sprint elinditva.')
  }

  // Collect connected projects for the quick-create modal
  const connectedProjectsForCreate = useMemo(() => {
    if (!team) return []
    return projects.filter((p) => team.connectedProjectIds.includes(p.id))
      .map((p) => ({ id: p.id, name: p.name, prefix: p.prefix }))
  }, [team, projects])

  if (loading || projectAccessLoading || teamAccessLoading || !teamsReady) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!canAccessTeam) {
    return <div className="p-6"><p className="text-sm text-gray-500">Ehhez a boardhoz jelenleg nincs hozzáférésed.</p></div>
  }

  if (!team) {
    return <div className="p-6"><p className="text-sm text-gray-500">Csapat nem található.</p></div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Board header */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-gray-400" />
          <h1 className="text-base font-semibold text-gray-900">{team.name}</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {team.boardConfig.mode === 'kanban' ? 'Kanban' : 'Scrum'}
          </span>
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
            {totalBoardPoints} SP
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
            {filteredBoardStories.length} story
          </span>
          {wipSummary.limitedCount > 0 && (
            <span
              className={clsx(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                wipSummary.exceededCount > 0
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-emerald-50 text-emerald-700',
              )}
            >
              WIP {wipSummary.exceededCount > 0
                ? `${wipSummary.exceededCount} tullepes`
                : `${wipSummary.limitedCount} limit aktiv`}
            </span>
          )}
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
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="w-full lg:max-w-md">
            <Input
              value={boardSearchQuery}
              onChange={(e) => setBoardSearchQuery(e.target.value)}
              placeholder="Keresés a boardon címre vagy leírásra..."
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Személyek</span>
              {boardAssigneeOptions.map((assignee) => {
                const selected = selectedPersonIds.includes(assignee.id)
                return (
                  <button
                    key={assignee.id}
                    type="button"
                    onClick={() => setSelectedPersonIds((prev) =>
                      prev.includes(assignee.id)
                        ? prev.filter((id) => id !== assignee.id)
                        : [...prev, assignee.id],
                    )}
                    className={clsx(
                      'rounded-full ring-2 transition-all',
                      selected ? 'ring-primary-500' : 'ring-transparent hover:ring-gray-300',
                    )}
                    title={assignee.name}
                  >
                    <Avatar src={assignee.photoUrl} name={assignee.name} size="sm" />
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Tagek</span>
              {tagOptions.map((tag) => {
                const selected = selectedBoardTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelectedBoardTagIds((prev) =>
                      prev.includes(tag.id)
                        ? prev.filter((id) => id !== tag.id)
                        : [...prev, tag.id],
                    )}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                )
              })}
            </div>
            {(boardSearchQuery || selectedPersonIds.length > 0 || selectedBoardTagIds.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setBoardSearchQuery('')
                  setSelectedPersonIds([])
                  setSelectedBoardTagIds([])
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Szűrés törlése
              </button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSprintPanelOpen((open) => !open)}
              icon={sprintPanelOpen ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            >
              Sprint panel
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <BacklogPanel
            open={backlogOpen}
            projects={connectedProjects}
            expandedProjectIds={expandedProjectIds}
            onToggleProject={toggleProjectAccordion}
            onClose={() => setBacklogOpen(false)}
            onOpen={() => setBacklogOpen(true)}
            searchQuery={backlogSearchQuery}
            onSearchQueryChange={setBacklogSearchQuery}
            tagOptions={tagOptions}
            selectedTagId={selectedTagId}
            onSelectedTagIdChange={setSelectedTagId}
          />
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 p-6 min-h-full">
              {columns.map((col) => {
                const colStories = storiesByColumn.get(col.id) ?? []
                // During drag use optimistic item order; otherwise derive from Firestore
                const itemIds = columnItems
                  ? (columnItems[col.id] ?? [])
                  : colStories.map((s) => s.id)
                return (
                  <BoardColumnView
                    key={col.id}
                    column={col}
                    stories={colStories}
                    itemIds={itemIds}
                    totalPoints={colStories.reduce((sum, story) => sum + (story.estimate ?? 0), 0)}
                    canEditWip={canEditBoardColumns}
                    onSaveWipLimit={handleSaveColumnWipLimit}
                    onAddStory={handleAddStory}
                    creating={createColumnId === col.id}
                    projects={connectedProjectsForCreate}
                    membersByProjectId={projectMembersByProject}
                    onCreateStory={handleCreateStory}
                    onCancelCreate={() => setCreateColumnId(null)}
                    onUpdateType={handleQuickTypeUpdate}
                    onUpdatePriority={handleQuickPriorityUpdate}
                    onMoveToBacklog={handleQuickMoveToBacklog}
                    onMoveToPlanbox={handleQuickMoveToPlanbox}
                    onDeleteStory={handleDeleteStory}
                    canDeleteStory={canDeleteStory}
                  />
                )
              })}
              {columns.length === 0 && (
                <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
                  Nincsenek oszlopok. Állítsd be a csapat beállításokban.
                </div>
              )}
              {columns.length > 0 && filteredBoardStories.length === 0 && (
                <div className="flex min-w-[320px] flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center text-sm text-gray-400">
                  Nincs a szűrésnek megfelelő story a boardon.
                </div>
              )}
            </div>
          </div>
          <aside
            className={clsx(
              'relative border-l border-gray-200 bg-white transition-all duration-200',
              sprintPanelOpen ? 'w-[380px] min-w-[380px]' : 'w-12 min-w-12',
            )}
          >
            {!sprintPanelOpen ? (
              <button
                type="button"
                onClick={() => setSprintPanelOpen(true)}
                className="flex h-full w-full flex-col items-center gap-3 px-2 py-4 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                title="Sprint panel megnyitása"
              >
                <ChevronsLeft className="h-4 w-4 shrink-0" />
                <span
                  className="rotate-180 text-[10px] font-semibold uppercase tracking-[0.22em]"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  Sprint
                </span>
              </button>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Sprint panel</h2>
                    <p className="mt-1 text-xs text-gray-500">Aktuális sprint, delivered és burndown egy helyen.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSprintPanelOpen(false)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="Sprint panel bezárása"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <SprintStatusCard
                    activeSprint={activeSprint}
                    planningSprint={planningSprint}
                    sprintStories={sprintStories}
                    onStartSprint={handleStartSprint}
                    onCloseSprint={() => setCloseSprintOpen(true)}
                    deliveredCount={deliveredStories.length}
                    onOpenDelivered={() => setDeliveredOpen((open) => !open)}
                    teamId={team.id}
                  />

                  {activeSprint && (
                    <SprintBurndownCard
                      sprint={activeSprint}
                      stories={sprintStories}
                      collapsed={burndownCollapsed}
                      onToggle={() => setBurndownCollapsed((value) => !value)}
                    />
                  )}

                  {deliveredOpen && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h2 className="text-sm font-semibold text-gray-900">Delivered</h2>
                          <p className="mt-1 text-xs text-gray-500">Sprintenként csoportosítva, bármikor újranyitható kártyákkal.</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
                          {deliveredStories.length} story
                        </span>
                      </div>
                      {deliveredStories.length === 0 ? (
                        <p className="text-sm text-gray-400">Még nincs delivered story ezen a boardon.</p>
                      ) : (
                        <div className="space-y-4">
                          {deliveredStoriesBySprint.map((group) => (
                            <section key={group.sprintId ?? group.sprintName}>
                              <div className="mb-2 flex items-center justify-between">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.sprintName}</h3>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                                  {group.stories.reduce((sum, story) => sum + (story.estimate ?? 0), 0)} SP
                                </span>
                              </div>
                              <div className="space-y-2">
                                {group.stories
                                  .sort((a, b) => {
                                    const aTime = (a.updatedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0
                                    const bTime = (b.updatedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0
                                    return bTime - aTime
                                  })
                                  .map((story) => (
                                    <Link
                                      key={story.id}
                                      to={ROUTES.STORY(story.projectId, story.id)}
                                      className="block rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:border-gray-300 hover:bg-white"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                          Delivered
                                        </span>
                                        {story.estimate != null && (
                                          <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                                            {story.estimate} SP
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-2 text-sm font-medium text-gray-800">{story.title}</p>
                                      <div className="mt-2 flex items-center justify-between gap-3">
                                        <p className="text-[11px] text-gray-400">#{story.sequenceNumber}</p>
                                        <span className="text-[11px] font-medium text-primary-600">Megnyitás</span>
                                      </div>
                                    </Link>
                                  ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>

          <DragOverlay>
            {activeStory && (
              <div className="w-72 rounded-lg border border-primary-300 bg-white p-3 opacity-90 shadow-lg">
                <StoryCardBody story={activeStory} projectId={activeStory.projectId} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
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

      <Modal
        isOpen={closeSprintOpen}
        onClose={() => setCloseSprintOpen(false)}
        title="Sprint lezárása"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            A kész oszlopban lévő story-k delivered státuszba kerülnek. Mit tegyünk a még nem kész board elemekkel?
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCloseIncompleteMode('keep_on_board')}
              className={`w-full rounded-xl border px-4 py-3 text-left ${
                closeIncompleteMode === 'keep_on_board'
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <p className="text-sm font-medium text-gray-800">Maradjanak a boardon</p>
              <p className="mt-1 text-xs text-gray-500">A következő sprint indulásakor is ott lesznek.</p>
            </button>
            <button
              type="button"
              onClick={() => setCloseIncompleteMode('move_to_backlog')}
              className={`w-full rounded-xl border px-4 py-3 text-left ${
                closeIncompleteMode === 'move_to_backlog'
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <p className="text-sm font-medium text-gray-800">Menjenek vissza backlogba</p>
              <p className="mt-1 text-xs text-gray-500">A nem kész elemek lekerülnek a boardról.</p>
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCloseSprintOpen(false)}>
              Mégse
            </Button>
            <Button className="flex-1" onClick={() => void executeCloseSprint()}>
              Sprint lezárása
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
