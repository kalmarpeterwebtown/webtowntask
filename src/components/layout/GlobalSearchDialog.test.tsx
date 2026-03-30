import { describe, expect, it } from 'vitest'
import {
  createProjectResults,
  createStoryResults,
  createTeamResults,
  filterSearchResults,
  normalizeSearchValue,
} from '@/utils/search'
import type { Project, Story, Team } from '@/types/models'

describe('GlobalSearchDialog helpers', () => {
  it('normalizes case and Hungarian diacritics for search', () => {
    expect(normalizeSearchValue('Áttekintő Kereső')).toBe('attekinto kereso')
  })

  it('builds searchable result groups for projects, teams and stories', () => {
    const projects = [
      {
        id: 'project-1',
        name: 'Event Platform',
        prefix: 'EP',
        description: 'Konferencia backlog',
      },
    ] as Project[]
    const teams = [
      {
        id: 'team-1',
        name: 'Frontend Team',
        description: 'Board a webes csapatnak',
      },
    ] as Team[]
    const stories = [
      {
        id: 'story-1',
        projectId: 'project-1',
        title: 'API kereső finomhangolás',
        description: 'Gyors találatok és navigáció',
        sequenceNumber: 14,
        assigneeNames: ['Dev One'],
      },
    ] as Story[]

    const projectResults = createProjectResults(projects)
    const teamResults = createTeamResults(teams)
    const storyResults = createStoryResults(stories, { 'project-1': projects[0] })

    expect(projectResults[0]).toMatchObject({
      title: 'Event Platform',
      subtitle: 'EP · Konferencia backlog',
      to: '/projects/project-1',
    })
    expect(teamResults[0]).toMatchObject({
      title: 'Frontend Team',
      to: '/teams/team-1/board',
    })
    expect(storyResults[0]).toMatchObject({
      title: 'API kereső finomhangolás',
      subtitle: 'EP-14 · Dev One · Gyors találatok és navigáció',
      to: '/projects/project-1/stories/story-1',
    })
  })

  it('filters results across groups using free text query', () => {
    const projectResults = createProjectResults([
      {
        id: 'project-1',
        name: 'Event Platform',
        prefix: 'EP',
        description: 'Konferencia backlog',
      },
    ] as Project[])
    const teamResults = createTeamResults([
      {
        id: 'team-1',
        name: 'Frontend Team',
        description: 'Board a webes csapatnak',
      },
    ] as Team[])
    const storyResults = createStoryResults(
      [
        {
          id: 'story-1',
          projectId: 'project-1',
          title: 'API kereső finomhangolás',
          description: 'Gyors találatok és navigáció',
          sequenceNumber: 14,
          assigneeNames: ['Dev One'],
        },
      ] as Story[],
      {
        'project-1': {
          id: 'project-1',
          name: 'Event Platform',
          prefix: 'EP',
        } as Project,
      },
    )

    const filtered = filterSearchResults(
      normalizeSearchValue('finomhangolás'),
      projectResults,
      teamResults,
      storyResults,
    )

    expect(filtered.projects).toHaveLength(0)
    expect(filtered.teams).toHaveLength(0)
    expect(filtered.stories).toHaveLength(1)
    expect(filtered.stories[0]?.title).toBe('API kereső finomhangolás')
  })
})
