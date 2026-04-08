import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Story, Team } from '@/types/models'

vi.mock('@/utils/fractionalIndex', () => ({
  compareFractionalKeys: (a: string | null | undefined, b: string | null | undefined) => {
    const left = a ?? ''
    const right = b ?? ''
    if (left < right) return -1
    if (left > right) return 1
    return 0
  },
  keyBetween: (a: string | null | undefined, b: string | null | undefined) => `${a ?? 'null'}>${b ?? 'null'}`,
}))

let helpers: typeof import('./backlogDnd')

beforeAll(async () => {
  helpers = await import('./backlogDnd')
})

function makeTeam(): Team {
  return {
    id: 'team-1',
    name: 'Alpha',
    connectedProjectIds: ['project-1'],
    boardConfig: {
      mode: 'kanban',
      columns: [
        { id: 'review', name: 'Review', order: 'a2', isDoneColumn: false },
        { id: 'todo', name: 'Teendo', order: 'a0', isDoneColumn: false },
        { id: 'doing', name: 'Doing', order: 'a1', isDoneColumn: false },
      ],
    },
    createdAt: {} as Team['createdAt'],
    updatedAt: {} as Team['updatedAt'],
    createdBy: 'user-1',
  }
}

function makeStory(overrides: Partial<Story>): Story {
  return {
    id: 'story-1',
    projectId: 'project-1',
    sequenceNumber: 1,
    title: 'Story',
    type: 'feature',
    priority: 'medium',
    status: 'draft',
    location: 'board',
    boardId: 'team-1',
    columnId: 'todo',
    columnOrder: 'a0',
    assigneeIds: [],
    assigneeNames: [],
    reporterId: 'user-1',
    reporterName: 'User',
    tagIds: [],
    linkedStoryIds: [],
    isBlocked: false,
    blockedByStoryIds: [],
    taskCount: 0,
    taskDoneCount: 0,
    commentCount: 0,
    totalWorklogMinutes: 0,
    createdAt: {} as Story['createdAt'],
    updatedAt: {} as Story['updatedAt'],
    createdBy: 'user-1',
    ...overrides,
  }
}

describe('backlogDnd helpers', () => {
  it('prioritizes linked board drop targets over overlapping story rows', () => {
    const selected = helpers.selectBacklogCollisionId([
      'story-row-1',
      `${helpers.BOARD_DROP_PREFIX}team-1`,
      `backlog${helpers.TOP_SECTION_DROP_SUFFIX}`,
    ], 'story')

    expect(selected).toBe(`${helpers.BOARD_DROP_PREFIX}team-1`)
  })

  it('sorts board columns and appends dropped story to the first column bottom', () => {
    const boardMetaById = helpers.buildBoardMetaById([makeTeam()])
    const moveTarget = helpers.getBoardMoveTarget([
      makeStory({ id: 's1', columnId: 'todo', columnOrder: 'a0' }),
      makeStory({ id: 's2', columnId: 'todo', columnOrder: 'a1' }),
      makeStory({ id: 's3', columnId: 'doing', columnOrder: 'a0' }),
    ], boardMetaById, 'team-1')

    expect(moveTarget).toEqual({
      teamId: 'team-1',
      columnId: 'todo',
      newOrder: 'a1>null',
    })
  })
})
