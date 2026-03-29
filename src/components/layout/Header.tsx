import { Search, Bell, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'
import { useNotificationStore } from '@/stores/notificationStore'

export function Header() {
  const { sidebarOpen, toggleSidebar, setSearchOpen, setNotificationPanelOpen } = useUiStore()
  const { unreadCount } = useNotificationStore()

  return (
    <header className="flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-4">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        title={sidebarOpen ? 'Menü bezárása' : 'Menü megnyitása'}
      >
        {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
      </button>

      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="group flex flex-1 items-center gap-3 rounded-2xl border border-gray-200 bg-gradient-to-r from-white to-gray-50 px-4 py-2.5 text-sm text-gray-400 shadow-sm transition-all hover:border-primary-200 hover:bg-white hover:shadow max-w-xl"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-colors group-hover:bg-primary-50 group-hover:text-primary-600">
          <Search className="h-4 w-4 shrink-0" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-sm font-medium text-gray-700">Fő kereső</p>
          <p className="truncate text-xs text-gray-400">Projekt, csapat, story vagy leírás alapján</p>
        </div>
        <kbd className="ml-auto hidden rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {/* Notifications */}
        <button
          onClick={() => setNotificationPanelOpen(true)}
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
