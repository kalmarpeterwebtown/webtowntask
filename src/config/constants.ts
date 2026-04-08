export const APP_NAME = 'Agile Task Manager'
export const INVITATION_EXPIRY_DAYS = 7
export const MAX_FILE_SIZE_MB = 10
export const WORKLOG_MAX_PAST_DAYS = 30
export const DEFAULT_HOURS_PER_DAY = 8
export const NOTIFICATIONS_LIMIT = 20
export const STORIES_PER_PAGE = 50

export const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-600 bg-red-50',
  high:     'text-orange-600 bg-orange-50',
  medium:   'text-yellow-600 bg-yellow-50',
  low:      'text-gray-500 bg-gray-50',
}

export const STATUS_COLORS: Record<string, string> = {
  draft:       'bg-gray-100 text-gray-600',
  ready:       'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  review:      'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
  delivered:   'bg-emerald-100 text-emerald-700',
}

export const TYPE_COLORS: Record<string, string> = {
  feature:   'bg-blue-100 text-blue-700',
  bug:       'bg-red-100 text-red-700',
  tech_debt: 'bg-orange-100 text-orange-700',
  chore:     'bg-gray-100 text-gray-600',
}

export const ROUTES = {
  LOGIN:           '/login',
  REGISTER:        '/register',
  FORGOT_PASSWORD: '/forgot-password',
  INVITE:          '/invite',
  DASHBOARD:       '/',
  PROJECTS:        '/projects',
  PROJECT:         (id: string) => `/projects/${id}`,
  BACKLOG:         (id: string) => `/projects/${id}/backlog`,
  STORY:           (projectId: string, storyId: string) => `/projects/${projectId}/stories/${storyId}`,
  REPORTS:         (id: string) => `/projects/${id}/reports`,
  PROJECT_SETTINGS:(id: string) => `/projects/${id}/settings`,
  TEAMS:           '/teams',
  BOARD:           (id: string) => `/teams/${id}/board`,
  SPRINTS:         (id: string) => `/teams/${id}/sprints`,
  TEAM_SETTINGS:   (id: string) => `/teams/${id}/settings`,
  ORG_REPORTS:     '/reports',
  ORG_SETTINGS:    '/settings/organization',
  USERS:           '/settings/users',
  PLATFORM:        '/platform',
  PROFILE:         '/settings/profile',
  SETUP:           '/setup',
  CLIENT:          '/client',
  CLIENT_PROJECT:  (id: string) => `/client/projects/${id}`,
} as const
