import { useEffect, useMemo, useState } from 'react'
import { LayoutDashboard, Clock, CheckSquare, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { collectionGroup, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { useProjects } from '@/hooks/useProjects'
import { useProjectAccessMap } from '@/hooks/useAccess'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROUTES, STATUS_COLORS, TYPE_COLORS } from '@/config/constants'
import { minutesToDisplay } from '@/utils/formatters'
import { storiesRef, tasksRef, worklogsRef } from '@/utils/firestore'
import type { Story, Task, Worklog } from '@/types/models'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Tervezet', ready: 'Kész', in_progress: 'Folyamatban',
  review: 'Review', done: 'Kész', delivered: 'Átadva',
}

const TYPE_LABELS: Record<string, string> = {
  feature: 'Feature', bug: 'Bug', tech_debt: 'Tech Debt', chore: 'Chore',
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resolveWorklogDate(worklog: Worklog): Date | null {
  if (typeof worklog.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(worklog.date)) {
    const [year, month, day] = worklog.date.split('-').map(Number)
    return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0)
  }

  if (typeof worklog.date === 'string') {
    const parsed = new Date(worklog.date)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return worklog.createdAt?.toDate?.() ?? null
}

function MiniBarChart({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>
}) {
  const max = Math.max(...items.map((item) => item.value), 0)

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-gray-500">{item.label}</span>
            <span className="text-xs font-semibold text-gray-700">{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${max > 0 ? (item.value / max) * 100 : 0}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function WorklogTrend({
  items,
}: {
  items: Array<{ label: string; minutes: number }>
}) {
  const max = Math.max(...items.map((item) => item.minutes), 0)

  return (
    <div className="flex h-40 items-end gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-28 w-full items-end">
            <div
              className="w-full rounded-t-xl bg-gradient-to-t from-sky-500 to-cyan-300"
              style={{
                height: `${max > 0 ? Math.max((item.minutes / max) * 100, item.minutes > 0 ? 12 : 0) : 0}%`,
                minHeight: item.minutes > 0 ? '12px' : '0px',
              }}
              title={`${item.label}: ${minutesToDisplay(item.minutes)}`}
            />
          </div>
          <div className="text-center">
            <p className="text-[11px] font-semibold text-gray-700">{item.minutes > 0 ? minutesToDisplay(item.minutes) : '0m'}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const { userProfile, firebaseUser } = useAuthStore()
  const { currentOrg } = useOrgStore()
  const { projects: allProjects } = useProjects()
  const { projects } = useProjectAccessMap(allProjects)
  const orgId = currentOrg?.id ?? null
  const userId = firebaseUser?.uid ?? null
  const visibleProjectIds = useMemo(() => projects.map((project) => project.id), [projects])
  const visibleProjectIdSet = useMemo(() => new Set(visibleProjectIds), [visibleProjectIds])
  const [storySnapshot, setStorySnapshot] = useState<{
    key: string
    stories: Story[]
    ready: boolean
  }>({
    key: '',
    stories: [],
    ready: false,
  })
  const [taskSnapshot, setTaskSnapshot] = useState<{
    key: string
    tasks: Task[]
    ready: boolean
  }>({
    key: '',
    tasks: [],
    ready: false,
  })
  const [worklogSnapshot, setWorklogSnapshot] = useState<{
    key: string
    worklogs: Worklog[]
    ready: boolean
  }>({
    key: '',
    worklogs: [],
    ready: false,
  })
  const [fallbackWorklogs, setFallbackWorklogs] = useState<Worklog[]>([])
  const [selectedPeriodDays, setSelectedPeriodDays] = useState<7 | 30 | 90>(30)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Jó reggelt'
    if (h < 18) return 'Jó napot'
    return 'Jó estét'
  }

  useEffect(() => {
    if (!orgId || !userId) return

    const projectKey = visibleProjectIds.join(',')
    if (visibleProjectIds.length === 0) return

    const storyMap = new Map<string, Story>()
    const taskMap = new Map<string, Task>()
    const worklogMap = new Map<string, Worklog>()
    const taskUnsubs = new Map<string, () => void>()
    const worklogUnsubs = new Map<string, () => void>()

    const emitStories = () => {
      setStorySnapshot({
        key: projectKey,
        stories: Array.from(storyMap.values())
          .filter((story) =>
            story.assigneeIds.includes(userId) &&
            ['ready', 'in_progress', 'review'].includes(story.status),
          )
          .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()),
        ready: true,
      })
    }

    const emitTasks = () => {
      setTaskSnapshot({
        key: projectKey,
        tasks: Array.from(taskMap.values())
          .filter((task) => task.assigneeId === userId && !task.isDone)
          .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()),
        ready: true,
      })
    }

    const emitWorklogs = () => {
      setWorklogSnapshot({
        key: projectKey,
        worklogs: Array.from(worklogMap.values())
          .filter((worklog) => worklog.userId === userId)
          .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()),
        ready: true,
      })
    }

    const syncStoryChildren = (story: Story) => {
      const storyKey = `${story.projectId}:${story.id}`

      if (!taskUnsubs.has(storyKey)) {
        const taskQuery = query(tasksRef(orgId, story.projectId, story.id), orderBy('createdAt', 'desc'))
        taskUnsubs.set(storyKey, onSnapshot(taskQuery, (snap) => {
          for (const [key, task] of taskMap.entries()) {
            if (task.storyId === story.id && task.projectId === story.projectId) taskMap.delete(key)
          }
          snap.docs.forEach((doc) => {
            const task = { id: doc.id, projectId: story.projectId, ...doc.data() } as Task
            taskMap.set(`${story.projectId}:${story.id}:${task.id}`, task)
          })
          emitTasks()
        }, () => {
          emitTasks()
        }))
      }

      if (!worklogUnsubs.has(storyKey)) {
        const worklogQuery = query(worklogsRef(orgId, story.projectId, story.id), orderBy('createdAt', 'desc'))
        worklogUnsubs.set(storyKey, onSnapshot(worklogQuery, (snap) => {
          for (const [key, worklog] of worklogMap.entries()) {
            if (worklog.storyId === story.id && worklog.projectId === story.projectId) worklogMap.delete(key)
          }
          snap.docs.forEach((doc) => {
            const worklog = { id: doc.id, projectId: story.projectId, ...doc.data() } as Worklog
            worklogMap.set(`${story.projectId}:${story.id}:${worklog.id}`, worklog)
          })
          emitWorklogs()
        }, () => {
          emitWorklogs()
        }))
      }
    }

    const storyUnsubs = visibleProjectIds.map((projectId) => {
      const storyQuery = query(storiesRef(orgId, projectId), orderBy('createdAt', 'desc'))
      return onSnapshot(storyQuery, (snap) => {
        const currentStoryIds = new Set<string>()

        for (const [key, story] of storyMap.entries()) {
          if (story.projectId === projectId) storyMap.delete(key)
        }

        snap.docs.forEach((doc) => {
          const story = { id: doc.id, ...doc.data() } as Story
          storyMap.set(`${projectId}:${story.id}`, story)
          currentStoryIds.add(`${projectId}:${story.id}`)
          syncStoryChildren(story)
        })

        for (const [storyKey, unsub] of taskUnsubs.entries()) {
          if (storyKey.startsWith(`${projectId}:`) && !currentStoryIds.has(storyKey)) {
            unsub()
            taskUnsubs.delete(storyKey)
            worklogUnsubs.get(storyKey)?.()
            worklogUnsubs.delete(storyKey)
            for (const [key, task] of taskMap.entries()) {
              if (`${task.projectId}:${task.storyId}` === storyKey) taskMap.delete(key)
            }
            for (const [key, worklog] of worklogMap.entries()) {
              if (`${worklog.projectId}:${worklog.storyId}` === storyKey) worklogMap.delete(key)
            }
          }
        }

        emitStories()
        emitTasks()
        emitWorklogs()
      }, () => {
        emitStories()
        emitTasks()
        emitWorklogs()
      })
    })

    return () => {
      storyUnsubs.forEach((unsub) => unsub())
      taskUnsubs.forEach((unsub) => unsub())
      worklogUnsubs.forEach((unsub) => unsub())
    }
  }, [orgId, userId, visibleProjectIds])

  useEffect(() => {
    if (!userId) return

    const fallbackQuery = query(
      collectionGroup(db, 'worklogs'),
      where('userId', '==', userId),
    )

    return onSnapshot(fallbackQuery, (snap) => {
      setFallbackWorklogs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Worklog)))
    }, () => {
      setFallbackWorklogs([])
    })
  }, [userId])

  const projectKey = visibleProjectIds.join(',')
  const myStories = storySnapshot.key === projectKey ? storySnapshot.stories : []
  const myTasks = taskSnapshot.key === projectKey ? taskSnapshot.tasks : []
  const myWorklogs = ((worklogSnapshot.key === projectKey ? worklogSnapshot.worklogs : []).length > 0
    ? (worklogSnapshot.key === projectKey ? worklogSnapshot.worklogs : [])
    : fallbackWorklogs)
    .filter((worklog) => !worklog.projectId || visibleProjectIdSet.has(worklog.projectId))
  const loadingStories = userId !== null && visibleProjectIds.length > 0 && (storySnapshot.key !== projectKey || !storySnapshot.ready)
  const loadingTasks = userId !== null && visibleProjectIds.length > 0 && (taskSnapshot.key !== projectKey || !taskSnapshot.ready)
  const loadingWorklogs = userId !== null && visibleProjectIds.length > 0 && (worklogSnapshot.key !== projectKey || !worklogSnapshot.ready)
  const periodStart = new Date()
  periodStart.setHours(0, 0, 0, 0)
  periodStart.setDate(periodStart.getDate() - (selectedPeriodDays - 1))
  const periodWorklogs = myWorklogs.filter((worklog) => {
    const worklogDate = resolveWorklogDate(worklog)
    if (!worklogDate) return true
    return worklogDate >= periodStart
  })
  const visibleWorklogs = periodWorklogs.length > 0 ? periodWorklogs : myWorklogs
  const periodMinutes = visibleWorklogs.reduce((sum, worklog) => sum + worklog.minutes, 0)
  const taskStatusItems = [
    { label: 'Taskok', value: myTasks.length, color: '#f97316' },
    { label: 'Story-k', value: myStories.length, color: '#3b82f6' },
    { label: 'Worklogok', value: periodWorklogs.length, color: '#06b6d4' },
  ]
  const formatter = new Intl.DateTimeFormat('hu-HU', { weekday: 'short' })
  const worklogTrendItems = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    const key = toLocalDateKey(date)
    const minutes = visibleWorklogs
      .filter((worklog) => {
        const worklogDate = resolveWorklogDate(worklog)
        if (!worklogDate) return false
        return toLocalDateKey(worklogDate) === key
      })
      .reduce((sum, worklog) => sum + worklog.minutes, 0)

    return {
      label: formatter.format(date).replace('.', ''),
      minutes,
    }
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}, {userProfile?.displayName?.split(' ')[0] ?? 'Felhasználó'}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {currentOrg?.name ?? 'Szervezet'} · Áttekintő
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Hozzám rendelt munka"
          value={loadingStories || loadingTasks ? '–' : String(myTasks.length + myStories.length)}
          icon={<CheckSquare className="h-5 w-5 text-primary-600" />}
          color="bg-primary-50"
        />
        <StatCard
          label="Nyitott task"
          value={loadingTasks ? '–' : String(myTasks.length)}
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          color="bg-orange-50"
        />
        <StatCard
          label="Aktív projekt"
          value={String(projects.length)}
          icon={<LayoutDashboard className="h-5 w-5 text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label={`${selectedPeriodDays} nap worklog`}
          value={loadingWorklogs ? '–' : minutesToDisplay(periodMinutes)}
          icon={<Clock className="h-5 w-5 text-sky-600" />}
          color="bg-sky-50"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr,1.35fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Terheltség gyorsnézet</p>
            <h2 className="mt-1 text-base font-semibold text-gray-900">Mai munkaállapot</h2>
          </div>
          <MiniBarChart items={taskStatusItems} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Aktív task</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{myTasks.length}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Időszaki log</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{minutesToDisplay(periodMinutes)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Worklog trend</p>
              <h2 className="mt-1 text-base font-semibold text-gray-900">Elmúlt 7 nap</h2>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              {minutesToDisplay(worklogTrendItems.reduce((sum, item) => sum + item.minutes, 0))}
            </span>
          </div>
          <WorklogTrend items={worklogTrendItems} />
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Hozzám rendelt munkák</h2>
          <Link to={ROUTES.PROJECTS} className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
            Összes projekt <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingStories || loadingTasks ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3 animate-pulse">
                <div className="h-3 w-2/3 rounded bg-gray-100" />
                <div className="mt-2 h-3 w-1/3 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : myTasks.length === 0 && myStories.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-8 w-8" />}
            title="Még nincs hozzád rendelt munka"
            description="A taskok és a közvetlenül hozzád rendelt story-k itt jelennek meg."
            action={
              <Link to={ROUTES.PROJECTS}>
                <Button variant="outline" size="sm">Projektek böngészése</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {myTasks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Taskok</p>
                {myTasks.slice(0, 8).map((task) => {
                  const target = task.projectId ? ROUTES.STORY(task.projectId, task.storyId) : null
                  const content = (
                    <>
                      <p className="text-sm font-medium text-gray-800">{task.title}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Hozzám rendelt task · {minutesToDisplay(task.totalWorklogMinutes ?? 0)}
                      </p>
                    </>
                  )
                  return target ? (
                    <Link
                      key={task.id}
                      to={target}
                      className="block rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:shadow-sm"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      key={task.id}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                    >
                      {content}
                    </div>
                  )
                })}
              </div>
            )}

            {myStories.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Story-k</p>
                {myStories.map((story) => {
                  const project = projects.find((p) => p.id === story.projectId)
                  return (
                    <Link
                      key={story.id}
                      to={ROUTES.STORY(story.projectId, story.id)}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {project && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-500">
                              {project.prefix}-{story.sequenceNumber}
                            </span>
                          )}
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[story.type]}`}>
                            {TYPE_LABELS[story.type]}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{story.title}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[story.status]}`}>
                        {STATUS_LABELS[story.status]}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Saját időráfordításom</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedPeriodDays(7)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${selectedPeriodDays === 7 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              7 nap
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriodDays(30)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${selectedPeriodDays === 30 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              30 nap
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriodDays(90)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${selectedPeriodDays === 90 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              90 nap
            </button>
          </div>
        </div>

        {loadingWorklogs ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3 animate-pulse">
                <div className="h-3 w-2/3 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : visibleWorklogs.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8" />}
            title="Még nincs worklogod erre az időszakra"
            description="A storykon vagy taskokon rögzített időráfordítás itt fog megjelenni."
          />
        ) : (
          <div className="space-y-2">
            {visibleWorklogs.slice(0, 8).map((worklog) => {
              const target = worklog.projectId ? ROUTES.STORY(worklog.projectId, worklog.storyId) : null
              const content = (
                <>
                  <p className="text-sm font-medium text-gray-800">
                    {worklog.description?.trim() || 'Worklog bejegyzés'}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {worklog.date} · {minutesToDisplay(worklog.minutes)}
                  </p>
                </>
              )

              return target ? (
                <Link
                  key={worklog.id}
                  to={target}
                  className="block rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:shadow-sm"
                >
                  {content}
                </Link>
              ) : (
                <div key={worklog.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                  {content}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent projects */}
      {projects.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Projektek</h2>
            <Link to={ROUTES.PROJECTS} className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
              Mind <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                to={ROUTES.PROJECT(project.id)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700 shrink-0">
                  {project.prefix}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{project.name}</p>
                  <p className="text-xs text-gray-400">{project.storyCount} story</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color} shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}
