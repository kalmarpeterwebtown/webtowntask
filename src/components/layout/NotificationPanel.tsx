import { useEffect } from 'react'
import { Bell, CheckCheck, MessageSquare, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useUiStore } from '@/stores/uiStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAuthStore } from '@/stores/authStore'
import { markAllNotificationsAsRead, markNotificationAsRead, subscribeToNotifications } from '@/services/notification.service'
import { ROUTES } from '@/config/constants'

function formatRelativeTime(input: { toDate?: () => Date } | null | undefined) {
  const date = input?.toDate?.()
  if (!date) return 'Most'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))
  if (diffMinutes < 1) return 'Most'
  if (diffMinutes < 60) return `${diffMinutes} perce`
  if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)} órája`
  return `${Math.round(diffMinutes / 1440)} napja`
}

export function NotificationPanel() {
  const { notificationPanelOpen, setNotificationPanelOpen } = useUiStore()
  const { userProfile } = useAuthStore()
  const { notifications, unreadCount, setNotifications, markAsRead, markAllAsRead } = useNotificationStore()

  useEffect(() => {
    if (!userProfile?.id) {
      setNotifications([])
      return
    }

    return subscribeToNotifications(userProfile.id, setNotifications)
  }, [userProfile?.id, setNotifications])

  const handleNotificationClick = async (notificationId: string, isRead: boolean) => {
    if (!userProfile?.id || isRead) return
    markAsRead(notificationId)
    await markNotificationAsRead(userProfile.id, notificationId)
  }

  const handleMarkAll = async () => {
    if (!userProfile?.id) return
    const unreadIds = notifications.filter((notification) => !notification.isRead).map((notification) => notification.id)
    markAllAsRead()
    await markAllNotificationsAsRead(userProfile.id, unreadIds)
  }

  return (
    <>
      {notificationPanelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setNotificationPanelOpen(false)}
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-200 ${
          notificationPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Értesítések</h2>
            <p className="mt-1 text-xs text-gray-500">
              {unreadCount > 0 ? `${unreadCount} olvasatlan` : 'Minden értesítés elolvasva'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-800"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mind olvasott
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotificationPanelOpen(false)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Panel bezárása"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Bell className="h-8 w-8 text-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-700">Még nincs értesítés</p>
                <p className="mt-1 text-xs text-gray-400">A mentionök és fontos események itt jelennek meg.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={notification.projectId ? ROUTES.STORY(notification.projectId, notification.entityId) : '#'}
                  onClick={() => {
                    void handleNotificationClick(notification.id, notification.isRead)
                    setNotificationPanelOpen(false)
                  }}
                  className={`block rounded-2xl border px-4 py-3 transition-colors ${
                    notification.isRead
                      ? 'border-gray-200 bg-white hover:border-gray-300'
                      : 'border-primary-200 bg-primary-50/70 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-2 ${notification.isRead ? 'bg-gray-100 text-gray-500' : 'bg-white text-primary-600'}`}>
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-800">{notification.title}</p>
                        {!notification.isRead && <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-gray-600">{notification.body}</p>
                      <p className="mt-2 text-xs text-gray-400">{formatRelativeTime(notification.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
