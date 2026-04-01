import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useOrgStore } from '@/stores/orgStore'
import { subscribeToCurrentUserProjectIds } from '@/services/access.service'
import { subscribeProjectsByIds, subscribeToProjects } from '@/services/project.service'
import { isOrgAdmin } from '@/utils/permissions'
import type { Project } from '@/types/models'

export function useProjects() {
  const { currentOrg, loading: orgLoading, orgRole } = useOrgStore()
  const { firebaseUser } = useAuthStore()
  const orgId = currentOrg?.id ?? null
  const userId = firebaseUser?.uid ?? null
  const admin = isOrgAdmin(orgRole ?? undefined)
  const [snapshot, setSnapshot] = useState<{
    orgId: string | null
    projects: Project[]
    ready: boolean
    error: string | null
  }>({
    orgId: null,
    projects: [],
    ready: false,
    error: null,
  })

  useEffect(() => {
    if (!orgId) return

    const setProjects = (projects: Project[]) => {
      setSnapshot({
        orgId,
        projects,
        ready: true,
        error: null,
      })
    }

    const setError = () => {
      setSnapshot({
        orgId,
        projects: [],
        ready: true,
        error: 'A projektek betöltése átmenetileg nem sikerült.',
      })
    }

    if (admin) {
      return subscribeToProjects(orgId, setProjects, setError)
    }

    if (!userId) return

    let unsubscribeProjects: (() => void) | null = null

    const unsubscribeMemberships = subscribeToCurrentUserProjectIds(
      orgId,
      userId,
      (projectIds) => {
        unsubscribeProjects?.()
        setSnapshot((prev) => ({
          ...prev,
          orgId,
          ready: false,
          error: null,
        }))
        unsubscribeProjects = subscribeProjectsByIds(orgId, projectIds, setProjects, setError)
      },
    )

    return () => {
      unsubscribeProjects?.()
      unsubscribeMemberships()
    }
  }, [admin, orgId, userId])

  return {
    projects: !userId ? [] : snapshot.orgId === orgId ? snapshot.projects : [],
    loading: orgLoading || (!!userId && orgId !== null && (snapshot.orgId !== orgId || !snapshot.ready)),
    error: !userId ? null : snapshot.orgId === orgId ? snapshot.error : null,
  }
}
