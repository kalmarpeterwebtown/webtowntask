import { useEffect, useState } from 'react'
import { LayoutDashboard, Clock, CheckSquare, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { onSnapshot, query, where, collectionGroup } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { useProjects } from '@/hooks/useProjects'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROUTES, STATUS_COLORS, TYPE_COLORS } from '@/config/constants'
import type { Story } from '@/types/models'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Tervezet', ready: 'Kész', in_progress: 'Folyamatban',
  review: 'Review', done: 'Kész', delivered: 'Átadva',
}

const TYPE_LABELS: Record<string, string> = {
  feature: 'Feature', bug: 'Bug', tech_debt: 'Tech Debt', chore: 'Chore',
}

export function DashboardPage() {
  const { userProfile, firebaseUser } = useAuthStore()
  const { currentOrg } = useOrgStore()
  const { projects } = useProjects()
  const [myStories, setMyStories] = useState<Story[]>([])
  const [loadingStories, setLoadingStories] = useState(true)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Jó reggelt'
    if (h < 18) return 'Jó napot'
    return 'Jó estét'
  }

  // Load stories assigned to the current user (collection group query)
  useEffect(() => {
    if (!firebaseUser) { setLoadingStories(false); return }

    const q = query(
      collectionGroup(db, 'stories'),
      where('assigneeIds', 'array-contains', firebaseUser.uid),
      where('status', 'in', ['ready', 'in_progress', 'review']),
    )
    const unsub = onSnapshot(q, (snap) => {
      setMyStories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story)))
      setLoadingStories(false)
    }, () => {
      // Collection group query may need an index — gracefully handle error
      setLoadingStories(false)
    })
    return unsub
  }, [firebaseUser?.uid])

  const dueThisWeek = myStories.filter((s) => {
    if (!s.dueDate) return false
    const due = (s.dueDate as unknown as { toDate?: () => Date })?.toDate?.()
    if (!due) return false
    const now = new Date()
    const endOfWeek = new Date(now)
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()))
    return due <= endOfWeek
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Hozzám rendelt story"
          value={loadingStories ? '–' : String(myStories.length)}
          icon={<CheckSquare className="h-5 w-5 text-primary-600" />}
          color="bg-primary-50"
        />
        <StatCard
          label="Lejáró ezen a héten"
          value={loadingStories ? '–' : String(dueThisWeek.length)}
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          color="bg-orange-50"
        />
        <StatCard
          label="Aktív projekt"
          value={String(projects.length)}
          icon={<LayoutDashboard className="h-5 w-5 text-green-600" />}
          color="bg-green-50"
        />
      </div>

      {/* My stories */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Saját feladataim</h2>
          <Link to={ROUTES.PROJECTS} className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
            Összes projekt <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingStories ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3 animate-pulse">
                <div className="h-3 w-2/3 rounded bg-gray-100" />
                <div className="mt-2 h-3 w-1/3 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : myStories.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-8 w-8" />}
            title="Még nincsenek feladataid"
            description="Amint story-t rendelnek hozzád, itt jelenik meg."
            action={
              <Link to={ROUTES.PROJECTS}>
                <Button variant="outline" size="sm">Projektek böngészése</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {myStories.map((story) => {
              // Find project from list
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
