import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, FolderKanban, Users, BarChart2,
  Settings, ChevronDown, Plus, LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { signOut } from '@/services/auth.service'
import { Avatar } from '@/components/ui/Avatar'
import { ROUTES } from '@/config/constants'
import { isOrgAdmin } from '@/utils/permissions'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Áttekintő',  to: ROUTES.DASHBOARD, icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Projektek',  to: ROUTES.PROJECTS,  icon: <FolderKanban className="h-5 w-5" /> },
  { label: 'Csapatok',   to: ROUTES.TEAMS,     icon: <Users className="h-5 w-5" /> },
  { label: 'Riportok',   to: ROUTES.ORG_REPORTS, icon: <BarChart2 className="h-5 w-5" />, adminOnly: true },
]

export function Sidebar() {
  const { userProfile, claims } = useAuthStore()
  const { currentOrg } = useOrgStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate(ROUTES.LOGIN)
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo / Org */}
      <div className="flex h-14 items-center gap-2 border-b border-gray-100 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white text-xs font-bold">
          A
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {currentOrg?.name ?? 'Agile Task Manager'}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems
          .filter((item) => !item.adminOnly || isOrgAdmin(claims.orgRole))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

        {/* Settings section */}
        <div className="pt-4">
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Beállítások
          </p>
          {isOrgAdmin(claims.orgRole) && (
            <>
              <NavLink
                to={ROUTES.ORG_SETTINGS}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )
                }
              >
                <Settings className="h-5 w-5" />
                Szervezet
              </NavLink>
              <NavLink
                to={ROUTES.USERS}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )
                }
              >
                <Users className="h-5 w-5" />
                Felhasználók
              </NavLink>
            </>
          )}
        </div>
      </nav>

      {/* Quick add button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => {}} // TODO: global story create
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Új story
        </button>
      </div>

      {/* User profile */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <Avatar
            src={userProfile?.photoUrl}
            name={userProfile?.displayName}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {userProfile?.displayName}
            </p>
            <p className="truncate text-xs text-gray-500">{userProfile?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Kijelentkezés"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
