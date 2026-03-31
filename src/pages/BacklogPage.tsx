import { useState, useEffect, useMemo, type FormEvent, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { clsx } from 'clsx'
import { ChevronDown, ChevronRight, Plus, Layout, Package, Archive, Link2, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StoryRow } from '@/components/backlog/StoryRow'
import { InlineStoryComposer } from '@/components/story/InlineStoryComposer'
import { ROUTES } from '@/config/constants'
import { useBacklog } from '@/hooks/useBacklog'
import { useProjects } from '@/hooks/useProjects'
import { useProjectAccessMap } from '@/hooks/useAccess'
import { useOrgStore } from '@/stores/orgStore'
import { createStory, deleteStory, moveStory, updateStory } from '@/services/story.service'
import { subscribeToTags, createTag, addTagToStory } from '@/services/tag.service'
import { subscribeToTeams } from '@/services/team.service'
import { subscribeToProjectMemberships } from '@/services/access.service'
import { keyBetween } from '@/utils/fractionalIndex'
import { canManage, canWrite } from '@/utils/permissions'
import { toast } from '@/stores/uiStore'
import type { StoryLocation } from '@/types/enums'
import type { Story, Tag, Team, ProjectMembership } from '@/types/models'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#64748b',
]

const TOP_SECTION_DROP_SUFFIX = '__top-drop'

const SECTION_CONFIG: {
  location: StoryLocation
  label: string
  icon: typeof Layout
  description: string
  emptyText: string
}[] = [
  {
    location: 'board',
    label: 'On Board',
    icon: Layout,
    description: 'Board-ra helyezett story-k',
    emptyText: 'Nincs board-on lévő story.',
  },
  {
    location: 'planbox',
    label: 'Planbox',
    icon: Package,
    description: 'Következő sprintbe tervezett',
    emptyText: 'Nincs planbox-ban story.',
  },
  {
    location: 'backlog',
    label: 'Backlog',
    icon: Archive,
    description: 'Nem prioritizált feladatok',
    emptyText: 'A backlog üres. Hozz létre egy új story-t!',
  },
]

// ─── Draggable tag chip in the sidebar ───────────────────────────────────────

function DraggableTagChip({ tag }: { tag: Tag }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: tag.id,
    data: { type: 'tag', tagId: tag.id },
  })

  const style: CSSProperties = {
    backgroundColor: tag.color,
    ...(transform ? { transform: `translate(${transform.x}px,${transform.y}px)`, zIndex: 50, position: 'relative' } : {}),
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white cursor-grab active:cursor-grabbing select-none"
    >
      {tag.name}
    </div>
  )
}

// ─── Tag Overlay (shown while dragging) ──────────────────────────────────────

function TagOverlay({ tag }: { tag: Tag }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white shadow-lg opacity-90"
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
    </div>
  )
}

// ─── Tag Sidebar ─────────────────────────────────────────────────────────────

interface TagSidebarProps {
  tags: Tag[]
  orgId: string
  projectId: string
}

