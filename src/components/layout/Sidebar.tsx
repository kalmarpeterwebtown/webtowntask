import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, FolderKanban, Users, BarChart2,
  Settings, ChevronDown, Plus, LogOut, User,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { signOut } from '@/services/auth.service'
import { Avatar } from '@/components/ui/Avatar'
import { WebtownLogo } from '@/components/branding/WebtownLogo'
import { ROUTES } from '@/config/constants'

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
  const { userProfile } = useAuthStore()
  const { currentOrg, orgRole } = useOrgStore()
  const isAdmin = orgRole === 'owner' || orgRole === 'admin'
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate(ROUTES.LOGIN)
  }

  return (
    <aside className="flex h-full w-60 flex-col bg-navy-800">
      {/* Logo / Org */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <WebtownLogo variant="light" className="h-8 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-[11px] uppercase tracking-[0.18em] text-white/35">
            Workspace
          </p>
          <p className="truncate text-sm font-semibold text-white">
            {currentOrg?.name ?? 'Agile Task Manager'}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

        {/* Settings section */}
        <div className="pt-4">
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-white/30">
            Beállítások
          </p>
          <NavLink
            to={ROUTES.PROFILE}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <User className="h-5 w-5" />
            Profil
          </NavLink>
          {isAdmin && (
            <>
              <NavLink
                to={ROUTES.ORG_SETTINGS}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white',
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
                      ? 'bg-primary-600 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white',
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
          onClick={() => {}}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-white/50 hover:border-primary-500 hover:text-primary-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Új story
        </button>
      </div>

      {/* User profile */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <Avatar
            src={userProfile?.photoUrl}
            name={userProfile?.displayName}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {userProfile?.displayName}
            </p>
            <p className="truncate text-xs text-white/50">{userProfile?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="shrink-0 rounded p-1 text-white/40 hover:text-white transition-colors"
            title="Kijelentkezés"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
