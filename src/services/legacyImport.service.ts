import { createProject } from '@/services/project.service'
import { createStory, updateStory } from '@/services/story.service'
import { ksgaalEventPlatformImport, type LegacyImportStory } from '@/data/imports/ksgaalEventPlatform'
import type { StoryPriority, StoryStatus, StoryType } from '@/types/enums'

function parseEstimate(size: string): number | undefined {
  const trimmed = size.trim()
  if (!trimmed || trimmed === '?') return undefined
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

function mapPriority(priority: string): StoryPriority {
  switch (priority.trim().toLowerCase()) {
    case 'prio1':
      return 'high'
    case 'prio2':
      return 'medium'
    default:
      return 'medium'
  }
}

function mapType(typeOfPbi: string): StoryType {
  switch (typeOfPbi.trim().toLowerCase()) {
    case 'fix':
      return 'bug'
    case 'spike':
      return 'tech_debt'
    default:
      return 'feature'
  }
}

function mapStatus(story: LegacyImportStory): StoryStatus {
  if (story.location === 'planbox') return 'ready'
  if (story.state.toLowerCase().includes('sprintready')) return 'ready'
  return 'draft'
}

function buildDescription(story: LegacyImportStory) {
  const metadata = [
    `Legacy ID: ${story.legacyId}`,
    story.topic ? `Topic: ${story.topic}` : '',
    story.state ? `Legacy state: ${story.state}` : '',
    story.release ? `Release: ${story.release}` : '',
    story.budget ? `Budget: ${story.budget}` : '',
    story.assignedUsers.length > 0 ? `Legacy assignees: ${story.assignedUsers.join(', ')}` : '',
    story.tags.length > 0 ? `Legacy tags: ${story.tags.join(', ')}` : '',
    story.createdDate ? `Created in source: ${story.createdDate}` : '',
    story.dueDate ? `Due date in source: ${story.dueDate}` : '',
  ].filter(Boolean)

  const sections = [story.description.trim(), metadata.length > 0 ? `Legacy import metadata:\n${metadata.map((line) => `- ${line}`).join('\n')}` : '']
    .filter(Boolean)

  return sections.join('\n\n')
}

export async function importKsgaalEventPlatform(
  orgId: string,
  onProgress?: (completed: number, total: number, currentTitle: string) => void,
) {
  const projectId = await createProject(orgId, {
    name: ksgaalEventPlatformImport.projectName,
    prefix: ksgaalEventPlatformImport.projectPrefix,
    description: ksgaalEventPlatformImport.description,
  })

  const total = ksgaalEventPlatformImport.stories.length

  for (const [index, story] of ksgaalEventPlatformImport.stories.entries()) {
    onProgress?.(index, total, story.title)

    const storyId = await createStory(orgId, projectId, {
      title: story.title,
      description: buildDescription(story),
      type: mapType(story.typeOfPbi),
      priority: mapPriority(story.priority),
      location: story.location,
      estimate: parseEstimate(story.size),
    })

    await updateStory(orgId, projectId, storyId, {
      status: mapStatus(story),
    })
  }

  onProgress?.(total, total, 'Kész')

  return {
    projectId,
    importedStories: total,
  }
}
