import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ROUTES } from '@/config/constants'

export function AuthGuard() {
  const { firebaseUser, initialized, loading } = useAuthStore()

  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Betöltés...</p>
        </div>
      </div>
    )
  }

  if (!firebaseUser) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  return <Outlet />
}

/** Kliens szerep számára — standard app nézet helyett Client layout-ot jelenít meg */
export function ClientGuard() {
  const { claims } = useAuthStore()
  if (claims.orgRole === 'client') {
    return <Navigate to={ROUTES.CLIENT} replace />
  }
  return <Outlet />
}

/** Csak Admin számára elérhető route-ok */
export function AdminGuard() {
  const { claims } = useAuthStore()
  if (claims.orgRole !== 'admin' && claims.orgRole !== 'owner') {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }
  return <Outlet />
}
