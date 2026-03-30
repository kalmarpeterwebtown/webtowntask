import { FileText, FolderKanban, Users } from 'lucide-react'
import type { Project, Story, Team } from '@/types/models'

export type SearchResult =
  | { id: string; type: 'project'; title: string; subtitle: string; to: string; icon: typeof FolderKanban }
  | { id: string; type: 'team'; title: string; subtitle: string; to: string; icon: typeof Users }
  | { id: string; type: 'story'; title: string; subtitle: string; to: string; icon: typeof FileText }

export function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function createProjectResults(projects: Project[]): SearchResult[] {
  return projects.map((project) => ({
    id: `project-${project.id}`,
    type: 'project',
    title: project.name,
    subtitle: `${project.prefix}${project.description ? ` · ${project.description}` : ''}`,
    to: `/projects/${project.id}`,
    icon: FolderKanban,
  }))
}

export function createTeamResults(teams: Team[]): SearchResult[] {
  return teams.map((team) => ({
    id: `team-${team.id}`,
    type: 'team',
    title: team.name,
    subtitle: team.description || 'Csapat board és sprint nézet',
    to: `/teams/${team.id}/board`,
    icon: Users,
  }))
}

export function createStoryResults(stories: Story[], projectsById: Record<string, Project>): SearchResult[] {
  return stories.map((story) => {
    const project = projectsById[story.projectId]
    const storyCode = project ? `${project.prefix}-${story.sequenceNumber}` : story.id
    const assigneeText = story.assigneeNames.length > 0 ? ` · ${story.assigneeNames.join(', ')}` : ''
    return {
      id: `story-${story.id}`,
      type: 'story',
      title: story.title,
      subtitle: `${storyCode}${assigneeText}${story.description ? ` · ${story.description}` : ''}`,
      to: `/projects/${story.projectId}/stories/${story.id}`,
      icon: FileText,
    }
  })
}

export function filterSearchResults(
  normalizedQuery: string,
  projectResults: SearchResult[],
  teamResults: SearchResult[],
  storyResults: SearchResult[],
) {
  const allResults = [...projectResults, ...teamResults, ...storyResults]
  if (!normalizedQuery) {
    return {
      projects: projectResults.slice(0, 4),
      teams: teamResults.slice(0, 4),
      stories: storyResults.slice(0, 6),
    }
  }

  const matches = allResults.filter((result) =>
    normalizeSearchValue(`${result.title} ${result.subtitle}`).includes(normalizedQuery),
  )

  return {
    projects: matches.filter((result) => result.type === 'project').slice(0, 5),
    teams: matches.filter((result) => result.type === 'team').slice(0, 5),
    stories: matches.filter((result) => result.type === 'story').slice(0, 8),
  }
}
