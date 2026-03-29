import {
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { notificationRef, notificationsRef } from '@/utils/firestore'
import type { Notification, ProjectMembership } from '@/types/models'

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
): () => void {
  const q = query(notificationsRef(userId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Notification)))
  })
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  await updateDoc(notificationRef(userId, notificationId), {
    isRead: true,
  })
}

export async function markAllNotificationsAsRead(userId: string, notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return
  const batch = writeBatch(db)
  notificationIds.forEach((notificationId) => {
    batch.update(notificationRef(userId, notificationId), { isRead: true })
  })
  await batch.commit()
}

export function extractMentionedMembers(body: string, members: ProjectMembership[]) {
  const mentionTokens = Array.from(body.matchAll(/@([^\s@]+)/g)).map((match) => match[1]?.toLowerCase() ?? '')

  if (mentionTokens.length === 0) return []

  return members.filter((member) => {
    const normalizedName = member.displayName.toLowerCase().replace(/\s+/g, '')
    const normalizedEmail = member.email.toLowerCase()
    return mentionTokens.some((token) =>
      normalizedName.includes(token) ||
      normalizedEmail.includes(token),
    )
  })
}

export async function notifyMentionedUsers(params: {
  orgId: string
  projectId: string
  storyId: string
  actorId: string
  actorName: string
  body: string
  members: ProjectMembership[]
}): Promise<void> {
  const mentionedMembers = extractMentionedMembers(params.body, params.members)
    .filter((member) => member.id !== params.actorId)

  await Promise.all(mentionedMembers.map((member) =>
    addDoc(notificationsRef(member.id), {
      type: 'mentioned',
      title: 'Megemlítettek egy kommentben',
      body: `${params.actorName}: ${params.body}`,
      orgId: params.orgId,
      entityType: 'story',
      entityId: params.storyId,
      projectId: params.projectId,
      isRead: false,
      actorId: params.actorId,
      actorName: params.actorName,
      createdAt: serverTimestamp(),
    }),
  ))
}
