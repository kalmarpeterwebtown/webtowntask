import { useState, useEffect, type FormEvent, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ChevronDown, ChevronRight, Plus, Layout, Package, Archive, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StoryRow } from '@/components/backlog/StoryRow'
import { StoryFormModal } from '@/components/story/StoryFormModal'
import { useBacklog } from '@/hooks/useBacklog'
import { useOrgStore } from '@/stores/orgStore'
import { moveStory } from '@/services/story.service'
import { subscribeToTags, createTag, addTagToStory } from '@/services/tag.service'
import { keyBetween } from '@/utils/fractionalIndex'
import { toast } from '@/stores/uiStore'
import type { StoryLocation } from '@/types/enums'
import type { Story, Tag } from '@/types/models'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#64748b',
]

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
  isOpen: boolean
  onToggle: () => void
  onAddStory: (location: StoryLocation, afterOrder?: string) => void
  tagMap: Map<string, Tag>
  isTagDragging: boolean
  overStoryId: string | null
}

function BacklogSection({
  location, stories, projectId, isOpen, onToggle, onAddStory,
  tagMap, isTagDragging, overStoryId,
}: SectionProps) {
  const config = SECTION_CONFIG.find((s) => s.location === location)!
  const Icon = config.icon

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
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
        <div className="border-t border-gray-100 px-4 py-3 space-y-1">
          <SortableContext items={stories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {stories.map((story) => (
              <StoryRow
                key={story.id}
                story={story}
                projectId={projectId}
                tagMap={tagMap}
                isTagDragging={isTagDragging}
                isTagDropTarget={isTagDragging && overStoryId === story.id}
              />
            ))}
          </SortableContext>

          {stories.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">{config.emptyText}</p>
          )}

          <button
            onClick={() => onAddStory(
              location,
              stories[stories.length - 1]?.backlogOrder
                ?? stories[stories.length - 1]?.planboxOrder,
            )}
            className="flex items-center gap-2 w-full mt-2 px-2 py-1.5 text-sm text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Story hozzáadása
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function BacklogPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { currentOrg } = useOrgStore()
  const { groups, loading } = useBacklog(projectId ?? '')

  const [tags, setTags] = useState<Tag[]>([])
  const [tagMap, setTagMap] = useState<Map<string, Tag>>(new Map())
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

  // Subscribe to tags
  useEffect(() => {
    if (!currentOrg || !projectId) return
    return subscribeToTags(currentOrg.id, projectId, (t) => {
      setTags(t)
      setTagMap(new Map(t.map((tag) => [tag.id, tag])))
    })
  }, [currentOrg?.id, projectId])

  const toggleSection = (location: StoryLocation) => {
    setOpenSections((prev) => ({ ...prev, [location]: !prev[location] }))
  }

  const openAddStory = (location: StoryLocation, afterOrder?: string) => {
    setStoryForm({ open: true, location, afterOrder })
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveType(null)
    setActiveTag(null)
    setOverStoryId(null)

    if (!over || !currentOrg || !projectId) return

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
    const overStory = allStories.find((s) => s.id === over.id)
    if (!activeStory || !overStory) return

    const targetLocation = overStory.location as StoryLocation
    const targetList = groups[targetLocation]
    const overIdx = targetList.findIndex((s) => s.id === over.id)

    const prevOrder = targetList[overIdx - 1]?.backlogOrder ?? targetList[overIdx - 1]?.planboxOrder ?? null
    const nextOrder = overStory.backlogOrder ?? overStory.planboxOrder ?? null
    const newOrder = keyBetween(prevOrder, nextOrder)

    await moveStory(currentOrg.id, projectId, activeStory.id, targetLocation, newOrder)
  }

  if (!projectId) return null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Backlog</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading
              ? '...'
              : `${groups.board.length + groups.planbox.length + groups.backlog.length} story összesen`}
          </p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => openAddStory('backlog')}
        >
          Új story
        </Button>
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
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
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
                  isOpen={openSections[location]}
                  onToggle={() => toggleSection(location)}
                  onAddStory={openAddStory}
                  tagMap={tagMap}
                  isTagDragging={activeType === 'tag'}
                  overStoryId={overStoryId}
                />
              ))}
            </div>

            {/* Tag sidebar */}
            {currentOrg && (
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

      <StoryFormModal
        isOpen={storyForm.open}
        onClose={() => setStoryForm((s) => ({ ...s, open: false }))}
        projectId={projectId}
        defaultLocation={storyForm.location}
        afterOrder={storyForm.afterOrder}
      />
    </div>
  )
}
