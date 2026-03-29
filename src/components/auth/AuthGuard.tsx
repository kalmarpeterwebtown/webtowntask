import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { ROUTES } from '@/config/constants'

export function AuthGuard() {
  const location = useLocation()
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
    const from = `${location.pathname}${location.search}`
    return <Navigate to={ROUTES.LOGIN} replace state={{ from }} />
  }

  return <Outlet />
}

/** Bejelentkezett, de még nincs szervezete — átirányítja az onboarding oldalra */
export function OrgGuard() {
  const { initialized, loading, userProfile, claims } = useAuthStore()
  const { currentOrg, memberships, membershipsLoaded, loading: orgLoading } = useOrgStore()

  const hasResolvableOrgHint = Boolean(currentOrg || claims.orgId || userProfile?.currentOrgId || memberships.length > 0)
  const waitingForOrgResolution = hasResolvableOrgHint && !currentOrg

  if (!initialized || loading || orgLoading || !membershipsLoaded || waitingForOrgResolution) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Betöltés...</p>
        </div>
      </div>
    )
  }

  if (!currentOrg) {
    return <Navigate to={ROUTES.SETUP} replace />
  }

  return <Outlet />
}

/** Kliens szerep számára — standard app nézet helyett Client layout-ot jelenít meg */
export function ClientGuard() {
  const { orgRole } = useOrgStore()
  if (orgRole === 'client') {
    return <Navigate to={ROUTES.CLIENT} replace />
  }
  return <Outlet />
}

/** Csak Admin számára elérhető route-ok */
export function AdminGuard() {
  const { orgRole } = useOrgStore()
  if (orgRole !== 'admin' && orgRole !== 'owner') {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }
  return <Outlet />
}
