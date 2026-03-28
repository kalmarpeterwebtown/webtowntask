import { Search, Bell, Menu } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'
import { useNotificationStore } from '@/stores/notificationStore'

export function Header() {
  const { toggleSidebar, setSearchOpen, setNotificationPanelOpen } = useUiStore()
  const { unreadCount } = useNotificationStore()

  return (
    <header className="flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-4">
      {/* Mobile: sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400 hover:border-gray-300 hover:bg-white transition-colors max-w-sm"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span>Keresés…</span>
        <kbd className="ml-auto hidden rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400 sm:block">
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
