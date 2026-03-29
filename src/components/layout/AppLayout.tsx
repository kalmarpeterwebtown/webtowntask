import { Outlet } from 'react-router-dom'
import { useUiStore } from '@/stores/uiStore'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { NotificationPanel } from './NotificationPanel'
import { clsx } from 'clsx'

export function AppLayout() {
  const { sidebarOpen } = useUiStore()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div
        className={clsx(
          'hidden lg:flex shrink-0 transition-all duration-200',
          sidebarOpen ? 'w-60' : 'w-0 overflow-hidden',
        )}
      >
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => useUiStore.getState().setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-60 shadow-xl">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <MobileNav />
      </div>

      <NotificationPanel />
    </div>
  )
}
