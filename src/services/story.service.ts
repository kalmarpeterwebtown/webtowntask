import {
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  increment,
  runTransaction,
  writeBatch,
} from 'firebase/firestore'
import { deleteObject, ref as storageRef } from 'firebase/storage'
import { db, auth } from '@/config/firebase'
import { storage } from '@/config/firebase'
import { attachmentsRef, commentsRef, projectRef, storyRef, storiesRef, tasksRef, worklogsRef } from '@/utils/firestore'
import { initialKey, keyAfter } from '@/utils/fractionalIndex'
import type { Attachment } from '@/types/models'
import type { Story } from '@/types/models'
import type { StoryType, StoryPriority, StoryLocation } from '@/types/enums'

export type CreateStoryInput = {
  title: string
  type: StoryType
  priority: StoryPriority
  location: StoryLocation
  description?: string
  estimate?: number
  dueDate?: Date
  /** Ha van, ehhez a sorhoz képest kerül a listába (mögé). Undefined = lista elejére. */
  afterOrder?: string
  /** Board-ra való közvetlen létrehozáshoz */
  boardId?: string
  columnId?: string
  columnOrder?: string
}

/**
 * Létrehoz egy új story-t.
 * A sequenceNumber-t atomikusan növeli a projekt doc-on.
 */
export async function createStory(
  orgId: string,
  projectId: string,
  input: CreateStoryInput,
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Nincs bejelentkezett felhasználó')

  const projRef = projectRef(orgId, projectId)
  const newStoryRef = doc(storiesRef(orgId, projectId))

  // Fractional index az új story-hoz
  const order = input.afterOrder
    ? keyAfter(input.afterOrder)
    : initialKey()

  await runTransaction(db, async (tx) => {
    const projSnap = await tx.get(projRef)
    if (!projSnap.exists()) throw new Error('Projekt nem található')

    const seq: number = (projSnap.data().nextSequenceNumber as number) ?? 1

    tx.set(newStoryRef, {
      projectId,
      sequenceNumber: seq,
      title: input.title,
      description: input.description ?? '',
      type: input.type,
      priority: input.priority,
      status: 'draft',
      location: input.location,
      backlogOrder: input.location === 'backlog' ? order : null,
      planboxOrder: input.location === 'planbox' ? order : null,
      boardId: input.boardId ?? null,
      columnId: input.columnId ?? null,
      columnOrder: input.columnOrder ?? null,
      assigneeIds: [],
      assigneeNames: [],
      reporterId: user.uid,
      reporterName: user.displayName ?? user.email ?? 'Ismeretlen',
      estimate: input.estimate ?? null,
      estimateType: null,
      dueDate: input.dueDate ?? null,
      tagIds: [],
      topicId: null,
      sprintId: null,
      linkedStoryIds: [],
      isBlocked: false,
      blockedByStoryIds: [],
      taskCount: 0,
      taskDoneCount: 0,
      commentCount: 0,
      totalWorklogMinutes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
    })

    tx.update(projRef, {
      nextSequenceNumber: increment(1),
      storyCount: increment(1),
      updatedAt: serverTimestamp(),
    })
  })

  return newStoryRef.id
}

/**
 * Move a story to a specific board column.
 */
export async function moveStoryToBoard(
  orgId: string,
  projectId: string,
  storyId: string,
  teamId: string,
  columnId: string,
  columnOrder: string,
): Promise<void> {
  await updateDoc(storyRef(orgId, projectId, storyId), {
    location: 'board',
    boardId: teamId,
    columnId,
    columnOrder,
    backlogOrder: null,
    planboxOrder: null,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Move a story off the board back to backlog or planbox.
 */
export async function moveStoryOffBoard(
  orgId: string,
  projectId: string,
  storyId: string,
  newLocation: 'backlog' | 'planbox',
  newOrder: string,
): Promise<void> {
  const orderField = newLocation === 'backlog' ? 'backlogOrder' : 'planboxOrder'
  await updateDoc(storyRef(orgId, projectId, storyId), {
    location: newLocation,
    boardId: null,
    columnId: null,
    columnOrder: null,
    [orderField]: newOrder,
    updatedAt: serverTimestamp(),
  })
}

type UpdateStoryInput = Partial<Pick<Story,
  'title' | 'description' | 'type' | 'priority' | 'status' |
  'tagIds' | 'topicId' | 'sprintId' | 'assigneeIds' | 'assigneeNames'
>> & {
  estimate?: number | null
  dueDate?: Story['dueDate'] | null
}

export async function updateStory(
  orgId: string,
  projectId: string,
  storyId: string,
  data: UpdateStoryInput,
): Promise<void> {
  await updateDoc(storyRef(orgId, projectId, storyId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteStory(
  orgId: string,
  projectId: string,
  storyId: string,
): Promise<void> {
  const [taskSnap, commentSnap, worklogSnap, attachmentSnap] = await Promise.all([
    getDocs(tasksRef(orgId, projectId, storyId)),
    getDocs(commentsRef(orgId, projectId, storyId)),
    getDocs(worklogsRef(orgId, projectId, storyId)),
    getDocs(attachmentsRef(orgId, projectId, storyId)),
  ])

  const attachments = attachmentSnap.docs.map((attachmentDoc) => ({
    id: attachmentDoc.id,
    ...attachmentDoc.data(),
  } as Attachment))

  await Promise.allSettled(
    attachments
      .filter((attachment) => Boolean(attachment.storageUrl))
      .map((attachment) => deleteObject(storageRef(storage, attachment.storageUrl))),
  )

  const batch = writeBatch(db)
  taskSnap.docs.forEach((taskDoc) => batch.delete(taskDoc.ref))
  commentSnap.docs.forEach((commentDoc) => batch.delete(commentDoc.ref))
  worklogSnap.docs.forEach((worklogDoc) => batch.delete(worklogDoc.ref))
  attachmentSnap.docs.forEach((attachmentDoc) => batch.delete(attachmentDoc.ref))
  await batch.commit()

  await runTransaction(db, async (tx) => {
    tx.delete(storyRef(orgId, projectId, storyId))
    tx.update(projectRef(orgId, projectId), {
      storyCount: increment(-1),
      updatedAt: serverTimestamp(),
    })
  })
}

/**
 * Story áthelyezése másik szekcióba vagy máshova a listán belül.
 * Egyetlen Firestore write.
 */
export async function moveStory(
  orgId: string,
  projectId: string,
  storyId: string,
  newLocation: StoryLocation,
  newOrder: string,
): Promise<void> {
  await updateDoc(storyRef(orgId, projectId, storyId), {
    location: newLocation,
    backlogOrder: newLocation === 'backlog' ? newOrder : null,
    planboxOrder: newLocation === 'planbox' ? newOrder : null,
    columnOrder: null,
    boardId: null,
    columnId: null,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Backlog realtime subscription — returns all project stories.
 * Sorting is done client-side to avoid composite index requirements.
 */
export function subscribeToBacklog(
  orgId: string,
  projectId: string,
  callback: (stories: Story[]) => void,
): () => void {
  const q = query(
    storiesRef(orgId, projectId),
    orderBy('createdAt'),
  )

  return onSnapshot(q, (snap) => {
    const stories = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story))
    callback(stories)
  }, (err) => {
    console.error('subscribeToBacklog error:', err)
    callback([])
  })
}

export function subscribeToStory(
  orgId: string,
  projectId: string,
  storyId: string,
  callback: (story: Story | null) => void,
): () => void {
  return onSnapshot(storyRef(orgId, projectId, storyId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Story) : null)
  })
}
