import {
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { auth } from '@/config/firebase'
import { commentsRef } from '@/utils/firestore'
import type { Comment } from '@/types/models'

export async function createComment(
  orgId: string,
  projectId: string,
  storyId: string,
  body: string,
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Nincs bejelentkezett felhasználó')

  const ref = await addDoc(commentsRef(orgId, projectId, storyId), {
    storyId,
    parentCommentId: null,
    authorId: user.uid,
    authorName: user.displayName ?? user.email ?? 'Ismeretlen',
    authorPhotoUrl: user.photoURL ?? null,
    body,
    mentions: [],
    isEdited: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

export function subscribeToComments(
  orgId: string,
  projectId: string,
  storyId: string,
  callback: (comments: Comment[]) => void,
): () => void {
  const q = query(commentsRef(orgId, projectId, storyId), orderBy('createdAt'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)))
  })
}
