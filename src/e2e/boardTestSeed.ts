import { getDoc, getDocs, query, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useOrgStore } from '@/stores/orgStore'
import { useAuthStore } from '@/stores/authStore'
import { createTeam, connectProjectToTeam } from '@/services/team.service'
import { createStory } from '@/services/story.service'
import { teamsRef, teamRef, projectsRef, storiesRef, storyRef } from '@/utils/firestore'

export async function ensureBoardTestTeam(teamName: string): Promise<string> {
  const orgId = useOrgStore.getState().currentOrg?.id
  if (!orgId) throw new Error('Current org is not available for E2E team setup')

  const teamsSnap = await getDocs(query(teamsRef(orgId), orderBy('createdAt')))
  let teamDoc = teamsSnap.docs.find((doc) => doc.data().name === teamName) ?? null

  if (!teamDoc) {
    const projectsSnap = await getDocs(query(projectsRef(orgId), orderBy('createdAt')))
    const firstProject = projectsSnap.docs[0]
    if (!firstProject) throw new Error('No project available to connect to the E2E team')

    const createdTeamId = await createTeam(orgId, teamName, 'Dedicated board for Playwright E2E tests')
    await connectProjectToTeam(orgId, createdTeamId, firstProject.id)
    teamDoc = await getDoc(teamRef(orgId, createdTeamId))
  }

  return teamDoc.id
}

export async function seedBoardTestData(
  teamId: string,
  seed: {
    todoA: string
    todoB: string
    todoC: string
    inProgress: string
  },
): Promise<void> {
  const orgId = useOrgStore.getState().currentOrg?.id
  const firebaseUser = useAuthStore.getState().firebaseUser
  if (!orgId || !firebaseUser) throw new Error('Org or user missing during E2E seed setup')

  const teamSnap = await getDoc(teamRef(orgId, teamId))
  const team = teamSnap.data()
  if (!team) throw new Error('E2E team not found during seed setup')

  const projectId = team.connectedProjectIds?.[0]
  if (!projectId) throw new Error('E2E team has no connected project')

  const columnByName = Object.fromEntries(
    team.boardConfig.columns.map((column: { id: string; name: string }) => [column.name, column.id]),
  )
  const desiredStories = [
    { title: seed.todoA, columnId: columnByName['Teendő'], columnOrder: 'a0', estimate: 1 },
    { title: seed.todoB, columnId: columnByName['Teendő'], columnOrder: 'a1', estimate: 2 },
    { title: seed.todoC, columnId: columnByName['Teendő'], columnOrder: 'a2', estimate: 3 },
    { title: seed.inProgress, columnId: columnByName['Folyamatban'], columnOrder: 'a0', estimate: 5 },
  ]

  const storiesSnap = await getDocs(storiesRef(orgId, projectId))
  const allStories = storiesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  const seedStories = allStories.filter((story) => typeof story.title === 'string' && story.title.startsWith('E2E '))

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
        location: 'board',
        boardId: teamId,
        columnId: desired.columnId,
        columnOrder: desired.columnOrder,
        backlogOrder: null,
        planboxOrder: null,
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
        location: 'board',
        boardId: teamId,
        columnId: desired.columnId,
        columnOrder: desired.columnOrder,
        estimate: desired.estimate,
      })
    }
  }
}

export async function seedSingleBoardStory(
  teamId: string,
  storyTitle: string,
  columnName = 'Teendő',
): Promise<void> {
  const orgId = useOrgStore.getState().currentOrg?.id
  const firebaseUser = useAuthStore.getState().firebaseUser
  if (!orgId || !firebaseUser) throw new Error('Org or user missing during E2E seed setup')

  const teamSnap = await getDoc(teamRef(orgId, teamId))
  const team = teamSnap.data()
  if (!team) throw new Error('E2E team not found during seed setup')

  const projectId = team.connectedProjectIds?.[0]
  if (!projectId) throw new Error('E2E team has no connected project')

  const sortedColumns = [...team.boardConfig.columns].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
  const targetColumn = sortedColumns.find((column: { name: string }) => column.name === columnName) ?? sortedColumns[0]
  if (!targetColumn) throw new Error('E2E team has no board columns')

  const storiesSnap = await getDocs(storiesRef(orgId, projectId))
  const matching = storiesSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((story) => story.title === storyTitle)

  const lastOrder = storiesSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((story) => story.location === 'board' && story.boardId === teamId && story.columnId === targetColumn.id)
    .map((story) => typeof story.columnOrder === 'string' ? story.columnOrder : '')
    .sort()
    .at(-1)

  const nextOrder = lastOrder ? `${lastOrder}z` : 'a0'

  const [primary, ...duplicates] = matching

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
      title: storyTitle,
      type: 'feature',
      priority: 'medium',
      status: 'draft',
      location: 'board',
      boardId: teamId,
      columnId: targetColumn.id,
      columnOrder: nextOrder,
      backlogOrder: null,
      planboxOrder: null,
      sprintId: null,
      tagIds: [],
      assigneeIds: [],
      assigneeNames: [],
      updatedAt: serverTimestamp(),
    })
    return
  }

  await createStory(orgId, projectId, {
    title: storyTitle,
    type: 'feature',
    priority: 'medium',
    location: 'board',
    boardId: teamId,
    columnId: targetColumn.id,
    columnOrder: nextOrder,
    estimate: 1,
  })
}
