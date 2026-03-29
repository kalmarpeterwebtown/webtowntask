import { useEffect, useState } from 'react'
import { useOrgStore } from '@/stores/orgStore'
import { subscribeToProjects } from '@/services/project.service'
import type { Project } from '@/types/models'

export function useProjects() {
  const { currentOrg } = useOrgStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentOrg) {
      setProjects([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub = subscribeToProjects(currentOrg.id, (data) => {
      setProjects(data)
      setLoading(false)
    })

    return unsub
  }, [currentOrg?.id])

  return { projects, loading }
}
