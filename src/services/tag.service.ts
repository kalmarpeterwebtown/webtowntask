import {
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  doc,
} from 'firebase/firestore'
import { tagsRef } from '@/utils/firestore'
import { storyRef } from '@/utils/firestore'
import type { Tag } from '@/types/models'

export async function createTag(
  orgId: string,
  projectId: string,
  name: string,
  color: string,
): Promise<string> {
  const ref = await addDoc(tagsRef(orgId, projectId), {
    name: name.trim(),
    color,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTag(
  orgId: string,
  projectId: string,
  tagId: string,
  data: Partial<Pick<Tag, 'name' | 'color'>>,
): Promise<void> {
  await updateDoc(doc(tagsRef(orgId, projectId), tagId), data)
}

export async function deleteTag(
  orgId: string,
  projectId: string,
  tagId: string,
): Promise<void> {
  await deleteDoc(doc(tagsRef(orgId, projectId), tagId))
}

export function subscribeToTags(
  orgId: string,
  projectId: string,
  callback: (tags: Tag[]) => void,
): () => void {
  return onSnapshot(tagsRef(orgId, projectId), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tag)))
  })
}

export async function addTagToStory(
  orgId: string,
  projectId: string,
  storyId: string,
  tagId: string,
): Promise<void> {
  await updateDoc(storyRef(orgId, projectId, storyId), {
    tagIds: arrayUnion(tagId),
  })
}

export async function removeTagFromStory(
  orgId: string,
  projectId: string,
  storyId: string,
  tagId: string,
): Promise<void> {
  await updateDoc(storyRef(orgId, projectId, storyId), {
    tagIds: arrayRemove(tagId),
  })
}
