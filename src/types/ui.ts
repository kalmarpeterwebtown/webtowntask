export type ModalType =
  | 'story-create'
  | 'story-edit'
  | 'worklog-add'
  | 'sprint-start'
  | 'sprint-finish'
  | 'invite-user'
  | 'confirm'
  | null

export interface ModalState {
  type: ModalType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export interface FilterState {
  assigneeIds: string[]
  statuses: string[]
  priorities: string[]
  types: string[]
  tagIds: string[]
  topicId: string | null
  sprintId: string | null
  searchText: string
}

export const defaultFilter: FilterState = {
  assigneeIds: [],
  statuses: [],
  priorities: [],
  types: [],
  tagIds: [],
  topicId: null,
  sprintId: null,
  searchText: '',
}
