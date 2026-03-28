import { LayoutDashboard, Clock, CheckSquare, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ROUTES } from '@/config/constants'

export function DashboardPage() {
  const { userProfile } = useAuthStore()
  const { currentOrg } = useOrgStore()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Jó reggelt'
    if (h < 18) return 'Jó napot'
    return 'Jó estét'
  }

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
          value="–"
          icon={<CheckSquare className="h-5 w-5 text-primary-600" />}
          color="bg-primary-50"
        />
        <StatCard
          label="Lejáró ezen a héten"
          value="–"
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          color="bg-orange-50"
        />
        <StatCard
          label="Aktív projekt"
          value="–"
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
      </section>

      {/* Recent activity placeholder */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Legutóbbi aktivitás</h2>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
              <div className="h-7 w-7 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 rounded bg-gray-100" />
                <div className="h-3 w-1/3 rounded bg-gray-100" />
              </div>
              <Badge variant="default" className="opacity-40">–</Badge>
            </div>
          ))}
        </div>
      </section>
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
