import {
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { auth } from '@/config/firebase'
import { tasksRef } from '@/utils/firestore'
import { initialKey, keyAfter } from '@/utils/fractionalIndex'
import type { Task } from '@/types/models'

export async function createTask(
  orgId: string,
  projectId: string,
  storyId: string,
  title: string,
  afterOrder?: string,
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Nincs bejelentkezett felhasználó')

  const order = afterOrder ? keyAfter(afterOrder) : initialKey()

  const ref = await addDoc(tasksRef(orgId, projectId, storyId), {
    projectId,
    storyId,
    title,
    description: '',
    isDone: false,
    assigneeId: null,
    assigneeName: null,
    estimate: null,
    dueDate: null,
    order,
    totalWorklogMinutes: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid,
  })

  return ref.id
}

export async function toggleTask(
  orgId: string,
  projectId: string,
  storyId: string,
  taskId: string,
  isDone: boolean,
): Promise<void> {
  await updateDoc(doc(tasksRef(orgId, projectId, storyId), taskId), {
    isDone,
    updatedAt: serverTimestamp(),
  })
}

export async function updateTaskTitle(
  orgId: string,
  projectId: string,
  storyId: string,
  taskId: string,
  title: string,
): Promise<void> {
  await updateDoc(doc(tasksRef(orgId, projectId, storyId), taskId), {
    title,
    updatedAt: serverTimestamp(),
  })
}

export async function updateTaskDescription(
  orgId: string,
  projectId: string,
  storyId: string,
  taskId: string,
  description: string,
): Promise<void> {
  await updateDoc(doc(tasksRef(orgId, projectId, storyId), taskId), {
    description,
    updatedAt: serverTimestamp(),
  })
}

export async function updateTaskAssignee(
  orgId: string,
  projectId: string,
  storyId: string,
  taskId: string,
  assignee: { id: string; name: string } | null,
): Promise<void> {
  await updateDoc(doc(tasksRef(orgId, projectId, storyId), taskId), {
    assigneeId: assignee?.id ?? null,
    assigneeName: assignee?.name ?? null,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTask(
  orgId: string,
  projectId: string,
  storyId: string,
  taskId: string,
): Promise<void> {
  await deleteDoc(doc(tasksRef(orgId, projectId, storyId), taskId))
}

export function subscribeToTasks(
  orgId: string,
  projectId: string,
  storyId: string,
  callback: (tasks: Task[]) => void,
): () => void {
  const q = query(tasksRef(orgId, projectId, storyId), orderBy('order'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)))
  })
}
