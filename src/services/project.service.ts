import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore'
import { projectsRef, projectRef } from '@/utils/firestore'
import type { Project } from '@/types/models'
import { auth } from '@/config/firebase'

export type CreateProjectInput = {
  name: string
  description?: string
  prefix: string
}

export async function createProject(
  orgId: string,
  input: CreateProjectInput,
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Nincs bejelentkezett felhasználó')

  const docRef = doc(projectsRef(orgId))
  await setDoc(docRef, {
    name: input.name,
    description: input.description ?? '',
    prefix: input.prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
    status: 'active',
    connectedTeamIds: [],
    storyCount: 0,
    nextSequenceNumber: 1,
    settings: {
      storyTypes: ['feature', 'bug', 'tech_debt', 'chore'],
      priorities: ['critical', 'high', 'medium', 'low'],
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid,
  })
  return docRef.id
}

export async function updateProject(
  orgId: string,
  projectId: string,
  data: Partial<Pick<Project, 'name' | 'description' | 'prefix' | 'settings'>>,
): Promise<void> {
  await updateDoc(projectRef(orgId, projectId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function archiveProject(orgId: string, projectId: string): Promise<void> {
  await updateDoc(projectRef(orgId, projectId), {
    status: 'archived',
    updatedAt: serverTimestamp(),
  })
}

export function subscribeToProjects(
  orgId: string,
  callback: (projects: Project[]) => void,
): () => void {
  const q = query(
    projectsRef(orgId),
    where('status', '!=', 'archived'),
    orderBy('status'),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project))
    callback(projects)
  })
}
