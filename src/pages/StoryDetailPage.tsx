import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Check, Plus, Trash2, MessageSquare, CheckSquare,
  ChevronDown,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useOrgStore } from '@/stores/orgStore'
import { useAuthStore } from '@/stores/authStore'
import { subscribeToStory, updateStory } from '@/services/story.service'
import { subscribeToTasks, createTask, toggleTask, deleteTask } from '@/services/task.service'
import { subscribeToComments, createComment } from '@/services/comment.service'
import { ROUTES, TYPE_COLORS, PRIORITY_COLORS, STATUS_COLORS } from '@/config/constants'
import type { Story } from '@/types/models'
import type { Task } from '@/types/models'
import type { Comment } from '@/types/models'
import type { StoryStatus, StoryType, StoryPriority } from '@/types/enums'

const TYPE_LABELS: Record<StoryType, string> = {
  feature: 'Feature',
  bug: 'Bug',
  tech_debt: 'Tech Debt',
  chore: 'Chore',
}

const PRIORITY_LABELS: Record<StoryPriority, string> = {
  critical: 'Kritikus',
  high: 'Magas',
  medium: 'Közepes',
  low: 'Alacsony',
}

const STATUS_LABELS: Record<StoryStatus, string> = {
  draft: 'Vázlat',
  ready: 'Kész',
  in_progress: 'Folyamatban',
  review: 'Review',
  done: 'Kész',
  delivered: 'Kiszállítva',
}

const STATUS_TRANSITIONS: Record<StoryStatus, StoryStatus[]> = {
  draft: ['ready'],
  ready: ['in_progress', 'draft'],
  in_progress: ['review', 'ready'],
  review: ['done', 'in_progress'],
  done: ['delivered', 'review'],
  delivered: ['done'],
}

