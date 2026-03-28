export type OrgRole = 'owner' | 'admin' | 'standard' | 'client'
export type AccessLevel = 'read' | 'write' | 'manage'
export type ProjectRole = 'po' | 'developer' | 'client' | 'stakeholder'

export type StoryType = 'feature' | 'bug' | 'tech_debt' | 'chore'
export type StoryPriority = 'critical' | 'high' | 'medium' | 'low'
export type StoryStatus = 'draft' | 'ready' | 'in_progress' | 'review' | 'done' | 'delivered'
export type StoryLocation = 'backlog' | 'planbox' | 'board'

export type EstimateType = 'points' | 'tshirt' | 'hours'
export type BoardMode = 'kanban' | 'scrum'
export type SprintStatus = 'planning' | 'active' | 'completed'

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'moved'
  | 'assigned'
  | 'commented'
  | 'status_changed'

export type NotificationType =
  | 'assigned'
  | 'unassigned'
  | 'commented'
  | 'mentioned'
  | 'status_changed'
  | 'sprint_started'
  | 'sprint_finished'
  | 'invited'

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'
export type ProjectStatus = 'active' | 'archived'
