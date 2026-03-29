import {
  addDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth } from '@/config/firebase'
import { storyRef, tasksRef, worklogsRef } from '@/utils/firestore'
import type { Worklog } from '@/types/models'

export async function createWorklog(
  orgId: string,
  projectId: string,
  storyId: string,
  input: {
    minutes: number
    description?: string
    taskId?: string | null
  },
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Nincs bejelentkezett felhasználó')

  const now = new Date()
  const date = now.toISOString().slice(0, 10)

  const ref = await addDoc(worklogsRef(orgId, projectId, storyId), {
    projectId,
    storyId,
    taskId: input.taskId ?? null,
    userId: user.uid,
    userName: user.displayName ?? user.email ?? 'Felhasználó',
    minutes: input.minutes,
    date,
    description: input.description?.trim() ?? '',
    createdAt: serverTimestamp(),
  })

  if (input.taskId) {
    await updateDoc(doc(tasksRef(orgId, projectId, storyId), input.taskId), {
      totalWorklogMinutes: increment(input.minutes),
      updatedAt: serverTimestamp(),
    })
  }

  await updateDoc(storyRef(orgId, projectId, storyId), {
    totalWorklogMinutes: increment(input.minutes),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

export function subscribeToWorklogs(
  orgId: string,
  projectId: string,
  storyId: string,
  callback: (worklogs: Worklog[]) => void,
): () => void {
  const q = query(worklogsRef(orgId, projectId, storyId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((worklogDoc) => ({ id: worklogDoc.id, ...worklogDoc.data() } as Worklog)))
  })
}
