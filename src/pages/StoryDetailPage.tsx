import { Fragment, useState, useEffect, useRef, useCallback, type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Check, Plus, Trash2, MessageSquare, CheckSquare,
  Bold, ChevronDown, Clock3, Italic, List, Paperclip, PencilLine, UserCircle2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { useOrgStore } from '@/stores/orgStore'
import { useAuthStore } from '@/stores/authStore'
import { useProjects } from '@/hooks/useProjects'
import { useProjectAccessMap } from '@/hooks/useAccess'
import { subscribeToProjectMemberships } from '@/services/access.service'
import { subscribeToStory, updateStory } from '@/services/story.service'
import { subscribeToTasks, createTask, toggleTask, deleteTask, updateTaskAssignee, updateTaskDescription } from '@/services/task.service'
import { subscribeToAttachments, uploadStoryAttachment } from '@/services/attachment.service'
import { createWorklog, subscribeToWorklogs } from '@/services/worklog.service'
import { subscribeToComments, createComment } from '@/services/comment.service'
import { extractMentionedMembers, notifyMentionedUsers } from '@/services/notification.service'
import { ROUTES, TYPE_COLORS, PRIORITY_COLORS, STATUS_COLORS } from '@/config/constants'
import { minutesToDisplay, parseWorklogInput } from '@/utils/formatters'
import { canWrite } from '@/utils/permissions'
import { toast } from '@/stores/uiStore'
import type { Story } from '@/types/models'
import type { Task } from '@/types/models'
import type { Comment, ProjectMembership, Attachment, Worklog } from '@/types/models'
import type { StoryStatus, StoryType, StoryPriority, StoryLocation } from '@/types/enums'

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

const LOCATION_LABELS: Record<StoryLocation, string> = {
  backlog: 'Backlog',
  planbox: 'Planbox',
  board: 'Board',
}

function renderInlineFormatting(text: string): ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

function RichTextContent({ value }: { value: string }) {
  const lines = value.split('\n')
  const blocks: ReactNode[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push(
      <ul key={`list-${blocks.length}`} className="list-disc pl-5 space-y-1">
        {listItems.map((item, index) => (
          <li key={index}>{renderInlineFormatting(item)}</li>
        ))}
      </ul>,
    )
    listItems = []
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.slice(2))
      return
    }

    flushList()
    if (trimmed.length === 0) {
      blocks.push(<div key={`spacer-${index}`} className="h-2" />)
      return
    }

    blocks.push(
      <p key={`p-${index}`} className="leading-relaxed">
        {renderInlineFormatting(line)}
      </p>,
    )
  })

  flushList()

  return <div className="space-y-2 text-sm text-gray-600">{blocks}</div>
}

function getMentionQuery(value: string, caretPosition: number) {
  const beforeCaret = value.slice(0, caretPosition)
  const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/)
  return match ? match[1] ?? '' : null
}

function insertMentionAtCaret(
  value: string,
  caretPosition: number,
  mentionValue: string,
) {
  const beforeCaret = value.slice(0, caretPosition)
  const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/)
  if (!match || typeof match.index !== 'number') {
    return { value, caret: caretPosition }
  }

  const prefix = value.slice(0, match.index)
  const leadingSpace = beforeCaret[match.index] === ' ' ? ' ' : ''
  const suffix = value.slice(caretPosition)
  const nextValue = `${prefix}${leadingSpace}@${mentionValue} ${suffix}`
  const nextCaret = `${prefix}${leadingSpace}@${mentionValue} `.length
  return { value: nextValue, caret: nextCaret }
}

