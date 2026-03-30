import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, UserCircle2, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Avatar } from '@/components/ui/Avatar'
import type { ProjectMembership } from '@/types/models'

interface ProjectOption {
  id: string
  name: string
  prefix: string
}

interface InlineStoryComposerProps {
  projects: ProjectOption[]
  membersByProjectId: Record<string, ProjectMembership[]>
  onSubmit: (input: { title: string; estimate?: number; projectId: string; assigneeId?: string; assigneeName?: string }) => Promise<void>
  onCancel: () => void
  submitLabel?: string
  className?: string
}

export function InlineStoryComposer({
  projects,
  membersByProjectId,
  onSubmit,
  onCancel,
  submitLabel = 'Létrehozás',
  className,
}: InlineStoryComposerProps) {
  const [title, setTitle] = useState('')
  const [estimate, setEstimate] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (projects.length === 1) {
      setProjectId(projects[0].id)
    } else if (!projects.some((project) => project.id === projectId)) {
      setProjectId(projects[0]?.id ?? '')
    }
  }, [projects, projectId])

  const members = useMemo(
    () => membersByProjectId[projectId] ?? [],
    [membersByProjectId, projectId],
  )

  const selectedAssignee = members.find((member) => member.id === assigneeId) ?? null

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!title.trim() || !projectId) return
    setLoading(true)
    try {
      await onSubmit({
        title: title.trim(),
        estimate: estimate.trim() ? Number(estimate) : undefined,
        projectId,
        assigneeId: selectedAssignee?.id,
        assigneeName: selectedAssignee?.displayName,
      })
      setTitle('')
      setEstimate('')
      setAssigneeId(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className={clsx('rounded-xl border border-primary-200 bg-primary-50/70 p-3', className)}
    >
      <div className="space-y-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Story neve..."
          className="w-full rounded-lg border border-white bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary-400"
          autoFocus
        />

        <div className="grid gap-3 sm:grid-cols-[96px,1fr]">
          <input
            type="number"
            min={0}
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
            placeholder="SP"
            className="w-full rounded-lg border border-white bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary-400"
          />
          {projects.length > 1 ? (
            <select
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value)
                setAssigneeId(null)
              }}
              className="w-full rounded-lg border border-white bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary-400"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.prefix} - {project.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center rounded-lg border border-white bg-white px-3 py-2 text-sm font-medium text-gray-700">
              {projects[0]?.prefix ?? 'Projekt'}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAssigneeId(null)}
            className={clsx(
              'flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs transition-colors',
              assigneeId === null ? 'border-primary-400 bg-white text-primary-700' : 'border-white bg-white text-gray-500 hover:border-gray-200',
            )}
            title="Nincs hozzárendelve"
          >
            <UserCircle2 className="h-4 w-4" />
          </button>
          {members.map((member) => {
            const selected = assigneeId === member.id
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setAssigneeId(selected ? null : member.id)}
                className={clsx('rounded-full ring-2 transition-all', selected ? 'ring-primary-500' : 'ring-transparent hover:ring-gray-300')}
                title={member.displayName}
              >
                <Avatar src={member.photoUrl} name={member.displayName} size="sm" />
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {selectedAssignee ? `Hozzárendelve: ${selectedAssignee.displayName}` : 'Még nincs hozzárendelve'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
              Mégse
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !projectId}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
