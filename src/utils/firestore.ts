import { collection, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'

// Org-scoped collection path helpers
export const orgRef = (orgId: string) =>
  doc(db, 'organizations', orgId)

export const projectsRef = (orgId: string) =>
  collection(db, 'organizations', orgId, 'projects')

export const projectRef = (orgId: string, projectId: string) =>
  doc(db, 'organizations', orgId, 'projects', projectId)

export const projectMembersRef = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'memberships')

export const storiesRef = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'stories')

export const storyRef = (orgId: string, projectId: string, storyId: string) =>
  doc(db, 'organizations', orgId, 'projects', projectId, 'stories', storyId)

export const tasksRef = (orgId: string, projectId: string, storyId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'stories', storyId, 'tasks')

export const commentsRef = (orgId: string, projectId: string, storyId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'stories', storyId, 'comments')

export const worklogsRef = (orgId: string, projectId: string, storyId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'stories', storyId, 'worklogs')

export const attachmentsRef = (orgId: string, projectId: string, storyId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'stories', storyId, 'attachments')

export const tagsRef = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'tags')

export const topicsRef = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'topics')

export const dividersRef = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'dividers')

export const projectStatsRef = (orgId: string, projectId: string) =>
  doc(db, 'organizations', orgId, 'projects', projectId, 'stats', 'current')

export const activityLogsRef = (orgId: string, projectId: string) =>
  collection(db, 'organizations', orgId, 'projects', projectId, 'activityLogs')

export const teamsRef = (orgId: string) =>
  collection(db, 'organizations', orgId, 'teams')

export const teamRef = (orgId: string, teamId: string) =>
  doc(db, 'organizations', orgId, 'teams', teamId)

export const teamMembersRef = (orgId: string, teamId: string) =>
  collection(db, 'organizations', orgId, 'teams', teamId, 'memberships')

export const sprintsRef = (orgId: string, teamId: string) =>
  collection(db, 'organizations', orgId, 'teams', teamId, 'sprints')

export const sprintRef = (orgId: string, teamId: string, sprintId: string) =>
  doc(db, 'organizations', orgId, 'teams', teamId, 'sprints', sprintId)

export const invitationsRef = (orgId: string) =>
  collection(db, 'organizations', orgId, 'invitations')

export const userRef = (userId: string) =>
  doc(db, 'users', userId)

export const orgMembershipsRef = (userId: string) =>
  collection(db, 'users', userId, 'orgMemberships')

export const notificationsRef = (userId: string) =>
  collection(db, 'users', userId, 'notifications')