function applyMarkdownFormat(
  textarea: HTMLTextAreaElement | null,
  mode: 'bold' | 'italic' | 'bullet',
  onChange: (value: string) => void,
) {
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selected = value.slice(start, end)

  let nextValue = value
  let nextStart = start
  let nextEnd = end

  if (mode === 'bold') {
    nextValue = `${value.slice(0, start)}**${selected || 'félkövér'}**${value.slice(end)}`
    nextStart = start + 2
    nextEnd = start + 2 + (selected || 'félkövér').length
  } else if (mode === 'italic') {
    nextValue = `${value.slice(0, start)}*${selected || 'dőlt'}*${value.slice(end)}`
    nextStart = start + 1
    nextEnd = start + 1 + (selected || 'dőlt').length
  } else {
    const lines = value.slice(start, end || start).split('\n')
    const withBullets = lines.map((line) => (line.startsWith('- ') ? line : `- ${line || 'listaelem'}`)).join('\n')
    nextValue = `${value.slice(0, start)}${withBullets}${value.slice(end)}`
    nextStart = start
    nextEnd = start + withBullets.length
  }

  onChange(nextValue)
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(nextStart, nextEnd)
  })
}

export function StoryDetailPage() {
  const { projectId, storyId } = useParams<{ projectId: string; storyId: string }>()
  const navigate = useNavigate()
  const { currentOrg, orgRole } = useOrgStore()
  const { userProfile } = useAuthStore()
  const { projects: allProjects } = useProjects()
  const {
    accessByProjectId,
    projects: visibleProjects,
    loading: accessLoading,
  } = useProjectAccessMap(allProjects)
  const projectAccess = projectId ? accessByProjectId[projectId] ?? null : null
  const readOnly = !canWrite(projectAccess ?? undefined)
  const canViewWorklogs = orgRole !== 'client'
  const canAccessProject = visibleProjects.some((project) => project.id === projectId)

  const [story, setStory] = useState<Story | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [worklogs, setWorklogs] = useState<Worklog[]>([])
  const [projectMembers, setProjectMembers] = useState<ProjectMembership[]>([])
  const [loading, setLoading] = useState(true)

  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [estimateInput, setEstimateInput] = useState('')
  const [savingEstimate, setSavingEstimate] = useState(false)
  const [savingMetaField, setSavingMetaField] = useState<string | null>(null)
  const [assignMenuTaskId, setAssignMenuTaskId] = useState<string | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [attachmentDropActive, setAttachmentDropActive] = useState(false)
  const [storyWorklogInput, setStoryWorklogInput] = useState('')
  const [storyWorklogDescription, setStoryWorklogDescription] = useState('')
  const [taskWorklogInputById, setTaskWorklogInputById] = useState<Record<string, string>>({})
  const [taskWorklogDescriptionById, setTaskWorklogDescriptionById] = useState<Record<string, string>>({})
  const [submittingStoryWorklog, setSubmittingStoryWorklog] = useState(false)
  const [submittingTaskWorklogId, setSubmittingTaskWorklogId] = useState<string | null>(null)
  const [storyDescriptionDraft, setStoryDescriptionDraft] = useState('')
  const [savingStoryDescription, setSavingStoryDescription] = useState(false)
  const [editingTaskDescriptionId, setEditingTaskDescriptionId] = useState<string | null>(null)
  const [taskDescriptionDraftById, setTaskDescriptionDraftById] = useState<Record<string, string>>({})
  const [descriptionMentionQuery, setDescriptionMentionQuery] = useState<string | null>(null)
  const [commentMentionQuery, setCommentMentionQuery] = useState<string | null>(null)

  const taskInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const storyDescriptionRef = useRef<HTMLTextAreaElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const descriptionSaveTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!currentOrg || !projectId || !storyId || !canAccessProject) return
    const unsub = subscribeToStory(currentOrg.id, projectId, storyId, (s) => {
      setStory(s)
      setLoading(false)
    })
    return unsub
  }, [currentOrg, projectId, storyId, canAccessProject])

  useEffect(() => {
    if (!currentOrg || !projectId || !storyId || !canAccessProject) return
    const unsub = subscribeToTasks(currentOrg.id, projectId, storyId, setTasks)
    return unsub
  }, [currentOrg, projectId, storyId, canAccessProject])

  useEffect(() => {
    if (!currentOrg || !projectId || !storyId || !canAccessProject) return
    const unsub = subscribeToAttachments(currentOrg.id, projectId, storyId, setAttachments)
    return unsub
  }, [currentOrg, projectId, storyId, canAccessProject])

  useEffect(() => {
    if (!currentOrg || !projectId || !storyId || !canAccessProject) return
    const unsub = subscribeToWorklogs(currentOrg.id, projectId, storyId, setWorklogs)
    return unsub
  }, [currentOrg, projectId, storyId, canAccessProject])

  useEffect(() => {
    if (!currentOrg || !projectId || !canAccessProject) return
    const unsub = subscribeToProjectMemberships(currentOrg.id, projectId, setProjectMembers)
    return unsub
  }, [currentOrg, projectId, canAccessProject])

  useEffect(() => {
    if (!currentOrg || !projectId || !storyId || !canAccessProject) return
    const unsub = subscribeToComments(currentOrg.id, projectId, storyId, setComments)
    return unsub
  }, [currentOrg, projectId, storyId, canAccessProject])

  useEffect(() => {
    setEstimateInput(story?.estimate != null ? String(story.estimate) : '')
  }, [story?.estimate])

  useEffect(() => {
    setStoryDescriptionDraft(story?.description ?? '')
  }, [story?.description])

  useEffect(() => {
    setTaskDescriptionDraftById(
      Object.fromEntries(tasks.map((task) => [task.id, task.description ?? ''])),
    )
  }, [tasks])

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault()
    if (readOnly || !newTaskTitle.trim() || !currentOrg || !projectId || !storyId) return
    const lastOrder = tasks[tasks.length - 1]?.order
    await createTask(currentOrg.id, projectId, storyId, newTaskTitle.trim(), lastOrder)
    setNewTaskTitle('')
    taskInputRef.current?.focus()
  }

  const handleTaskKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
      return
    }

    if (e.key === 'Escape') {
      setAddingTask(false)
      setNewTaskTitle('')
    }
  }

  const handleToggleTask = async (task: Task) => {
    if (readOnly || !currentOrg || !projectId || !storyId) return
    await toggleTask(currentOrg.id, projectId, storyId, task.id, !task.isDone)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (readOnly || !currentOrg || !projectId || !storyId) return
    await deleteTask(currentOrg.id, projectId, storyId, taskId)
  }

  const handleAssignTask = async (taskId: string, member: ProjectMembership | null) => {
    if (readOnly || !currentOrg || !projectId || !storyId) return
    await updateTaskAssignee(
      currentOrg.id,
      projectId,
      storyId,
      taskId,
      member ? { id: member.id, name: member.displayName } : null,
    )
    setAssignMenuTaskId(null)
  }

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault()
    if (readOnly || !commentBody.trim() || !currentOrg || !projectId || !storyId) return
    setSubmittingComment(true)
    try {
      const mentionedMembers = extractMentionedMembers(commentBody.trim(), projectMembers)
      await createComment(currentOrg.id, projectId, storyId, commentBody.trim(), mentionedMembers.map((member) => member.id))
      if (userProfile) {
        await notifyMentionedUsers({
          orgId: currentOrg.id,
          projectId,
          storyId,
          actorId: userProfile.id,
          actorName: userProfile.displayName,
          body: commentBody.trim(),
          members: projectMembers,
        })
      }
      setCommentBody('')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleStatusChange = async (newStatus: StoryStatus) => {
    if (readOnly || !currentOrg || !projectId || !storyId) return
    setStatusOpen(false)
    await updateStory(currentOrg.id, projectId, storyId, { status: newStatus })
  }

  const handleEstimateSave = async () => {
    if (readOnly || !currentOrg || !projectId || !storyId) return
    setSavingEstimate(true)
    try {
      const parsedEstimate = estimateInput.trim() === '' ? null : Number(estimateInput)
      await updateStory(currentOrg.id, projectId, storyId, {
        estimate: parsedEstimate != null && !Number.isNaN(parsedEstimate) ? parsedEstimate : null,
      })
    } finally {
      setSavingEstimate(false)
    }
  }

  const handleMetaUpdate = async <K extends 'type' | 'priority' | 'location'>(
    field: K,
    value: Story[K],
  ) => {
    if (readOnly || !currentOrg || !projectId || !storyId) return
    setSavingMetaField(field)
    try {
      await updateStory(currentOrg.id, projectId, storyId, { [field]: value } as Partial<Story>)
    } finally {
      setSavingMetaField(null)
    }
  }

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    await uploadFiles(files)
    event.target.value = ''
  }

  const uploadFiles = async (files: File[]) => {
    if (readOnly || !currentOrg || !projectId || !storyId || files.length === 0) return

    setUploadingAttachment(true)
    try {
      await Promise.all(files.map((file) => uploadStoryAttachment(currentOrg.id, projectId, storyId, file)))
      toast.success(`${files.length} csatolmány feltöltve.`)
    } finally {
      setUploadingAttachment(false)
      setAttachmentDropActive(false)
    }
  }

  const handleAttachmentDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files ?? [])
    if (files.length === 0) return
    await uploadFiles(files)
  }

  const handleSaveStoryDescription = useCallback(async () => {
    if (readOnly || !currentOrg || !projectId || !storyId || !story) return
    const nextDescription = storyDescriptionDraft.trim()
    if ((story.description ?? '') === nextDescription) return

    setSavingStoryDescription(true)
    try {
      await updateStory(currentOrg.id, projectId, storyId, { description: nextDescription })
      if (userProfile && nextDescription.length > 0) {
        await notifyMentionedUsers({
          orgId: currentOrg.id,
          projectId,
          storyId,
          actorId: userProfile.id,
          actorName: userProfile.displayName,
          body: nextDescription,
          members: projectMembers,
        })
      }
      toast.success('Leírás frissítve.')
    } finally {
      setSavingStoryDescription(false)
    }
  }, [readOnly, currentOrg, projectId, storyId, story, storyDescriptionDraft, userProfile, projectMembers])

  useEffect(() => {
    if (readOnly || !story) return
    if (storyDescriptionDraft === (story.description ?? '')) return

    if (descriptionSaveTimeoutRef.current) {
      window.clearTimeout(descriptionSaveTimeoutRef.current)
    }

    descriptionSaveTimeoutRef.current = window.setTimeout(() => {
      void handleSaveStoryDescription()
    }, 700)

    return () => {
      if (descriptionSaveTimeoutRef.current) {
        window.clearTimeout(descriptionSaveTimeoutRef.current)
      }
    }
  }, [storyDescriptionDraft, story, readOnly, handleSaveStoryDescription])

  const mentionSuggestions = projectMembers.filter((member) => {
    const normalizedDisplay = member.displayName.toLowerCase().replace(/\s+/g, '')
    const normalizedEmail = member.email.toLowerCase()
    return { normalizedDisplay, normalizedEmail }
  })

  const visibleDescriptionMentions = mentionSuggestions.filter((member) => {
    if (descriptionMentionQuery === null) return false
    const query = descriptionMentionQuery.toLowerCase()
    const display = member.displayName.toLowerCase().replace(/\s+/g, '')
    const email = member.email.toLowerCase()
    return display.includes(query) || email.includes(query)
  }).slice(0, 6)

  const visibleCommentMentions = mentionSuggestions.filter((member) => {
    if (commentMentionQuery === null) return false
    const query = commentMentionQuery.toLowerCase()
    const display = member.displayName.toLowerCase().replace(/\s+/g, '')
    const email = member.email.toLowerCase()
    return display.includes(query) || email.includes(query)
  }).slice(0, 6)

  const applyMentionToDescription = (member: ProjectMembership) => {
    const textarea = storyDescriptionRef.current
    if (!textarea) return
    const result = insertMentionAtCaret(storyDescriptionDraft, textarea.selectionStart, member.displayName.replace(/\s+/g, ''))
    setStoryDescriptionDraft(result.value)
    setDescriptionMentionQuery(null)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.caret, result.caret)
    })
  }

  const applyMentionToComment = (member: ProjectMembership) => {
    const textarea = commentRef.current
    if (!textarea) return
    const result = insertMentionAtCaret(commentBody, textarea.selectionStart, member.displayName.replace(/\s+/g, ''))
    setCommentBody(result.value)
    setCommentMentionQuery(null)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.caret, result.caret)
    })
  }

  if (accessLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-gray-100" />
        <div className="h-8 w-2/3 rounded bg-gray-100" />
        <div className="h-4 w-1/3 rounded bg-gray-100" />
      </div>
    )
  }

  if (!canAccessProject) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Ehhez a storyhoz jelenleg nincs hozzáférésed.</p>
      </div>
    )
  }

  const handleSaveTaskDescription = async (task: Task) => {
    if (readOnly || !currentOrg || !projectId || !storyId) return
    const draft = (taskDescriptionDraftById[task.id] ?? '').trim()
    if ((task.description ?? '') === draft) {
      setEditingTaskDescriptionId(null)
      return
    }

    await updateTaskDescription(currentOrg.id, projectId, storyId, task.id, draft)
    setEditingTaskDescriptionId(null)
  }

  const submitStoryWorklog = async () => {
    if (readOnly || !currentOrg || !projectId || !storyId) return

    const minutes = parseWorklogInput(storyWorklogInput, currentOrg.settings.hoursPerDay)
    if (minutes <= 0) return

    setSubmittingStoryWorklog(true)
    try {
      await createWorklog(currentOrg.id, projectId, storyId, {
        minutes,
        description: storyWorklogDescription,
      })
      setStoryWorklogInput('')
      setStoryWorklogDescription('')
    } finally {
      setSubmittingStoryWorklog(false)
    }
  }

  const submitTaskWorklog = async (taskId: string) => {
    if (readOnly || !currentOrg || !projectId || !storyId) return

    const minutes = parseWorklogInput(taskWorklogInputById[taskId] ?? '', currentOrg.settings.hoursPerDay)
    if (minutes <= 0) return

    setSubmittingTaskWorklogId(taskId)
    try {
      await createWorklog(currentOrg.id, projectId, storyId, {
        taskId,
        minutes,
        description: taskWorklogDescriptionById[taskId] ?? '',
      })
      setTaskWorklogInputById((prev) => ({ ...prev, [taskId]: '' }))
      setTaskWorklogDescriptionById((prev) => ({ ...prev, [taskId]: '' }))
    } finally {
      setSubmittingTaskWorklogId(null)
    }
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
  const directStoryWorklogMinutes = worklogs
    .filter((worklog) => !worklog.taskId)
    .reduce((sum, worklog) => sum + worklog.minutes, 0)
  const recentWorklogs = worklogs.slice(0, 8)

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
            <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Leírás</p>
                {!readOnly && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <PencilLine className="h-3.5 w-3.5" />
                    @mention támogatott
                  </span>
                )}
              </div>
              {readOnly ? (
                story.description ? (
                  <RichTextContent value={story.description} />
                ) : (
                  <p className="text-sm italic text-gray-400">Nincs leírás.</p>
                )
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-500">
                    <button
                      type="button"
                      onClick={() => applyMarkdownFormat(storyDescriptionRef.current, 'bold', setStoryDescriptionDraft)}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-2 hover:border-gray-300 hover:bg-white"
                      title="Félkövér"
                    >
                      <Bold className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMarkdownFormat(storyDescriptionRef.current, 'italic', setStoryDescriptionDraft)}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-2 hover:border-gray-300 hover:bg-white"
                      title="Dőlt"
                    >
                      <Italic className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMarkdownFormat(storyDescriptionRef.current, 'bullet', setStoryDescriptionDraft)}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-2 hover:border-gray-300 hover:bg-white"
                      title="Felsorolás"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative">
                  <textarea
                    ref={storyDescriptionRef}
                    value={storyDescriptionDraft}
                    onChange={(e) => {
                      setStoryDescriptionDraft(e.target.value)
                      setDescriptionMentionQuery(getMentionQuery(e.target.value, e.target.selectionStart))
                    }}
                    onClick={(e) => setDescriptionMentionQuery(getMentionQuery(storyDescriptionDraft, e.currentTarget.selectionStart))}
                    onKeyUp={(e) => setDescriptionMentionQuery(getMentionQuery(storyDescriptionDraft, e.currentTarget.selectionStart))}
                    rows={10}
                    placeholder="Írj részletes leírást, vagy említs meg valakit pl. @dev1"
                    className="max-h-[420px] min-h-[240px] w-full resize-y overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50/40 px-4 py-3 text-sm leading-6 text-gray-700 outline-none focus:border-primary-500 focus:bg-white"
                  />
                    {visibleDescriptionMentions.length > 0 && (
                      <div className="absolute left-3 right-3 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                        {visibleDescriptionMentions.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => applyMentionToDescription(member)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Avatar name={member.displayName} src={member.photoUrl} size="xs" />
                            <span className="flex-1 truncate">{member.displayName}</span>
                            <span className="text-xs text-gray-400">{member.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">Automatikus mentés, Enter új sort ad, a mentionök értesítést küldenek.</p>
                    {savingStoryDescription && <span className="text-xs text-primary-600">Mentés...</span>}
                  </div>
                </div>
              )}
            </div>
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
                  disabled={readOnly}
                  onClick={() => { setAddingTask(true); setTimeout(() => taskInputRef.current?.focus(), 50) }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="group relative rounded-lg border border-gray-100 bg-white px-3 py-2 hover:border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleTask(task)}
                      disabled={readOnly}
                      className={clsx(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        task.isDone
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 hover:border-primary-400',
                      )}
                    >
                      {task.isDone && <Check className="h-3 w-3" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'flex-1 text-sm',
                          task.isDone ? 'line-through text-gray-400' : 'text-gray-700',
                        )}>
                          {task.title}
                        </span>
                        {canViewWorklogs && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                            {minutesToDisplay(task.totalWorklogMinutes ?? 0)}
                          </span>
                        )}
                      </div>
                      {!readOnly && canViewWorklogs && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-[96px,1fr,auto]">
                          <input
                            type="text"
                            value={taskWorklogInputById[task.id] ?? ''}
                            onChange={(e) => setTaskWorklogInputById((prev) => ({ ...prev, [task.id]: e.target.value }))}
                            placeholder="pl. 1:30h"
                            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-primary-500"
                          />
                          <input
                            type="text"
                            value={taskWorklogDescriptionById[task.id] ?? ''}
                            onChange={(e) => setTaskWorklogDescriptionById((prev) => ({ ...prev, [task.id]: e.target.value }))}
                            placeholder="Mit csináltál?"
                            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-primary-500"
                          />
                          <button
                            type="button"
                            onClick={() => void submitTaskWorklog(task.id)}
                            disabled={submittingTaskWorklogId === task.id}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                          >
                            Log
                          </button>
                        </div>
                      )}
                      <div className="mt-2">
                        {readOnly && !(task.description ?? '').trim() ? null : (
                          <textarea
                            value={taskDescriptionDraftById[task.id] ?? ''}
                            onFocus={() => setEditingTaskDescriptionId(task.id)}
                            onChange={(e) => setTaskDescriptionDraftById((prev) => ({ ...prev, [task.id]: e.target.value }))}
                            onBlur={() => void handleSaveTaskDescription(task)}
                            readOnly={readOnly}
                            rows={editingTaskDescriptionId === task.id || (task.description ?? '').length > 0 ? 4 : 2}
                            placeholder="Task leírása..."
                            className={clsx(
                              'mt-0.5 min-h-[92px] w-full rounded-lg border px-3 py-2 text-sm outline-none',
                              readOnly
                                ? 'border-transparent bg-transparent text-gray-500'
                                : 'border-gray-200 bg-gray-50 text-gray-600 focus:border-primary-500 focus:bg-white',
                            )}
                          />
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => setAssignMenuTaskId((current) => current === task.id ? null : task.id)}
                        className="flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-200 bg-gray-50 px-2 text-xs text-gray-600 hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                        title={task.assigneeName ?? 'Felhasználó hozzárendelése'}
                      >
                        {task.assigneeName ? task.assigneeName.slice(0, 2).toUpperCase() : <UserCircle2 className="h-4 w-4" />}
                      </button>
                      {assignMenuTaskId === task.id && !readOnly && (
                        <div className="absolute right-10 top-10 z-20 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                          <button
                            type="button"
                            onClick={() => handleAssignTask(task.id, null)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
                          >
                            <UserCircle2 className="h-4 w-4" />
                            Nincs hozzárendelve
                          </button>
                          {projectMembers.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => handleAssignTask(task.id, member)}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Avatar name={member.displayName} src={member.photoUrl} size="xs" />
                              <span className="truncate">{member.displayName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      disabled={readOnly}
                      className="hidden group-hover:flex text-gray-300 hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Törlés"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                    disabled={readOnly}
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

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Paperclip className="h-4 w-4" />
                Csatolmányok
                {attachments.length > 0 && (
                  <span className="text-xs text-gray-400">{attachments.length}</span>
                )}
              </h2>
              {!readOnly && (
                <>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleAttachmentChange}
                  />
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => attachmentInputRef.current?.click()}
                    loading={uploadingAttachment}
                  >
                    Fájl feltöltése
                  </Button>
                </>
              )}
            </div>

            <div
              onDragOver={(event) => {
                if (readOnly) return
                event.preventDefault()
                setAttachmentDropActive(true)
              }}
              onDragLeave={() => setAttachmentDropActive(false)}
              onDrop={(event) => void handleAttachmentDrop(event)}
              className={clsx(
                'rounded-2xl border border-dashed p-4 transition-colors',
                attachmentDropActive ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-gray-50/60',
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Húzz ide fájlt vagy használd a feltöltést</p>
                  <p className="mt-1 text-xs text-gray-400">Több fájl is behúzható egyszerre.</p>
                </div>
                {!readOnly && (
                  <Button variant="outline" size="xs" onClick={() => attachmentInputRef.current?.click()} loading={uploadingAttachment}>
                    Fájl kiválasztása
                  </Button>
                )}
              </div>

              {attachments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
                  Még nincsenek csatolmányok.
                </p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.storageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-primary-300"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{attachment.fileName}</p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {attachment.uploadedByName} · {Math.max(1, Math.round(attachment.fileSize / 1024))} KB
                        </p>
                      </div>
                      <span className="text-xs text-primary-600">Megnyitás</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>

          {canViewWorklogs && (
            <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Clock3 className="h-4 w-4" />
                Worklog
              </h2>
              <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                Összesen: {minutesToDisplay(story.totalWorklogMinutes ?? 0)}
              </span>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-[120px,1fr,auto]">
                <input
                  type="text"
                  value={storyWorklogInput}
                  onChange={(e) => setStoryWorklogInput(e.target.value)}
                  disabled={readOnly}
                  placeholder="pl. 1:30h"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary-500"
                />
                <input
                  type="text"
                  value={storyWorklogDescription}
                  onChange={(e) => setStoryWorklogDescription(e.target.value)}
                  disabled={readOnly}
                  placeholder="Mit logolsz közvetlenül a storyra?"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary-500"
                />
                {!readOnly && (
                  <Button onClick={() => void submitStoryWorklog()} loading={submittingStoryWorklog}>
                    Logolás
                  </Button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="rounded-full bg-gray-100 px-2.5 py-1">
                  Story log: {minutesToDisplay(directStoryWorklogMinutes)}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1">
                  Taskokból: {minutesToDisplay(Math.max(0, (story.totalWorklogMinutes ?? 0) - directStoryWorklogMinutes))}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {recentWorklogs.length === 0 ? (
                  <p className="text-sm text-gray-400">Még nincs worklog a storyn.</p>
                ) : (
                  recentWorklogs.map((worklog) => (
                    <div key={worklog.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {worklog.userName}
                          {worklog.taskId && (
                            <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">
                              Task
                            </span>
                          )}
                        </p>
                        {worklog.description && (
                          <p className="mt-0.5 text-sm text-gray-600">{worklog.description}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">{worklog.date}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-gray-600">
                        {minutesToDisplay(worklog.minutes)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            </section>
          )}

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
                    <RichTextContent value={comment.body} />
                  </div>
                </div>
              ))}

              {/* Add comment */}
              <form onSubmit={handleAddComment} className="flex gap-3">
                <Avatar name={userProfile?.displayName} src={userProfile?.photoUrl} size="sm" className="shrink-0 mt-0.5" />
                <div className="flex-1 rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-400 transition">
                  {!readOnly && (
                    <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-gray-500">
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat(commentRef.current, 'bold', setCommentBody)}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-1.5 hover:border-gray-300 hover:bg-white"
                        title="Félkövér"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat(commentRef.current, 'italic', setCommentBody)}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-1.5 hover:border-gray-300 hover:bg-white"
                        title="Dőlt"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdownFormat(commentRef.current, 'bullet', setCommentBody)}
                        className="rounded-lg border border-gray-200 bg-gray-50 p-1.5 hover:border-gray-300 hover:bg-white"
                        title="Felsorolás"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="relative">
                  <textarea
                    ref={commentRef}
                    value={commentBody}
                    onChange={(e) => {
                      setCommentBody(e.target.value)
                      setCommentMentionQuery(getMentionQuery(e.target.value, e.target.selectionStart))
                    }}
                    onClick={(e) => setCommentMentionQuery(getMentionQuery(commentBody, e.currentTarget.selectionStart))}
                    onKeyUp={(e) => setCommentMentionQuery(getMentionQuery(commentBody, e.currentTarget.selectionStart))}
                    disabled={readOnly}
                    placeholder="Írj hozzászólást…"
                    rows={2}
                    className="block w-full resize-none px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none"
                  />
                    {visibleCommentMentions.length > 0 && (
                      <div className="absolute left-3 right-3 top-full z-20 mt-2 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                        {visibleCommentMentions.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => applyMentionToComment(member)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Avatar name={member.displayName} src={member.photoUrl} size="xs" />
                            <span className="flex-1 truncate">{member.displayName}</span>
                            <span className="text-xs text-gray-400">{member.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {commentBody.trim() && !readOnly && (
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
                disabled={readOnly}
                onClick={() => setStatusOpen((o) => !o)}
                className={clsx(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  STATUS_COLORS[story.status],
                  'hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-70',
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
              {readOnly ? (
                <span className={clsx('rounded px-2 py-0.5 text-xs font-medium', TYPE_COLORS[story.type])}>
                  {TYPE_LABELS[story.type]}
                </span>
              ) : (
                <select
                  value={story.type}
                  onChange={(e) => void handleMetaUpdate('type', e.target.value as StoryType)}
                  disabled={savingMetaField === 'type'}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:border-primary-500"
                >
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
            </MetaRow>
            <MetaRow label="Prioritás">
              {readOnly ? (
                <span className={clsx('rounded px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[story.priority])}>
                  {PRIORITY_LABELS[story.priority]}
                </span>
              ) : (
                <select
                  value={story.priority}
                  onChange={(e) => void handleMetaUpdate('priority', e.target.value as StoryPriority)}
                  disabled={savingMetaField === 'priority'}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:border-primary-500"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
            </MetaRow>
            <MetaRow label="Méret">
              {readOnly ? (
                <span className="text-sm font-semibold text-gray-700">
                  {story.estimate != null ? `${story.estimate} SP` : 'Nincs megadva'}
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={estimateInput}
                    onChange={(e) => setEstimateInput(e.target.value)}
                    onBlur={() => void handleEstimateSave()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleEstimateSave()
                      }
                    }}
                    className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm text-gray-700 outline-none focus:border-primary-500"
                    placeholder="0"
                  />
                  {savingEstimate && <span className="text-xs text-primary-600">Mentés...</span>}
                </div>
              )}
            </MetaRow>
            <MetaRow label="Helyszín">
              {readOnly ? (
                <span className="text-sm text-gray-600">{LOCATION_LABELS[story.location]}</span>
              ) : (
                <select
                  value={story.location}
                  onChange={(e) => void handleMetaUpdate('location', e.target.value as StoryLocation)}
                  disabled={savingMetaField === 'location'}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:border-primary-500"
                >
                  <option value="backlog">Backlog</option>
                  <option value="planbox">Planbox</option>
                  {story.location === 'board' && <option value="board">Board</option>}
                </select>
              )}
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
