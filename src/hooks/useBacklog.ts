import { useEffect, useState } from 'react'
import { useOrgStore } from '@/stores/orgStore'
import { subscribeToBacklog } from '@/services/story.service'
import type { Story } from '@/types/models'
import type { StoryLocation } from '@/types/enums'

export type BacklogGroups = {
  board: Story[]
  planbox: Story[]
  backlog: Story[]
}

export function useBacklog(projectId: string) {
  const { currentOrg } = useOrgStore()
  const [groups, setGroups] = useState<BacklogGroups>({ board: [], planbox: [], backlog: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentOrg || !projectId) {
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub = subscribeToBacklog(currentOrg.id, projectId, (stories) => {
      const result: BacklogGroups = { board: [], planbox: [], backlog: [] }
      for (const story of stories) {
        const loc = story.location as StoryLocation
        if (loc === 'board') result.board.push(story)
        else if (loc === 'planbox') result.planbox.push(story)
        else result.backlog.push(story)
      }
      // Sort each group by their fractional index key (client-side)
      const cmp = (a: string | null | undefined, b: string | null | undefined) =>
        (a ?? '').localeCompare(b ?? '')
      result.backlog.sort((a, b) => cmp(a.backlogOrder, b.backlogOrder))
      result.planbox.sort((a, b) => cmp(a.planboxOrder, b.planboxOrder))
      result.board.sort((a, b) => cmp(a.columnOrder, b.columnOrder))
      setGroups(result)
      setLoading(false)
    })

    return unsub
  }, [currentOrg?.id, projectId])

  return { groups, loading }
}
