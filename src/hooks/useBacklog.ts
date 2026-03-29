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

export function useBacklog(projectId: string, enabled = true) {
  const { currentOrg } = useOrgStore()
  const orgId = currentOrg?.id ?? null
  const [snapshot, setSnapshot] = useState<{
    orgId: string | null
    projectId: string
    groups: BacklogGroups
    ready: boolean
  }>({
    orgId: null,
    projectId: '',
    groups: { board: [], planbox: [], backlog: [] },
    ready: false,
  })

  useEffect(() => {
    if (!enabled || !orgId || !projectId) return

    const unsub = subscribeToBacklog(orgId, projectId, (stories) => {
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
      setSnapshot({
        orgId,
        projectId,
        groups: result,
        ready: true,
      })
    })

    return unsub
  }, [enabled, orgId, projectId])

  return {
    groups: enabled && snapshot.orgId === orgId && snapshot.projectId === projectId
      ? snapshot.groups
      : { board: [], planbox: [], backlog: [] },
    loading: enabled && !!orgId && !!projectId && (
      snapshot.orgId !== orgId ||
      snapshot.projectId !== projectId ||
      !snapshot.ready
    ),
  }
}
