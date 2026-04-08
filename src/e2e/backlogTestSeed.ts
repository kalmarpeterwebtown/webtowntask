import { getDocs, query, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useOrgStore } from '@/stores/orgStore'
import { createStory } from '@/services/story.service'
import { projectsRef, storiesRef, storyRef } from '@/utils/firestore'

export async function ensureBacklogTestProject(): Promise<string> {
  const orgId = useOrgStore.getState().currentOrg?.id
  if (!orgId) throw new Error('Current org is not available for E2E backlog setup')

  const projectsSnap = await getDocs(query(projectsRef(orgId), orderBy('createdAt')))
  const firstProject = projectsSnap.docs[0]
  if (!firstProject) throw new Error('No project available for backlog E2E tests')

  return firstProject.id
}

export async function seedBacklogTestData(
  projectId: string,
  seed: {
    backlogA: string
    backlogB: string
    backlogC: string
    planboxA: string
    planboxB: string
  },
): Promise<void> {
  const orgId = useOrgStore.getState().currentOrg?.id
  if (!orgId) throw new Error('Org missing during backlog E2E seed setup')

  const desiredStories = [
    { title: seed.backlogA, location: 'backlog' as const, backlogOrder: 'a0', planboxOrder: null, estimate: 1 },
    { title: seed.backlogB, location: 'backlog' as const, backlogOrder: 'a1', planboxOrder: null, estimate: 2 },
    { title: seed.backlogC, location: 'backlog' as const, backlogOrder: 'a2', planboxOrder: null, estimate: 3 },
    { title: seed.planboxA, location: 'planbox' as const, backlogOrder: null, planboxOrder: 'a0', estimate: 5 },
    { title: seed.planboxB, location: 'planbox' as const, backlogOrder: null, planboxOrder: 'a1', estimate: 8 },
  ]

  const storiesSnap = await getDocs(storiesRef(orgId, projectId))
  const allStories = storiesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  const seedStories = allStories.filter(
    (story) => typeof story.title === 'string' && story.title.startsWith('E2E BL '),
  )

  const groupedByTitle = new Map<string, Array<{ id: string; title: string } & Record<string, unknown>>>()
  seedStories.forEach((story) => {
    const list = groupedByTitle.get(story.title as string) ?? []
    list.push(story as { id: string; title: string } & Record<string, unknown>)
    groupedByTitle.set(story.title as string, list)
  })

  for (const story of seedStories) {
    if (!desiredStories.some((desired) => desired.title === story.title)) {
      await updateDoc(storyRef(orgId, projectId, story.id), {
        location: 'backlog',
        boardId: null,
        columnId: null,
        columnOrder: null,
        backlogOrder: `zz-cleanup-${story.id}`,
        planboxOrder: null,
        updatedAt: serverTimestamp(),
      })
    }
  }

  for (const desired of desiredStories) {
    const matches = groupedByTitle.get(desired.title) ?? []
    const [primary, ...duplicates] = matches

    for (const duplicate of duplicates) {
      await updateDoc(storyRef(orgId, projectId, duplicate.id), {
        title: `${duplicate.title} duplicate ${duplicate.id.slice(0, 4)}`,
        location: 'backlog',
        boardId: null,
        columnId: null,
        columnOrder: null,
        backlogOrder: `zz-dup-${duplicate.id}`,
        planboxOrder: null,
        updatedAt: serverTimestamp(),
      })
    }

    if (primary) {
      await updateDoc(storyRef(orgId, projectId, primary.id), {
        title: desired.title,
        type: 'feature',
        priority: 'medium',
        status: 'draft',
        location: desired.location,
        boardId: null,
        columnId: null,
        columnOrder: null,
        backlogOrder: desired.backlogOrder,
        planboxOrder: desired.planboxOrder,
        sprintId: null,
        tagIds: [],
        assigneeIds: [],
        assigneeNames: [],
        estimate: desired.estimate,
        updatedAt: serverTimestamp(),
      })
    } else {
      await createStory(orgId, projectId, {
        title: desired.title,
        type: 'feature',
        priority: 'medium',
        location: desired.location,
        estimate: desired.estimate,
      })

      const refreshed = await getDocs(query(storiesRef(orgId, projectId), orderBy('createdAt')))
      const created = refreshed.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .find((story) => story.title === desired.title)

      if (created) {
        await updateDoc(storyRef(orgId, projectId, created.id), {
          backlogOrder: desired.backlogOrder,
          planboxOrder: desired.planboxOrder,
          updatedAt: serverTimestamp(),
        })
      }
    }
  }
}
