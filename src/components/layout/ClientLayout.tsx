import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { signOut } from '@/services/auth.service'
import { Avatar } from '@/components/ui/Avatar'
import { ROUTES } from '@/config/constants'

export function ClientLayout() {
  const { userProfile } = useAuthStore()
  const { currentOrg } = useOrgStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate(ROUTES.LOGIN)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple top nav for clients */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white text-xs font-bold">
              A
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {currentOrg?.name ?? 'Agile Task Manager'}
            </span>
          </div>

          <nav className="flex items-center gap-1 ml-4">
            <NavLink
              to={ROUTES.CLIENT}
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              Projektek
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Avatar
              src={userProfile?.photoUrl}
              name={userProfile?.displayName}
              size="sm"
            />
            <span className="hidden text-sm text-gray-700 sm:block">
              {userProfile?.displayName}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              title="Kijelentkezés"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
