import { ROUTES } from '@/config/constants'

export function sanitizeRedirectTarget(target: string | null | undefined): string | null {
  if (!target) return null
  if (!target.startsWith('/')) return null
  if (target.startsWith('//')) return null
  return target
}

export function resolvePostAuthRedirect(
  stateFrom?: string | null,
  search?: string,
): string {
  const fromState = sanitizeRedirectTarget(stateFrom)
  if (fromState) return fromState

  if (search) {
    const params = new URLSearchParams(search)
    const fromQuery = sanitizeRedirectTarget(params.get('redirect'))
    if (fromQuery) return fromQuery
  }

  return ROUTES.DASHBOARD
}
