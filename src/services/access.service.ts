import {
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import {
  projectMemberRef,
  projectMembersRef,
  teamMemberRef,
  teamMembersRef,
} from '@/utils/firestore'
import type {
  ProjectMembership,
  TeamMembership,
} from '@/types/models'
import type {
  AccessLevel,
  ProjectRole,
} from '@/types/enums'

type MemberIdentity = {
  id: string
  displayName: string
  email: string
  photoUrl?: string
}

export function subscribeToProjectMemberships(
  orgId: string,
  projectId: string,
  callback: (memberships: ProjectMembership[]) => void,
): () => void {
  return onSnapshot(projectMembersRef(orgId, projectId), (snap) => {
    callback(
      snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as ProjectMembership))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'hu')),
    )
  })
}

export function subscribeToTeamMemberships(
  orgId: string,
  teamId: string,
  callback: (memberships: TeamMembership[]) => void,
): () => void {
  return onSnapshot(teamMembersRef(orgId, teamId), (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TeamMembership)))
  })
}

export async function setProjectMembership(
  orgId: string,
  projectId: string,
  member: MemberIdentity,
  access: AccessLevel,
  role: ProjectRole,
): Promise<void> {
  await setDoc(projectMemberRef(orgId, projectId, member.id), {
    userId: member.id,
    displayName: member.displayName,
    email: member.email,
    photoUrl: member.photoUrl ?? null,
    access,
    role,
    joinedAt: serverTimestamp(),
  }, { merge: true })
}

export async function removeProjectMembership(
  orgId: string,
  projectId: string,
  userId: string,
): Promise<void> {
  await deleteDoc(projectMemberRef(orgId, projectId, userId))
}

export async function setTeamMembership(
  orgId: string,
  teamId: string,
  member: MemberIdentity,
  access: AccessLevel,
): Promise<void> {
  await setDoc(teamMemberRef(orgId, teamId, member.id), {
    userId: member.id,
    displayName: member.displayName,
    email: member.email,
    photoUrl: member.photoUrl ?? null,
    access,
    joinedAt: serverTimestamp(),
  }, { merge: true })
}

export async function removeTeamMembership(
  orgId: string,
  teamId: string,
  userId: string,
): Promise<void> {
  await deleteDoc(teamMemberRef(orgId, teamId, userId))
}
