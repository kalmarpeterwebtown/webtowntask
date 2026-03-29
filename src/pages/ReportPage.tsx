import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { collectionGroup, onSnapshot, query, orderBy, where } from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Layers3,
  Rocket,
  ArrowRight,
} from 'lucide-react'
import { useOrgStore } from '@/stores/orgStore'
import { projectRef, storiesRef, sprintsRef } from '@/utils/firestore'
import { subscribeToTeams } from '@/services/team.service'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { ROUTES, PRIORITY_COLORS, STATUS_COLORS, TYPE_COLORS } from '@/config/constants'
import { formatDate, minutesToDisplay } from '@/utils/formatters'
import type { Project, Sprint, Story, Team, Worklog } from '@/types/models'

const STATUS_LABELS: Record<Story['status'], string> = {
  draft: 'Tervezet',
  ready: 'Ready',
  in_progress: 'Folyamatban',
  review: 'Review',
  done: 'Kész',
  delivered: 'Átadva',
}

const TYPE_LABELS: Record<Story['type'], string> = {
  feature: 'Feature',
  bug: 'Bug',
  tech_debt: 'Tech debt',
  chore: 'Chore',
}

const PRIORITY_LABELS: Record<Story['priority'], string> = {
  critical: 'Kritikus',
  high: 'Magas',
  medium: 'Közepes',
  low: 'Alacsony',
}

const LOCATION_LABELS: Record<Story['location'], string> = {
  backlog: 'Backlog',
  planbox: 'Planbox',
  board: 'Board',
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </div>
        <div className="rounded-xl bg-primary-50 p-2 text-primary-600">
          {icon}
        </div>
      </div>
    </div>
  )
}

