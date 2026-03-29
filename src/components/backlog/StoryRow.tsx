import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GripVertical, Layout, X } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'
import { MoveToBoardModal } from '@/components/story/MoveToBoardModal'
import { ROUTES, PRIORITY_COLORS, TYPE_COLORS } from '@/config/constants'
import { removeTagFromStory } from '@/services/tag.service'
import { useOrgStore } from '@/stores/orgStore'
import type { Story, Tag } from '@/types/models'

const TYPE_LABELS: Record<string, string> = {
  feature: 'Feature',
  bug: 'Bug',
  tech_debt: 'Tech',
  chore: 'Chore',
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Kritikus',
  high: 'Magas',
  medium: 'Közepes',
  low: 'Alacsony',
}

interface StoryRowProps {
  story: Story
  projectId: string
  tagMap?: Map<string, Tag>
  isTagDragging?: boolean
  isTagDropTarget?: boolean
}

export function StoryRow({
  story,
  projectId,
  tagMap,
  isTagDragging = false,
  isTagDropTarget = false,
}: StoryRowProps) {
  const navigate = useNavigate()
  const { currentOrg } = useOrgStore()
  const [moveToBoardOpen, setMoveToBoardOpen] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: story.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const storyTags = tagMap
    ? story.tagIds.map((id) => tagMap.get(id)).filter(Boolean) as Tag[]
    : []

  const handleRemoveTag = async (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation()
    if (!currentOrg) return
    await removeTagFromStory(currentOrg.id, projectId, story.id, tagId)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group flex flex-col rounded-lg border bg-white px-3 py-2.5',
        'hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer',
        isDragging && 'opacity-50 shadow-md',
        isTagDropTarget
          ? 'border-primary-400 ring-2 ring-primary-200'
          : isTagDragging
          ? 'border-dashed border-gray-300'
          : 'border-gray-100',
      )}
      onClick={() => navigate(ROUTES.STORY(projectId, story.id))}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          aria-label="Húzás a rendezéshez"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Típus badge */}
        <span className={clsx(
          'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
          TYPE_COLORS[story.type],
        )}>
          {TYPE_LABELS[story.type] ?? story.type}
        </span>

        {/* Story ID */}
        <span className="shrink-0 text-xs font-mono text-gray-400 hidden sm:block">
          #{story.sequenceNumber}
        </span>

        {/* Cím */}
        <span className="flex-1 truncate text-sm font-medium text-gray-800 group-hover:text-gray-900">
          {story.title}
        </span>

        {/* Prioritás */}
        <span className={clsx(
          'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium hidden md:block',
          PRIORITY_COLORS[story.priority],
        )}>
          {PRIORITY_LABELS[story.priority] ?? story.priority}
        </span>

        {/* Assignee initials */}
        {story.assigneeNames.length > 0 && (
          <div className="shrink-0 flex -space-x-1">
            {story.assigneeNames.slice(0, 3).map((name, i) => (
              <div
                key={i}
                className="h-6 w-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold ring-1 ring-white"
                title={name}
              >
                {name[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        )}

        {/* Move to board button (planbox only) */}
        {story.location === 'planbox' && (
          <button
            onClick={(e) => { e.stopPropagation(); setMoveToBoardOpen(true) }}
            className="shrink-0 hidden group-hover:flex items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-xs text-primary-600 hover:bg-primary-100 transition-colors"
            title="Áthelyezés boardra"
          >
            <Layout className="h-3.5 w-3.5" />
            Board
          </button>
        )}
      </div>

      {/* Tags row */}
      {storyTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 ml-7" onClick={(e) => e.stopPropagation()}>
          {storyTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button
                onClick={(e) => handleRemoveTag(e, tag.id)}
                className="opacity-70 hover:opacity-100 transition-opacity"
                title="Tag eltávolítása"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Tag drop hint */}
      {isTagDragging && storyTags.length === 0 && (
        <div className="mt-1.5 ml-7 text-xs text-gray-400 italic">
          Húzd ide a taget...
        </div>
      )}

      {moveToBoardOpen && (
        <MoveToBoardModal
          story={story}
          isOpen={moveToBoardOpen}
          onClose={() => setMoveToBoardOpen(false)}
        />
      )}
    </div>
  )
}
