import { useEffect, useState } from 'react'
import { useOrgStore } from '@/stores/orgStore'
import { subscribeToProjects } from '@/services/project.service'
import type { Project } from '@/types/models'

export function useProjects() {
  const { currentOrg, loading: orgLoading } = useOrgStore()
  const orgId = currentOrg?.id ?? null
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

    const unsub = subscribeToProjects(
      orgId,
      (data) => {
        setSnapshot({
          orgId,
          projects: data,
          ready: true,
          error: null,
        })
      },
      () => {
        setSnapshot({
          orgId,
          projects: [],
          ready: true,
          error: 'A projektek betöltése átmenetileg nem sikerült.',
        })
      },
    )

    return unsub
  }, [orgId])

  return {
    projects: snapshot.orgId === orgId ? snapshot.projects : [],
    loading: orgLoading || (orgId !== null && (snapshot.orgId !== orgId || !snapshot.ready)),
    error: snapshot.orgId === orgId ? snapshot.error : null,
  }
}