function BreakdownCard({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: Array<{ key: string; label: string; value: number; valueLabel?: string; tone?: string }>
}) {
  const max = Math.max(...items.map((item) => item.value), 0)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">{item.label}</span>
              <span className="text-sm font-medium text-gray-500">{item.valueLabel ?? item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div
                className={`h-2 rounded-full ${item.tone ?? 'bg-primary-500'}`}
                style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightCard({
  title,
  items,
  emptyText,
}: {
  title: string
  items: string[]
  emptyText: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{emptyText}</p>
        ) : (
          items.map((item) => (
            <div key={item} className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SprintSummaryCard({ sprints }: { sprints: Sprint[] }) {
  const activeSprint = sprints.find((sprint) => sprint.status === 'active') ?? null
  const completedSprints = sprints.filter((sprint) => sprint.status === 'completed')
  const avgVelocity = completedSprints.length > 0
    ? Math.round(completedSprints.reduce((sum, sprint) => sum + (sprint.stats.completedPoints ?? 0), 0) / completedSprints.length)
    : 0

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Sprint összefoglaló</h2>
        <p className="mt-1 text-sm text-gray-500">Az ehhez a projekthez kapcsolt csapatok sprintjei.</p>
      </div>

      {sprints.length === 0 ? (
        <p className="text-sm text-gray-500">Még nincs sprint adat a projekthez kapcsolt csapatok alatt.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Aktív sprint"
              value={activeSprint?.name ?? 'Nincs'}
              hint={activeSprint ? `Vége: ${formatDate(activeSprint.endDate)}` : 'Jelenleg nincs futó sprint'}
              icon={<Rocket className="h-5 w-5" />}
            />
            <MetricCard
              label="Lezárt sprintek"
              value={String(completedSprints.length)}
              hint="A riport alapjául szolgáló sprintek"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <MetricCard
              label="Átlagos velocity"
              value={`${avgVelocity} SP`}
              hint="Lezárt sprintek completedPoints átlaga"
              icon={<BarChart3 className="h-5 w-5" />}
            />
          </div>

          <div className="space-y-2">
            {sprints.slice(0, 5).map((sprint) => (
              <div key={sprint.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{sprint.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">
                    {sprint.stats.completedPoints}/{sprint.stats.totalPoints} SP
                  </p>
                  <p className="text-xs text-gray-500">{sprint.status === 'active' ? 'Aktív' : sprint.status === 'completed' ? 'Lezárt' : 'Tervezés'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ReportPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { currentOrg } = useOrgStore()
  const orgId = currentOrg?.id ?? null

  const [project, setProject] = useState<Project | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [worklogs, setWorklogs] = useState<Worklog[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loadingProject, setLoadingProject] = useState(true)
  const [loadingStories, setLoadingStories] = useState(true)

  useEffect(() => {
    if (!orgId || !projectId) return

    const unsub = onSnapshot(projectRef(orgId, projectId), (snap) => {
      setProject(snap.exists() ? ({ id: snap.id, ...snap.data() } as Project) : null)
      setLoadingProject(false)
    })

    return unsub
  }, [orgId, projectId])

  useEffect(() => {
    if (!orgId || !projectId) return

    const q = query(storiesRef(orgId, projectId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setStories(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Story)))
      setLoadingStories(false)
    })

    return unsub
  }, [orgId, projectId])

  useEffect(() => {
    if (!orgId || !projectId) return

    const q = query(
      collectionGroup(db, 'worklogs'),
      where('projectId', '==', projectId),
    )
    const unsub = onSnapshot(q, (snap) => {
      setWorklogs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Worklog)))
    }, () => {
      setWorklogs([])
    })

    return unsub
  }, [orgId, projectId])

  useEffect(() => {
    if (!orgId) return
    return subscribeToTeams(orgId, setTeams)
  }, [orgId])

  const connectedTeams = useMemo(
    () => teams.filter((team) => projectId ? team.connectedProjectIds.includes(projectId) : false),
    [teams, projectId],
  )

  useEffect(() => {
    if (!orgId || connectedTeams.length === 0) {
      setSprints([])
      return
    }

    const sprintMap = new Map<string, Sprint>()
    const unsubs = connectedTeams.map((team) => {
      const q = query(sprintsRef(orgId, team.id), orderBy('createdAt', 'desc'))
      return onSnapshot(q, (snap) => {
        for (const [id, sprint] of sprintMap) {
          if (sprint.teamId === team.id) sprintMap.delete(id)
        }
        snap.docs.forEach((doc) => {
          sprintMap.set(doc.id, { id: doc.id, ...doc.data() } as Sprint)
        })
        setSprints(
          Array.from(sprintMap.values()).sort((a, b) =>
            b.startDate.toMillis() - a.startDate.toMillis(),
          ),
        )
      })
    })

    return () => unsubs.forEach((unsub) => unsub())
  }, [orgId, connectedTeams])

  const deliveredCount = stories.filter((story) => story.status === 'delivered').length
  const doneCount = stories.filter((story) => story.status === 'done').length
  const boardCount = stories.filter((story) => story.location === 'board').length
  const blockedCount = stories.filter((story) => story.isBlocked).length
  const estimatedPoints = stories.reduce((sum, story) => sum + (story.estimate ?? 0), 0)
  const completedPoints = stories
    .filter((story) => story.status === 'done' || story.status === 'delivered')
    .reduce((sum, story) => sum + (story.estimate ?? 0), 0)
  const progressPercent = estimatedPoints > 0 ? Math.round((completedPoints / estimatedPoints) * 100) : 0

  const overdueStories = stories.filter((story) => {
    const dueDate = story.dueDate?.toDate?.()
    return !!dueDate && dueDate < new Date() && story.status !== 'done' && story.status !== 'delivered'
  })
  const missingEstimateStories = stories.filter((story) => story.estimate == null)
  const unassignedStories = stories.filter((story) => story.assigneeIds.length === 0)

  const statusItems = (Object.keys(STATUS_LABELS) as Array<Story['status']>).map((status) => ({
    key: status,
    label: STATUS_LABELS[status],
    value: stories.filter((story) => story.status === status).length,
    tone: STATUS_COLORS[status].split(' ').find((cls) => cls.startsWith('bg-')) ?? 'bg-primary-500',
  }))

  const typeItems = (Object.keys(TYPE_LABELS) as Array<Story['type']>).map((type) => ({
    key: type,
    label: TYPE_LABELS[type],
    value: stories.filter((story) => story.type === type).length,
    tone: TYPE_COLORS[type].split(' ').find((cls) => cls.startsWith('bg-')) ?? 'bg-primary-500',
  }))

  const priorityItems = (Object.keys(PRIORITY_LABELS) as Array<Story['priority']>).map((priority) => ({
    key: priority,
    label: PRIORITY_LABELS[priority],
    value: stories.filter((story) => story.priority === priority).length,
    tone: PRIORITY_COLORS[priority].split(' ').find((cls) => cls.startsWith('bg-')) ?? 'bg-primary-500',
  }))

  const locationItems = (Object.keys(LOCATION_LABELS) as Array<Story['location']>).map((location) => ({
    key: location,
    label: LOCATION_LABELS[location],
    value: stories.filter((story) => story.location === location).length,
  }))

  const assigneeLoadItems = useMemo(() => {
    const loadMap = new Map<string, { name: string; count: number; points: number }>()

    stories.forEach((story) => {
      if (story.assigneeIds.length === 0) return
      story.assigneeIds.forEach((assigneeId, index) => {
        const key = assigneeId || story.assigneeNames[index] || `assignee-${index}`
        const current = loadMap.get(key) ?? {
          name: story.assigneeNames[index] ?? 'Ismeretlen',
          count: 0,
          points: 0,
        }
        current.count += 1
        current.points += story.estimate ?? 0
        loadMap.set(key, current)
      })
    })

    return Array.from(loadMap.entries())
      .map(([key, value]) => ({
        key,
        label: value.name,
        value: value.count,
        tone: 'bg-slate-500',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [stories])

  const worklogByUserItems = useMemo(() => {
    const totals = new Map<string, { label: string; value: number }>()

    worklogs.forEach((worklog) => {
      const current = totals.get(worklog.userId) ?? {
        label: worklog.userName,
        value: 0,
      }
      current.value += worklog.minutes
      totals.set(worklog.userId, current)
    })

    return Array.from(totals.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        value: value.value,
        tone: 'bg-sky-500',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [worklogs])

  const totalWorklogMinutes = worklogs.reduce((sum, worklog) => sum + worklog.minutes, 0)

  if (loadingProject || loadingStories) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="A projekt nem található"
          description="Lehet, hogy törölve lett, vagy már nincs hozzáférésed."
          action={
            <Link to={ROUTES.PROJECTS}>
              <Button variant="outline">Vissza a projektekhez</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
              {project.prefix}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Projekt riportok</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {project.name} allapota, terheltsége és delivery képe egy helyen.
          </p>
        </div>
        <Link to={ROUTES.PROJECT(project.id)} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
          Projekt megnyitása <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Összes story"
          value={String(stories.length)}
          hint={`${deliveredCount} átadva, ${doneCount} kész`}
          icon={<Layers3 className="h-5 w-5" />}
        />
        <MetricCard
          label="Boardon"
          value={String(boardCount)}
          hint={`${connectedTeams.length} kapcsolt csapat`}
          icon={<Rocket className="h-5 w-5" />}
        />
        <MetricCard
          label="Becsült SP"
          value={`${estimatedPoints} SP`}
          hint={`${completedPoints} SP teljesítve`}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <MetricCard
          label="Worklog"
          value={minutesToDisplay(totalWorklogMinutes)}
          hint={`${worklogs.length} bejegyzés`}
          icon={<Clock3 className="h-5 w-5" />}
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Delivery előrehaladás</h2>
            <p className="mt-1 text-sm text-gray-500">A becsült pontok alapján számolt teljesítési arány.</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{progressPercent}%</p>
            <p className="text-xs text-gray-500">{completedPoints}/{estimatedPoints} SP</p>
          </div>
        </div>
        <div className="mt-4 h-3 rounded-full bg-gray-100">
          <div className="h-3 rounded-full bg-primary-500" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Státusz bontás"
          description="Hol tartanak most a story-k a delivery folyamatban."
          items={statusItems}
        />
        <BreakdownCard
          title="Típus bontás"
          description="Milyen jellegű munka tölti ki a projektet."
          items={typeItems}
        />
        <BreakdownCard
          title="Prioritás bontás"
          description="A backlog és a folyamatban lévő munka sürgősségi képe."
          items={priorityItems}
        />
        <BreakdownCard
          title="Elhelyezkedés"
          description="Hány story van backlogban, planboxban vagy boardon."
          items={locationItems}
        />
        <BreakdownCard
          title="Worklog személyenként"
          description="Ki mennyi időt logolt a projektben."
          items={worklogByUserItems.map((item) => ({
            ...item,
            valueLabel: minutesToDisplay(item.value),
          }))}
        />
        <BreakdownCard
          title="Kockázati bontás"
          description="A projekt legfontosabb figyelmeztető jelei."
          items={[
            { key: 'blocked', label: 'Blokkolt', value: blockedCount, tone: 'bg-amber-500' },
            { key: 'overdue', label: 'Lejárt', value: overdueStories.length, tone: 'bg-rose-500' },
            { key: 'missing-estimate', label: 'Becslés nélkül', value: missingEstimateStories.length, tone: 'bg-slate-500' },
          ]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <InsightCard
          title="Figyelmet igényel"
          items={[
            ...overdueStories.slice(0, 4).map((story) => `${story.title}: lejárt határidő (${formatDate(story.dueDate)})`),
            ...missingEstimateStories.slice(0, 3).map((story) => `${story.title}: nincs becslés`),
          ]}
          emptyText="Jelenleg nincs kiemelt kockázat a projektben."
        />
        <InsightCard
          title="Csapat terheltség"
          items={assigneeLoadItems.map((item) => `${item.label}: ${item.value} story`)}
          emptyText="Még nincsenek hozzárendelések a story-kon."
        />
        <InsightCard
          title="Gyors jelzések"
          items={[
            `${unassignedStories.length} story nincs kiosztva`,
            `${stories.filter((story) => story.location === 'planbox').length} story vár a planboxban`,
            `${stories.filter((story) => story.status === 'review').length} story van review-ban`,
            `${minutesToDisplay(totalWorklogMinutes)} összes log a projekten`,
          ]}
          emptyText="Nincs megjeleníthető jelzés."
        />
      </div>

      <SprintSummaryCard sprints={sprints} />
    </div>
  )
}
