import { compareFractionalKeys, keyBetween } from '@/utils/fractionalIndex'
import type { BoardColumn, Story, Team } from '@/types/models'

export const TOP_SECTION_DROP_SUFFIX = '__top-drop'
export const BOARD_DROP_PREFIX = 'linked-board-drop:'

export type BoardMetaEntry = {
  team: Team
  columnMap: Map<string, BoardColumn>
}

export function buildBoardMetaById(linkedTeams: Team[]): Map<string, BoardMetaEntry> {
  const map = new Map<string, BoardMetaEntry>()
  linkedTeams.forEach((team) => {
    const sortedColumns = [...team.boardConfig.columns].sort((a, b) => compareFractionalKeys(a.order, b.order))
    map.set(team.id, {
      team: { ...team, boardConfig: { ...team.boardConfig, columns: sortedColumns } },
      columnMap: new Map(sortedColumns.map((column) => [column.id, column])),
    })
  })
  return map
}

export function selectBacklogCollisionId(
  ids: string[],
  activeType?: string,
): string | null {
  if (ids.length === 0) return null

  if (activeType !== 'tag') {
    const boardDropHit = ids.find((id) => id.startsWith(BOARD_DROP_PREFIX))
    if (boardDropHit) return boardDropHit
  }

  const storyHit = ids.find((id) => !id.endsWith(TOP_SECTION_DROP_SUFFIX) && !id.startsWith(BOARD_DROP_PREFIX))
  if (storyHit) return storyHit

  const topDropHit = ids.find((id) => id.endsWith(TOP_SECTION_DROP_SUFFIX))
  return topDropHit ?? ids[0] ?? null
}

export function getBoardMoveTarget(
  boardStories: Story[],
  boardMetaById: Map<string, BoardMetaEntry>,
  targetTeamId: string,
): { teamId: string; columnId: string; newOrder: string } | null {
  const targetTeam = boardMetaById.get(targetTeamId)?.team ?? null
  const firstColumn = targetTeam?.boardConfig.columns[0] ?? null
  if (!targetTeam || !firstColumn) return null

  const firstColumnStories = boardStories
    .filter((story) => story.boardId === targetTeam.id && story.columnId === firstColumn.id)
    .sort((a, b) => compareFractionalKeys(a.columnOrder, b.columnOrder))
  const lastOrder = firstColumnStories[firstColumnStories.length - 1]?.columnOrder ?? null

  return {
    teamId: targetTeam.id,
    columnId: firstColumn.id,
    newOrder: keyBetween(lastOrder, null),
  }
}
