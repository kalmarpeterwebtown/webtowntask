import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, query, orderBy } from 'firebase/firestore'
import { Building2, FolderKanban, AlertTriangle, BarChart3 } from 'lucide-react'
import { useOrgStore } from '@/stores/orgStore'
import { useProjects } from '@/hooks/useProjects'
import { storiesRef } from '@/utils/firestore'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Story } from '@/types/models'

function OrgMetric({
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
        <div className="rounded-xl bg-primary-50 p-2 text-primary-600">{icon}</div>
      </div>
    </div>
  )
}

export function OrgReportPage() {
  const { currentOrg } = useOrgStore()
  const orgId = currentOrg?.id ?? null
  const { projects, loading } = useProjects()
  const [storiesByProject, setStoriesByProject] = useState<Record<string, Story[]>>({})

  useEffect(() => {
    if (!orgId || projects.length === 0) return

    const unsubs = projects.map((project) => {
      const q = query(storiesRef(orgId, project.id), orderBy('createdAt', 'desc'))
      return onSnapshot(q, (snap) => {
        setStoriesByProject((prev) => ({
          ...prev,
          [project.id]: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Story)),
        }))
      })
    })

    return () => unsubs.forEach((unsub) => unsub())
  }, [orgId, projects])

  const allStories = useMemo(
    () => projects.flatMap((project) => storiesByProject[project.id] ?? []),
    [projects, storiesByProject],
  )

  const totalEstimatedPoints = allStories.reduce((sum, story) => sum + (story.estimate ?? 0), 0)
  const deliveredStories = allStories.filter((story) => story.status === 'delivered').length
  const blockedStories = allStories.filter((story) => story.isBlocked).length

  const topProjects = projects
    .map((project) => {
      const stories = storiesByProject[project.id] ?? []
      return {
        id: project.id,
        name: project.name,
        prefix: project.prefix,
        storyCount: stories.length,
        deliveredCount: stories.filter((story) => story.status === 'delivered').length,
        blockedCount: stories.filter((story) => story.isBlocked).length,
      }
    })
    .sort((a, b) => b.storyCount - a.storyCount)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="Még nincs szervezeti riport adat"
          description="Előbb hozz létre legalább egy projektet, hogy összesített riportot láss."
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Szervezeti riportok</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gyors összkép az összes aktív projektről.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OrgMetric
          label="Aktív projektek"
          value={String(projects.length)}
          hint={currentOrg?.name}
          icon={<FolderKanban className="h-5 w-5" />}
        />
        <OrgMetric
          label="Összes story"
          value={String(allStories.length)}
          hint={`${deliveredStories} átadva`}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <OrgMetric
          label="Becsült pont"
          value={`${totalEstimatedPoints} pt`}
          hint="Az összes aktív projektben"
          icon={<Building2 className="h-5 w-5" />}
        />
        <OrgMetric
          label="Blokkolt story"
          value={String(blockedStories)}
          hint="Szervezeti szintű figyelmeztetés"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Projekt összehasonlítás</h2>
          <p className="mt-1 text-sm text-gray-500">Melyik projektben mennyi story és kockázat gyűlt össze.</p>
        </div>

        <div className="space-y-3">
          {topProjects.map((project) => (
            <div key={project.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{project.name}</p>
                <p className="text-xs text-gray-500">{project.prefix}</p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{project.storyCount}</p>
                  <p className="text-xs text-gray-500">story</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{project.deliveredCount}</p>
                  <p className="text-xs text-gray-500">átadva</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{project.blockedCount}</p>
                  <p className="text-xs text-gray-500">blokkolt</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