export function StoryDetailPage() {
  const { projectId, storyId } = useParams<{ projectId: string; storyId: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrgStore()
  const { userProfile } = useAuthStore()

  const [story, setStory] = useState<Story | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const taskInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!currentOrg || !projectId || !storyId) return
    const unsub = subscribeToStory(currentOrg.id, projectId, storyId, (s) => {
      setStory(s)
      setLoading(false)
    })
    return unsub
  }, [currentOrg, projectId, storyId])

  useEffect(() => {
    if (!currentOrg || !projectId || !storyId) return
    const unsub = subscribeToTasks(currentOrg.id, projectId, storyId, setTasks)
    return unsub
  }, [currentOrg, projectId, storyId])

  useEffect(() => {
    if (!currentOrg || !projectId || !storyId) return
    const unsub = subscribeToComments(currentOrg.id, projectId, storyId, setComments)
    return unsub
  }, [currentOrg, projectId, storyId])

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !currentOrg || !projectId || !storyId) return
    const lastOrder = tasks[tasks.length - 1]?.order
    await createTask(currentOrg.id, projectId, storyId, newTaskTitle.trim(), lastOrder)
    setNewTaskTitle('')
    taskInputRef.current?.focus()
  }

  const handleTaskKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setAddingTask(false)
      setNewTaskTitle('')
    }
  }

  const handleToggleTask = async (task: Task) => {
    if (!currentOrg || !projectId || !storyId) return
    await toggleTask(currentOrg.id, projectId, storyId, task.id, !task.isDone)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!currentOrg || !projectId || !storyId) return
    await deleteTask(currentOrg.id, projectId, storyId, taskId)
  }

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault()
    if (!commentBody.trim() || !currentOrg || !projectId || !storyId) return
    setSubmittingComment(true)
    try {
      await createComment(currentOrg.id, projectId, storyId, commentBody.trim())
      setCommentBody('')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleStatusChange = async (newStatus: StoryStatus) => {
    if (!currentOrg || !projectId || !storyId) return
    setStatusOpen(false)
    await updateStory(currentOrg.id, projectId, storyId, { status: newStatus })
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-100" />
        <div className="h-8 w-2/3 rounded bg-gray-100" />
        <div className="h-4 w-1/3 rounded bg-gray-100" />
      </div>
    )
  }

  if (!story) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Story nem található.</p>
        <button onClick={() => navigate(-1)} className="mt-2 text-sm text-primary-600 hover:underline">
          Vissza
        </button>
      </div>
    )
  }

  const doneTasks = tasks.filter((t) => t.isDone).length
  const nextStatuses = STATUS_TRANSITIONS[story.status]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          to={ROUTES.BACKLOG(projectId!)}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Backlog
        </Link>
        <span>/</span>
        <span className="font-mono text-gray-400">#{story.sequenceNumber}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title + badges */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={clsx('rounded px-2 py-0.5 text-xs font-medium', TYPE_COLORS[story.type])}>
                {TYPE_LABELS[story.type]}
              </span>
              <span className={clsx('rounded px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[story.priority])}>
                {PRIORITY_LABELS[story.priority]}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-snug">{story.title}</h1>
            {story.description && (
              <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {story.description}
              </p>
            )}
            {!story.description && (
              <p className="mt-3 text-sm text-gray-400 italic">Nincs leírás.</p>
            )}
          </div>

          {/* Tasks */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <CheckSquare className="h-4 w-4" />
                Feladatok
                {tasks.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {doneTasks}/{tasks.length}
                  </span>
                )}
              </h2>
              {!addingTask && (
                <button
                  onClick={() => { setAddingTask(true); setTimeout(() => taskInputRef.current?.focus(), 50) }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Feladat
                </button>
              )}
            </div>

            {/* Progress bar */}
            {tasks.length > 0 && (
              <div className="mb-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{ width: `${(doneTasks / tasks.length) * 100}%` }}
                />
              </div>
            )}

            <div className="space-y-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2 hover:border-gray-200"
                >
                  <button
                    onClick={() => handleToggleTask(task)}
                    className={clsx(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      task.isDone
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-gray-300 hover:border-primary-400',
                    )}
                  >
                    {task.isDone && <Check className="h-3 w-3" />}
                  </button>
                  <span className={clsx(
                    'flex-1 text-sm',
                    task.isDone ? 'line-through text-gray-400' : 'text-gray-700',
                  )}>
                    {task.title}
                  </span>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="hidden group-hover:flex text-gray-300 hover:text-red-500 transition-colors"
                    aria-label="Törlés"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {addingTask && (
                <form onSubmit={handleAddTask} className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2">
                  <div className="h-4 w-4 shrink-0 rounded border border-gray-300" />
                  <input
                    ref={taskInputRef}
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={handleTaskKeyDown}
                    placeholder="Feladat neve…"
                    className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
                  />
                  <button type="submit" className="text-xs text-primary-600 font-medium hover:underline">
                    Mentés
                  </button>
                  <button type="button" onClick={() => { setAddingTask(false); setNewTaskTitle('') }} className="text-xs text-gray-400 hover:text-gray-600">
                    Mégse
                  </button>
                </form>
              )}

              {tasks.length === 0 && !addingTask && (
                <p className="py-3 text-center text-xs text-gray-400">Még nincsenek feladatok.</p>
              )}
            </div>
          </section>

          {/* Comments */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <MessageSquare className="h-4 w-4" />
              Hozzászólások
              {comments.length > 0 && (
                <span className="text-xs text-gray-400">{comments.length}</span>
              )}
            </h2>

            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar name={comment.authorName} src={comment.authorPhotoUrl} size="sm" className="shrink-0 mt-0.5" />
                  <div className="flex-1 rounded-xl border border-gray-100 bg-white px-4 py-3">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800">{comment.authorName}</span>
                      <span className="text-xs text-gray-400">
                        {comment.createdAt?.toDate?.().toLocaleDateString('hu-HU', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{comment.body}</p>
                  </div>
                </div>
              ))}

              {/* Add comment */}
              <form onSubmit={handleAddComment} className="flex gap-3">
                <Avatar name={userProfile?.displayName} src={userProfile?.photoUrl} size="sm" className="shrink-0 mt-0.5" />
                <div className="flex-1 rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-400 transition">
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Írj hozzászólást…"
                    rows={2}
                    className="block w-full resize-none px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none"
                  />
                  {commentBody.trim() && (
                    <div className="flex justify-end gap-2 border-t border-gray-100 px-3 py-2">
                      <button type="button" onClick={() => setCommentBody('')} className="text-xs text-gray-400 hover:text-gray-600">
                        Mégse
                      </button>
                      <Button type="submit" size="xs" loading={submittingComment}>
                        Küldés
                      </Button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Státusz</p>
            <div className="relative">
              <button
                onClick={() => setStatusOpen((o) => !o)}
                className={clsx(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  STATUS_COLORS[story.status],
                  'hover:opacity-80',
                )}
              >
                {STATUS_LABELS[story.status]}
                <ChevronDown className="h-4 w-4 opacity-60" />
              </button>
              {statusOpen && nextStatuses.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                  {nextStatuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <span className={clsx('rounded px-2 py-0.5 text-xs font-medium', STATUS_COLORS[s])}>
                        {STATUS_LABELS[s]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <MetaRow label="Típus">
              <span className={clsx('rounded px-2 py-0.5 text-xs font-medium', TYPE_COLORS[story.type])}>
                {TYPE_LABELS[story.type]}
              </span>
            </MetaRow>
            <MetaRow label="Prioritás">
              <span className={clsx('rounded px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[story.priority])}>
                {PRIORITY_LABELS[story.priority]}
              </span>
            </MetaRow>
            {story.estimate != null && (
              <MetaRow label="Becslés">
                <span className="text-sm font-semibold text-gray-700">{story.estimate} SP</span>
              </MetaRow>
            )}
            <MetaRow label="Helyszín">
              <span className="text-sm text-gray-600 capitalize">{story.location}</span>
            </MetaRow>
            <MetaRow label="Reporter">
              <span className="text-sm text-gray-600">{story.reporterName}</span>
            </MetaRow>
            {story.assigneeNames.length > 0 && (
              <MetaRow label="Assignees">
                <div className="flex flex-wrap gap-1">
                  {story.assigneeNames.map((name, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      <span className="h-4 w-4 rounded-full bg-primary-500 text-white text-[10px] flex items-center justify-center font-bold">
                        {name[0]?.toUpperCase()}
                      </span>
                      {name}
                    </span>
                  ))}
                </div>
              </MetaRow>
            )}
            <MetaRow label="Létrehozva">
              <span className="text-xs text-gray-500">
                {story.createdAt?.toDate?.().toLocaleDateString('hu-HU', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </span>
            </MetaRow>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-xs text-gray-400 pt-0.5">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  )
}
