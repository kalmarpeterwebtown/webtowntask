import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ChevronDown, ChevronRight, Plus, Layout, Package, Archive } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StoryRow } from '@/components/backlog/StoryRow'
import { StoryFormModal } from '@/components/story/StoryFormModal'
import { useBacklog } from '@/hooks/useBacklog'
import { useOrgStore } from '@/stores/orgStore'
import { moveStory } from '@/services/story.service'
import { keyBetween } from '@/utils/fractionalIndex'
import type { StoryLocation } from '@/types/enums'
import type { Story } from '@/types/models'

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

interface SectionProps {
  location: StoryLocation
  stories: Story[]
  projectId: string
  isOpen: boolean
  onToggle: () => void
  onAddStory: (location: StoryLocation, afterOrder?: string) => void
}

function BacklogSection({ location, stories, projectId, isOpen, onToggle, onAddStory }: SectionProps) {
  const config = SECTION_CONFIG.find((s) => s.location === location)!
  const Icon = config.icon

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Fejléc */}
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

      {/* Tartalom */}
      {isOpen && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-1">
          <SortableContext items={stories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {stories.map((story) => (
              <StoryRow key={story.id} story={story} projectId={projectId} />
            ))}
          </SortableContext>

          {stories.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">{config.emptyText}</p>
          )}

          {/* Story hozzáadás gomb */}
          <button
            onClick={() => onAddStory(location, stories[stories.length - 1]?.backlogOrder ?? stories[stories.length - 1]?.planboxOrder)}
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

export function BacklogPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { currentOrg } = useOrgStore()
  const { groups, loading } = useBacklog(projectId ?? '')

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const toggleSection = (location: StoryLocation) => {
    setOpenSections((prev) => ({ ...prev, [location]: !prev[location] }))
  }

  const openAddStory = (location: StoryLocation, afterOrder?: string) => {
    setStoryForm({ open: true, location, afterOrder })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !currentOrg || !projectId) return

    // Meghatározzuk melyik szekcióban van az aktív és a célpont
    const allStories = [...groups.board, ...groups.planbox, ...groups.backlog]
    const activeStory = allStories.find((s) => s.id === active.id)
    const overStory = allStories.find((s) => s.id === over.id)
    if (!activeStory || !overStory) return

    // Ha ugyanabban a szekcióban, egyszerű rendezés
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
    <div className="p-6 max-w-3xl mx-auto">
      {/* Fejléc */}
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-3">
            {SECTION_CONFIG.map(({ location }) => (
              <BacklogSection
                key={location}
                location={location}
                stories={groups[location]}
                projectId={projectId}
                isOpen={openSections[location]}
                onToggle={() => toggleSection(location)}
                onAddStory={openAddStory}
              />
            ))}
          </div>
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
