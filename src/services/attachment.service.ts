import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, storage } from '@/config/firebase'
import { attachmentsRef } from '@/utils/firestore'
import type { Attachment } from '@/types/models'

export async function uploadStoryAttachment(
  orgId: string,
  projectId: string,
  storyId: string,
  file: File,
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Nincs bejelentkezett felhasználó')

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `organizations/${orgId}/projects/${projectId}/stories/${storyId}/${Date.now()}-${safeName}`
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, file)
  const storageUrl = await getDownloadURL(storageRef)

  const attachmentRef = await addDoc(attachmentsRef(orgId, projectId, storyId), {
    storyId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    storageUrl,
    uploadedBy: user.uid,
    uploadedByName: user.displayName ?? user.email ?? 'Felhasználó',
    createdAt: serverTimestamp(),
  })

  return attachmentRef.id
}

export async function deleteStoryAttachment(
  orgId: string,
  projectId: string,
  storyId: string,
  attachmentId: string,
): Promise<void> {
  await deleteDoc(doc(attachmentsRef(orgId, projectId, storyId), attachmentId))
}

export function subscribeToAttachments(
  orgId: string,
  projectId: string,
  storyId: string,
  callback: (attachments: Attachment[]) => void,
): () => void {
  const q = query(attachmentsRef(orgId, projectId, storyId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((attachmentDoc) => ({ id: attachmentDoc.id, ...attachmentDoc.data() } as Attachment)))
  })
}
