import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { LayoutDashboard, FolderKanban, Users, Settings, Shield } from 'lucide-react'
import { ROUTES } from '@/config/constants'
import { useAuthStore } from '@/stores/authStore'

export function MobileNav() {
  const isSuperAdmin = useAuthStore((state) => state.claims.platformRole === 'super_admin')
  const items = isSuperAdmin
    ? [
        { label: 'Áttekintő', to: ROUTES.DASHBOARD, icon: LayoutDashboard },
        { label: 'Projektek', to: ROUTES.PROJECTS, icon: FolderKanban },
        { label: 'Platform', to: ROUTES.PLATFORM, icon: Shield },
        { label: 'Profil', to: ROUTES.PROFILE, icon: Settings },
      ]
    : [
        { label: 'Áttekintő', to: ROUTES.DASHBOARD, icon: LayoutDashboard },
        { label: 'Projektek', to: ROUTES.PROJECTS, icon: FolderKanban },
        { label: 'Csapatok', to: ROUTES.TEAMS, icon: Users },
        { label: 'Profil', to: ROUTES.PROFILE, icon: Settings },
      ]

  return (
    <nav className="flex h-16 items-center justify-around border-t border-gray-200 bg-white px-2 lg:hidden">
      {items.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            clsx(
              'flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
              isActive
                ? 'text-primary-600'
                : 'text-gray-500 hover:text-gray-800',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={clsx('h-5 w-5', isActive && 'stroke-[2.5]')} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
