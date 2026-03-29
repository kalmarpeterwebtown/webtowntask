import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { onSnapshot } from 'firebase/firestore'
import { LayoutList, Settings, BarChart2, ArrowRight, FolderKanban } from 'lucide-react'
import { useOrgStore } from '@/stores/orgStore'
import { projectRef, storiesRef } from '@/utils/firestore'
import { ROUTES, STATUS_COLORS, TYPE_COLORS } from '@/config/constants'
import { useProjects } from '@/hooks/useProjects'
import { useProjectAccessMap } from '@/hooks/useAccess'
import type { Project, Story } from '@/types/models'
import { query, where } from 'firebase/firestore'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Tervezet',
  ready: 'Kész',
  in_progress: 'Folyamatban',
  review: 'Review',
  done: 'Kész',
  delivered: 'Átadva',
}

const TYPE_LABELS: Record<string, string> = {
  feature: 'Feature',
  bug: 'Bug',
  tech_debt: 'Tech Debt',
  chore: 'Chore',
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function MiniBar({ label, count, total, colorClass }: { label: string; count: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 text-xs text-gray-600">{label}</span>
      <div className="flex-1 rounded-full bg-gray-100 h-2">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-right text-xs text-gray-500">{count}</span>
    </div>
  )
}

export function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { currentOrg } = useOrgStore()
  const orgId = currentOrg?.id ?? null
  const { projects: allProjects } = useProjects()
  const { projects: visibleProjects, loading: accessLoading } = useProjectAccessMap(allProjects)
  const [project, setProject] = useState<Project | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const canAccessProject = visibleProjects.some((visibleProject) => visibleProject.id === projectId)

  useEffect(() => {
    if (!orgId || !projectId || !canAccessProject) return
    const unsub = onSnapshot(projectRef(orgId, projectId), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project)
    })
    return unsub
  }, [orgId, projectId, canAccessProject])

  useEffect(() => {
    if (!orgId || !projectId || !canAccessProject) return
    const q = query(storiesRef(orgId, projectId), where('status', '!=', 'delivered'))
    const unsub = onSnapshot(q, (snap) => {
      setStories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story)))
    })
    return unsub
  }, [orgId, projectId, canAccessProject])

  if (accessLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!canAccessProject) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Ehhez a projekthez jelenleg nincs hozzáférésed.</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6 flex justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  const total = stories.length
  const done = stories.filter((s) => s.status === 'done').length
  const inProgress = stories.filter((s) => s.status === 'in_progress').length
  const onBoard = stories.filter((s) => s.location === 'board').length

  // Count by status (excluding delivered)
  const byStatus = stories.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  const byType = stories.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-md bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
              {project.prefix}
            </span>
            <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
          </div>
          {project.description && (
            <p className="text-sm text-gray-500 max-w-lg">{project.description}</p>
          )}
        </div>
        <Link
          to={ROUTES.PROJECT_SETTINGS(project.id)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-gray-300 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Beállítások
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Összes story" value={total} />
        <StatCard label="Folyamatban" value={inProgress} />
        <StatCard label="Kész" value={done} />
        <StatCard label="Board-on" value={onBoard} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: <LayoutList className="h-5 w-5 text-primary-600" />,
            label: 'Backlog',
            desc: 'Story-k kezelése',
            to: ROUTES.BACKLOG(project.id),
          },
          {
            icon: <BarChart2 className="h-5 w-5 text-purple-500" />,
            label: 'Riportok',
            desc: 'Projekt statisztikák',
            to: ROUTES.REPORTS(project.id),
          },
          {
            icon: <FolderKanban className="h-5 w-5 text-orange-500" />,
            label: 'Beállítások',
            desc: 'Prefix, típusok, tagok',
            to: ROUTES.PROJECT_SETTINGS(project.id),
          },
        ].map(({ icon, label, desc, to }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
          </Link>
        ))}
      </div>

      {/* Breakdown */}
      {total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Státusz szerint</h2>
            <div className="space-y-2">
              {Object.entries(byStatus).map(([status, count]) => {
                const colorClass = STATUS_COLORS[status] ?? 'bg-gray-200'
                const bg = colorClass.split(' ')[0]
                return (
                  <MiniBar
                    key={status}
                    label={STATUS_LABELS[status] ?? status}
                    count={count}
                    total={total}
                    colorClass={bg}
                  />
                )
              })}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Típus szerint</h2>
            <div className="space-y-2">
              {Object.entries(byType).map(([type, count]) => {
                const colorClass = TYPE_COLORS[type] ?? 'bg-gray-200'
                const bg = colorClass.split(' ')[0]
                return (
                  <MiniBar
                    key={type}
                    label={TYPE_LABELS[type] ?? type}
                    count={count}
                    total={total}
                    colorClass={bg}
                  />
                )
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
