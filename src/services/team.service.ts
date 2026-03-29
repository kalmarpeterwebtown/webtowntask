import {
  doc,
  setDoc,
  addDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore'
import { auth } from '@/config/firebase'
import { teamsRef, teamRef, teamMembersRef, storiesRef, storyRef } from '@/utils/firestore'
import { keyBetween } from '@/utils/fractionalIndex'
import type { Team, BoardColumn, Story } from '@/types/models'

const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'col-0', name: 'Teendő',      order: 'a0', isDoneColumn: false, color: '#6B7280' },
  { id: 'col-1', name: 'Folyamatban', order: 'a1', isDoneColumn: false, color: '#3B82F6' },
  { id: 'col-2', name: 'Review',      order: 'a2', isDoneColumn: false, color: '#8B5CF6' },
  { id: 'col-3', name: 'Kész',        order: 'a3', isDoneColumn: true,  color: '#10B981' },
]

export async function createTeam(
  orgId: string,
  name: string,
  description?: string,
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Nincs bejelentkezett felhasználó')

  const ref = await addDoc(teamsRef(orgId), {
    name,
    description: description ?? '',
    connectedProjectIds: [],
    boardConfig: { mode: 'kanban', columns: DEFAULT_COLUMNS },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid,
  })

  // Add creator as manage member
  await setDoc(doc(teamMembersRef(orgId, ref.id), user.uid), {
    userId: user.uid,
    displayName: user.displayName ?? user.email ?? 'Felhasználó',
    email: user.email ?? '',
    access: 'manage',
    joinedAt: serverTimestamp(),
  })

  return ref.id
}

export async function connectProjectToTeam(
  orgId: string,
  teamId: string,
  projectId: string,
): Promise<void> {
  const snap = await getDoc(teamRef(orgId, teamId))
  const current: string[] = snap.data()?.connectedProjectIds ?? []
  if (!current.includes(projectId)) {
    await updateDoc(teamRef(orgId, teamId), {
      connectedProjectIds: [...current, projectId],
      updatedAt: serverTimestamp(),
    })
  }
}

export async function updateTeamColumns(
  orgId: string,
  teamId: string,
  columns: BoardColumn[],
): Promise<void> {
  await updateDoc(teamRef(orgId, teamId), {
    'boardConfig.columns': columns,
    updatedAt: serverTimestamp(),
  })
}

export function subscribeToTeams(
  orgId: string,
  callback: (teams: Team[]) => void,
): () => void {
  const q = query(teamsRef(orgId), orderBy('createdAt'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team)))
  })
}

export function subscribeToTeam(
  orgId: string,
  teamId: string,
  callback: (team: Team | null) => void,
): () => void {
  return onSnapshot(teamRef(orgId, teamId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Team) : null)
  })
}

/**
 * Subscribe to all stories on a team's board across connected projects.
 */
export function subscribeToBoardStories(
  orgId: string,
  teamId: string,
  connectedProjectIds: string[],
  callback: (stories: Story[]) => void,
): () => void {
  if (connectedProjectIds.length === 0) {
    callback([])
    return () => {}
  }

  const storiesMap = new Map<string, Story>()
  const unsubs: Array<() => void> = []

  const emit = () => callback(Array.from(storiesMap.values()))

  for (const projectId of connectedProjectIds) {
    const q = query(
      storiesRef(orgId, projectId),
      where('location', '==', 'board'),
      where('boardId', '==', teamId),
    )
    const unsub = onSnapshot(q, (snap) => {
      // Clear old stories from this project then re-add
      for (const [id, s] of storiesMap) {
        if (s.projectId === projectId) storiesMap.delete(id)
      }
      snap.docs.forEach((d) => {
        storiesMap.set(d.id, { id: d.id, ...d.data() } as Story)
      })
      emit()
    })
    unsubs.push(unsub)
  }

  return () => unsubs.forEach((u) => u())
}

export async function moveStoryToColumn(
  orgId: string,
  projectId: string,
  storyId: string,
  teamId: string,
  columnId: string,
  newOrder: string,
): Promise<void> {
  await updateDoc(storyRef(orgId, projectId, storyId), {
    location: 'board',
    boardId: teamId,
    columnId,
    columnOrder: newOrder,
    backlogOrder: null,
    planboxOrder: null,
    updatedAt: serverTimestamp(),
  })
}

export { keyBetween }