function TagSidebar({ tags, orgId, projectId }: TagSidebarProps) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createTag(orgId, projectId, newName, newColor)
      setNewName('')
      setNewColor(PRESET_COLORS[0])
      setShowForm(false)
      toast.success('Tag létrehozva!')
    } catch {
      toast.error('Nem sikerült létrehozni a taget.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="w-52 shrink-0">
      <div className="rounded-xl border border-gray-200 bg-white p-4 sticky top-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <TagIcon className="h-3.5 w-3.5 text-gray-400" />
            Tagek
          </h3>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-gray-400 hover:text-primary-600 transition-colors"
            title="Új tag"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Tag creation form */}
        {showForm && (
          <form onSubmit={handleCreate} className="mb-3 space-y-2">
            <input
              type="text"
              placeholder="Tag neve..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              autoFocus
            />
            <div className="flex flex-wrap gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => { setShowForm(false); setNewName('') }}
                className="flex-1 rounded-lg border border-gray-200 py-1 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Mégse
              </button>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex-1 rounded-lg bg-primary-600 py-1 text-xs font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {creating ? '...' : 'Létrehoz'}
              </button>
            </div>
          </form>
        )}

        {/* Tag list */}
        {tags.length === 0 && !showForm ? (
          <p className="text-xs text-gray-400 text-center py-3">
            Még nincsenek tagek.<br />Kattints a + gombra!
          </p>
        ) : (
          <div className="space-y-1.5">
            {tags.map((tag) => (
              <DraggableTagChip key={tag.id} tag={tag} />
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <p className="mt-3 text-xs text-gray-400 text-center leading-tight">
            Húzd a taget egy story-ra az hozzárendeléséhez
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Backlog Section ──────────────────────────────────────────────────────────

interface SectionProps {
  location: StoryLocation
  stories: Story[]
  projectId: string
  readOnly: boolean
  isOpen: boolean
  onToggle: () => void
  onAddStory: (location: StoryLocation, afterOrder?: string) => void
  onEstimateSave: (storyId: string, estimate: number | null) => Promise<void>
  canDelete: boolean
  onDeleteStory: (story: Story) => void
  creating: boolean
  projectMembers: ProjectMembership[]
  onCreateStory: (location: StoryLocation, input: { title: string; estimate?: number; projectId: string; assigneeId?: string; assigneeName?: string }, afterOrder?: string) => Promise<void>
  onCancelCreate: () => void
  currentProject: { name: string; prefix: string } | null
  tagMap: Map<string, Tag>
  isTagDragging: boolean
  overStoryId: string | null
}

function BacklogSection({
  location, stories, projectId, readOnly, isOpen, onToggle, onAddStory,
  onEstimateSave,
  canDelete,
  onDeleteStory,
  creating,
  projectMembers,
  onCreateStory,
  onCancelCreate,
  currentProject,
  tagMap, isTagDragging, overStoryId,
}: SectionProps) {
  const config = SECTION_CONFIG.find((s) => s.location === location)!
  const Icon = config.icon
  const { setNodeRef: setTopDropRef, isOver: isTopDropOver } = useDroppable({ id: `${location}${TOP_SECTION_DROP_SUFFIX}` })

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
      data-testid={`backlog-section-${location}`}
      data-section-location={location}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <Icon className="h-4 w-4 text-gray-400 shrink-0" />
        <span className="font-semibold text-gray-800 text-sm">{config.label}</span>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {stories.length}
        </span>
        <span className="text-xs text-gray-400 hidden sm:block">{config.description}</span>
        <div className="ml-auto text-gray-400">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-1" data-testid={`backlog-section-body-${location}`}>
          <div
            ref={setTopDropRef}
            data-testid={`backlog-top-drop-${location}`}
            className={clsx(
              'mb-2 h-6 rounded-md border border-dashed transition-colors',
              isTopDropOver ? 'border-primary-300 bg-primary-50' : 'border-transparent bg-transparent',
            )}
            aria-hidden="true"
          />

          <SortableContext items={stories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {stories.map((story) => (
              <StoryRow
                key={story.id}
                story={story}
                projectId={projectId}
                readOnly={readOnly}
                onEstimateSave={onEstimateSave}
                canDelete={canDelete}
                onDelete={onDeleteStory}
                tagMap={tagMap}
                isTagDragging={isTagDragging}
                isTagDropTarget={isTagDragging && overStoryId === story.id}
              />
            ))}
          </SortableContext>

          {stories.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">{config.emptyText}</p>
          )}

          {creating ? (
            <InlineStoryComposer
              projects={[{ id: projectId, name: currentProject?.name ?? 'Projekt', prefix: currentProject?.prefix ?? 'PRJ' }]}
              membersByProjectId={{ [projectId]: projectMembers }}
              onSubmit={(input) => onCreateStory(location, input, stories[stories.length - 1]?.backlogOrder ?? stories[stories.length - 1]?.planboxOrder)}
              onCancel={onCancelCreate}
              className="mt-2"
            />
          ) : (
            <button
              onClick={() => onAddStory(
                location,
                stories[stories.length - 1]?.backlogOrder
                  ?? stories[stories.length - 1]?.planboxOrder,
              )}
              disabled={readOnly}
              className="flex items-center gap-2 w-full mt-2 px-2 py-1.5 text-sm text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Story hozzáadása
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function BacklogPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { currentOrg } = useOrgStore()
  const orgId = currentOrg?.id ?? null
  const { projects: allProjects } = useProjects()
  const {
    accessByProjectId,
    projects: visibleProjects,
    loading: accessLoading,
  } = useProjectAccessMap(allProjects)
  const projectAccess = projectId ? accessByProjectId[projectId] ?? null : null
  const readOnly = !canWrite(projectAccess ?? undefined)
  const canDeleteStory = canManage(projectAccess ?? undefined)
  const canAccessProject = visibleProjects.some((project) => project.id === projectId)
  const currentProject = useMemo(
    () => visibleProjects.find((project) => project.id === projectId) ?? null,
    [visibleProjects, projectId],
  )
  const { groups, loading } = useBacklog(projectId ?? '', canAccessProject)

  const [tags, setTags] = useState<Tag[]>([])
  const [linkedTeams, setLinkedTeams] = useState<Team[]>([])
  const [tagMap, setTagMap] = useState<Map<string, Tag>>(new Map())
  const [projectMembers, setProjectMembers] = useState<ProjectMembership[]>([])
  const [openSections, setOpenSections] = useState<Record<StoryLocation, boolean>>({
    board: false,
    planbox: true,
    backlog: true,
  })
  const [storyForm, setStoryForm] = useState<{
    open: boolean
    location: StoryLocation
    afterOrder?: string
  }>({ open: false, location: 'backlog' })

  // Drag state
  const [activeType, setActiveType] = useState<'story' | 'tag' | null>(null)
  const [activeTag, setActiveTag] = useState<Tag | null>(null)
  const [overStoryId, setOverStoryId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const collisionDetection = useMemo<CollisionDetection>(() => (args) => {
    const filtered = args.droppableContainers.filter((container) => String(container.id) !== String(args.active.id))
    const pw = pointerWithin({ ...args, droppableContainers: filtered })
    if (pw.length > 0) {
      const storyHit = pw.find((container) => {
        const id = String(container.id)
        return !id.endsWith(TOP_SECTION_DROP_SUFFIX)
      })
      if (storyHit) return [storyHit]
      const topDropHit = pw.find((container) => String(container.id).endsWith(TOP_SECTION_DROP_SUFFIX))
      if (topDropHit) return [topDropHit]
      return [pw[0]]
    }
    return closestCenter({ ...args, droppableContainers: filtered })
  }, [])

  // Subscribe to tags
  useEffect(() => {
    if (!orgId || !projectId || !canAccessProject) return
    return subscribeToTags(orgId, projectId, (t) => {
      setTags(t)
      setTagMap(new Map(t.map((tag) => [tag.id, tag])))
    })
  }, [orgId, projectId, canAccessProject])

  useEffect(() => {
    if (!orgId || !projectId) return
    return subscribeToTeams(orgId, (teams) => {
      setLinkedTeams(teams.filter((team) => team.connectedProjectIds.includes(projectId)))
    })
  }, [orgId, projectId])

  useEffect(() => {
    if (!orgId || !projectId || !canAccessProject) return
    return subscribeToProjectMemberships(orgId, projectId, setProjectMembers)
  }, [orgId, projectId, canAccessProject])

  const toggleSection = (location: StoryLocation) => {
    setOpenSections((prev) => ({ ...prev, [location]: !prev[location] }))
  }

  const openAddStory = (location: StoryLocation, afterOrder?: string) => {
    setStoryForm({ open: true, location, afterOrder })
  }

  const handleCreateStory = async (
    location: StoryLocation,
    input: { title: string; estimate?: number; projectId: string; assigneeId?: string; assigneeName?: string },
    afterOrder?: string,
  ) => {
    if (!orgId || !projectId || readOnly) return

    const storyId = await createStory(orgId, projectId, {
      title: input.title,
      type: 'feature',
      priority: 'medium',
      location,
      estimate: input.estimate,
      afterOrder,
    })

    if (input.assigneeId && input.assigneeName) {
      await updateStory(orgId, projectId, storyId, {
        assigneeIds: [input.assigneeId],
        assigneeNames: [input.assigneeName],
      })
    }

    setStoryForm({ open: false, location: 'backlog' })
    toast.success('Story létrehozva!')
  }

  const handleEstimateSave = async (storyId: string, estimate: number | null) => {
    if (readOnly || !orgId || !projectId) return
    await updateStory(orgId, projectId, storyId, { estimate })
    toast.success('Pontozás frissítve.')
  }

  const handleDeleteStory = async (story: Story) => {
    if (!orgId || !projectId || !canDeleteStory) return
    if (!confirm(`Biztosan törlöd ezt a story-t?\n\n${story.title}`)) return

    await deleteStory(orgId, projectId, story.id)
    toast.success('Story törölve.')
  }

  const handleDragStart = (event: DragStartEvent) => {
    const type = (event.active.data.current?.type as 'story' | 'tag') ?? 'story'
    setActiveType(type)
    if (type === 'tag') {
      const tag = tagMap.get(event.active.data.current?.tagId as string) ?? null
      setActiveTag(tag)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (activeType === 'tag') {
      setOverStoryId(event.over ? String(event.over.id) : null)
    }
  }

  const handleDragCancel = () => {
    setActiveType(null)
    setActiveTag(null)
    setOverStoryId(null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveType(null)
    setActiveTag(null)
    setOverStoryId(null)

    if (!over || !currentOrg || !projectId || readOnly) return

    // ── Tag dropped onto a story ──
    if (active.data.current?.type === 'tag') {
      const tagId = active.data.current.tagId as string
      const storyId = String(over.id)
      const allStories = [...groups.board, ...groups.planbox, ...groups.backlog]
      const story = allStories.find((s) => s.id === storyId)
      if (story && !story.tagIds.includes(tagId)) {
        try {
          await addTagToStory(currentOrg.id, projectId, story.id, tagId)
        } catch {
          toast.error('Nem sikerült hozzárendelni a taget.')
        }
      }
      return
    }

    // ── Story reorder ──
    if (active.id === over.id) return

    const allStories = [...groups.board, ...groups.planbox, ...groups.backlog]
    const activeStory = allStories.find((s) => s.id === active.id)
    if (!activeStory) return

    const overId = String(over.id)
    const topDropLocation = SECTION_CONFIG
      .map((section) => section.location)
      .find((location) => overId === `${location}${TOP_SECTION_DROP_SUFFIX}`) ?? null
    const overStory = allStories.find((s) => s.id === over.id)
    if (!overStory && !topDropLocation) return

    const sourceLocation = activeStory.location as StoryLocation
    const targetLocation = topDropLocation ?? (overStory!.location as StoryLocation)
    const sourceList = groups[sourceLocation]
    const targetList = groups[targetLocation]
    const activeIdx = sourceList.findIndex((s) => s.id === active.id)
    const overIdx = topDropLocation ? 0 : targetList.findIndex((s) => s.id === over.id)
    if (activeIdx < 0 || overIdx < 0) return

    const finalList = sourceLocation === targetLocation
      ? arrayMove(targetList, activeIdx, overIdx)
      : (() => {
          const next = targetList.filter((story) => story.id !== activeStory.id)
          next.splice(overIdx, 0, activeStory)
          return next
        })()
    const newIdx = finalList.findIndex((story) => story.id === activeStory.id)
    if (newIdx < 0) return

    const prevStory = finalList[newIdx - 1] ?? null
    const nextStory = finalList[newIdx + 1] ?? null
    const prevOrder = prevStory?.backlogOrder ?? prevStory?.planboxOrder ?? null
    const nextOrder = nextStory?.backlogOrder ?? nextStory?.planboxOrder ?? null
    const newOrder = keyBetween(prevOrder, nextOrder)

    await moveStory(currentOrg.id, projectId, activeStory.id, targetLocation, newOrder)
  }

  if (!projectId) return null

  if (accessLoading) {
    return (
      <div className="p-6">
        <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
      </div>
    )
  }

  if (!canAccessProject) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Ehhez a backloghoz jelenleg nincs hozzáférésed.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">Backlog</h1>
            {currentProject && (
              <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
                {currentProject.prefix}
              </span>
            )}
            {readOnly && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                Csak olvasás
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading || accessLoading
              ? '...'
              : `${groups.board.length + groups.planbox.length + groups.backlog.length} story összesen`}
          </p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => openAddStory('backlog')}
          disabled={readOnly}
        >
          Új story
        </Button>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Link2 className="h-4 w-4 text-primary-600" />
          Kapcsolt csapatok és boardok
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Innen látszik, mely csapatok használják ezt a projekt backlogját.
        </p>
        {linkedTeams.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">Ehhez a projekthez még nincs csapat kapcsolva.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {linkedTeams.map((team) => (
              <Link
                key={team.id}
                to={ROUTES.BOARD(team.id)}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 hover:border-primary-300 hover:text-primary-700"
              >
                <span>{team.name}</span>
                <span className="rounded bg-white px-2 py-0.5 text-[11px] text-gray-400">Board</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 items-start">
            {/* Main backlog */}
            <div className="flex-1 min-w-0 space-y-3">
              {SECTION_CONFIG.map(({ location }) => (
                <BacklogSection
                  key={location}
                  location={location}
                  stories={groups[location]}
                  projectId={projectId}
                  readOnly={readOnly}
                  isOpen={openSections[location]}
                  onToggle={() => toggleSection(location)}
                  onAddStory={openAddStory}
                  onEstimateSave={handleEstimateSave}
                  canDelete={canDeleteStory}
                  onDeleteStory={handleDeleteStory}
                  creating={storyForm.open && storyForm.location === location}
                  projectMembers={projectMembers}
                  onCreateStory={handleCreateStory}
                  onCancelCreate={() => setStoryForm((state) => ({ ...state, open: false }))}
                  currentProject={currentProject ? { name: currentProject.name, prefix: currentProject.prefix } : null}
                  tagMap={tagMap}
                  isTagDragging={activeType === 'tag'}
                  overStoryId={overStoryId}
                />
              ))}
            </div>

            {/* Tag sidebar */}
            {currentOrg && !readOnly && (
              <TagSidebar
                tags={tags}
                orgId={currentOrg.id}
                projectId={projectId}
              />
            )}
          </div>

          {/* Drag overlay for tags */}
          <DragOverlay>
            {activeType === 'tag' && activeTag && (
              <TagOverlay tag={activeTag} />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
