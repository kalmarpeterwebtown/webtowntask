import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { projectsRef, projectRef, projectMemberRef } from '@/utils/firestore'
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
  const now = Timestamp.now()
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
    // Client timestamp keeps the project visible immediately in queries ordered by createdAt.
    createdAt: now,
    updatedAt: now,
    createdBy: user.uid,
  })

  await setDoc(projectMemberRef(orgId, docRef.id, user.uid), {
    userId: user.uid,
    displayName: user.displayName ?? user.email ?? 'Felhasználó',
    email: user.email ?? '',
    photoUrl: user.photoURL ?? null,
    access: 'manage',
    role: 'po',
    joinedAt: serverTimestamp(),
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
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    projectsRef(orgId),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    const projects = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Project))
      .filter((project) => project.status !== 'archived')
    callback(projects)
  }, (error) => {
    console.error('subscribeToProjects error:', error)
    onError?.(error)
  })
}

export function subscribeProjectsByIds(
  orgId: string,
  projectIds: string[],
  callback: (projects: Project[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (projectIds.length === 0) {
    callback([])
    return () => {}
  }

  const projectsMap = new Map<string, Project>()

  const emit = () => {
    callback(
      Array.from(projectsMap.values())
        .filter((project) => project.status !== 'archived')
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0
          const bTime = b.createdAt?.toMillis?.() ?? 0
          return aTime - bTime
        }),
    )
  }

  const unsubs = projectIds.map((projectId) =>
    onSnapshot(projectRef(orgId, projectId), async (snap) => {
      if (!snap.exists()) {
        projectsMap.delete(projectId)
        emit()
        return
      }

      const project = { id: snap.id, ...snap.data() } as Project
      projectsMap.set(projectId, project)
      emit()
    }, async (error) => {
      // As a safety fallback, try a one-shot read to distinguish transient
      // listener issues from a missing document.
      try {
        const snap = await getDoc(projectRef(orgId, projectId))
        if (snap.exists()) {
          projectsMap.set(projectId, { id: snap.id, ...snap.data() } as Project)
          emit()
          return
        }
      } catch {
        // Keep the original listener error for diagnostics.
      }

      console.error('subscribeProjectsByIds error:', error)
      onError?.(error)
    }),
  )

  return () => unsubs.forEach((unsub) => unsub())
}
