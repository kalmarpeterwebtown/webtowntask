import type { Timestamp } from 'firebase/firestore'
import type {
  OrgRole, AccessLevel, ProjectRole, StoryType, StoryPriority,
  StoryStatus, StoryLocation, EstimateType, BoardMode, SprintStatus,
  ActivityAction, NotificationType, InvitationStatus, ProjectStatus,
} from './enums'

export interface Organization {
  id: string
  name: string
  slug: string
  logoUrl?: string
  settings: {
    defaultEstimateType: EstimateType
    hoursPerDay: number
    clientCommentingEnabled: boolean
    estimateRequiredForPlanbox: boolean
  }
  plan: 'free' | 'pro' | 'enterprise'
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}

export interface User {
  id: string
  email: string
  displayName: string
  photoUrl?: string
  currentOrgId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface OrgMembership {
  id: string // orgId
  orgName: string
  role: OrgRole
  joinedAt: Timestamp
}

export interface Project {
  id: string
  name: string
  description?: string
  prefix: string
  status: ProjectStatus
  connectedTeamIds: string[]
  storyCount: number
  nextSequenceNumber: number
  settings: {
    storyTypes: StoryType[]
    priorities: StoryPriority[]
  }
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}

export interface ProjectMembership {
  id: string // userId
  displayName: string
  email: string
  photoUrl?: string
  access: AccessLevel
  role: ProjectRole
  joinedAt: Timestamp
}

export interface BoardColumn {
  id: string
  name: string
  order: string
  wipLimit?: number
  color?: string
  isDoneColumn: boolean
}

export interface Team {
  id: string
  name: string
  description?: string
  connectedProjectIds: string[]
  boardConfig: {
    mode: BoardMode
    columns: BoardColumn[]
  }
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}

export interface TeamMembership {
  id: string // userId
  displayName: string
  email: string
  photoUrl?: string
  access: AccessLevel
  joinedAt: Timestamp
}

export interface Story {
  id: string
  projectId: string
  sequenceNumber: number
  title: string
  description?: string
  type: StoryType
  priority: StoryPriority
  status: StoryStatus
  location: StoryLocation
  backlogOrder?: string
  planboxOrder?: string
  boardId?: string
  columnId?: string
  columnOrder?: string
  assigneeIds: string[]
  assigneeNames: string[]
  reporterId: string
  reporterName: string
  estimate?: number
  estimateType?: EstimateType
  dueDate?: Timestamp
  tagIds: string[]
  topicId?: string
  sprintId?: string
  linkedStoryIds: string[]
  isBlocked: boolean
  blockedByStoryIds: string[]
  taskCount: number
  taskDoneCount: number
  commentCount: number
  totalWorklogMinutes: number
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}

export interface Task {
  id: string
  projectId?: string
  storyId: string
  title: string
  description?: string
  isDone: boolean
  assigneeId?: string
  assigneeName?: string
  estimate?: number
  dueDate?: Timestamp
  order: string
  totalWorklogMinutes: number
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}

export interface Comment {
  id: string
  storyId: string
  parentCommentId?: string
  authorId: string
  authorName: string
  authorPhotoUrl?: string
  body: string
  mentions: string[]
  isEdited: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Attachment {
  id: string
  storyId: string
  taskId?: string
  fileName: string
  fileSize: number
  mimeType: string
  storageUrl: string
  uploadedBy: string
  uploadedByName: string
  createdAt: Timestamp
}

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: Timestamp
}

export interface Topic {
  id: string
  name: string
  description?: string
  color?: string
  order: number
  createdAt: Timestamp
}

export interface Sprint {
  id: string
  teamId: string
  name: string
  goal?: string
  status: SprintStatus
  startDate: Timestamp
  endDate: Timestamp
  completedAt?: Timestamp
  stats: {
    totalStories: number
    completedStories: number
    totalPoints: number
    completedPoints: number
    addedAfterStart: number
    removedDuringSprint: number
  }
  createdAt: Timestamp
  createdBy: string
}

export interface DailySnapshot {
  id: string // YYYY-MM-DD
  remainingPoints: number
  completedPoints: number
  addedPoints: number
  removedPoints: number
  totalStories: number
  completedStories: number
  snapshotAt: Timestamp
}

export interface Worklog {
  id: string
  projectId: string
  storyId: string
  taskId?: string
  userId: string
  userName: string
  minutes: number
  date: string // YYYY-MM-DD
  description?: string
  createdAt: Timestamp
}

export interface ActivityLog {
  id: string
  entityType: 'story' | 'task' | 'sprint' | 'project' | 'team'
  entityId: string
  action: ActivityAction
  actorId: string
  actorName: string
  changes?: Array<{ field: string; oldValue: unknown; newValue: unknown }>
  projectId: string
  createdAt: Timestamp
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  orgId?: string
  entityType: 'story' | 'task' | 'sprint' | 'project'
  entityId: string
  projectId?: string
  isRead: boolean
  actorId: string
  actorName: string
  createdAt: Timestamp
}

export interface Invitation {
  id: string
  email: string
  orgId: string
  orgName: string
  projectId?: string
  teamId?: string
  orgRole: 'standard' | 'client'
  projectAccess?: AccessLevel
  teamAccess?: AccessLevel
  projectRole?: ProjectRole
  token: string
  status: InvitationStatus
  invitedBy: string
  invitedByName: string
  expiresAt: Timestamp
  createdAt: Timestamp
}

export interface ProjectStats {
  totalStories: number
  storiesByStatus: Record<string, number>
  storiesByPriority: Record<string, number>
  storiesByType: Record<string, number>
  totalPoints: number
  completedPoints: number
  totalWorklogMinutes: number
  updatedAt: Timestamp
}

export interface Divider {
  id: string
  title: string
  backlogOrder: string
  color?: string
  createdAt: Timestamp
  createdBy: string
}

export interface SavedFilter {
  id: string
  name: string
  scope: 'project' | 'global'
  projectId?: string
  filters: {
    assigneeIds?: string[]
    statuses?: StoryStatus[]
    priorities?: StoryPriority[]
    types?: StoryType[]
    tagIds?: string[]
    topicId?: string
    sprintId?: string
    dateFrom?: string
    dateTo?: string
    searchText?: string
  }
  createdBy: string
  createdAt: Timestamp
}
