import { type Locator, type Page } from '@playwright/test'

const DRAG_STEPS = 15

export function getSection(page: Page, location: 'backlog' | 'planbox' | 'board'): Locator {
  return page.locator(`[data-testid="backlog-section-${location}"]`)
}

export function getSectionStories(page: Page, location: 'backlog' | 'planbox' | 'board'): Locator {
  return getSection(page, location).locator('[data-testid^="backlog-story-"]')
}

export function getSectionTopDropZone(page: Page, location: 'backlog' | 'planbox' | 'board'): Locator {
  return page.locator(`[data-testid="backlog-top-drop-${location}"]`)
}

export function getLinkedBoardDropTarget(page: Page, teamId: string): Locator {
  return page.locator(`[data-testid="linked-board-drop-${teamId}"]`)
}

export function getStoryRowByTitle(page: Page, title: string): Locator {
  return page.locator(`[data-story-title="${title}"]`)
}

export function getStoryHandleByTitle(page: Page, title: string): Locator {
  return getStoryRowByTitle(page, title).locator('[data-testid^="story-drag-handle-"]').first()
}

export async function getStoryTitlesInSection(
  page: Page,
  location: 'backlog' | 'planbox' | 'board',
): Promise<string[]> {
  const stories = getSectionStories(page, location)
  const count = await stories.count()
  const titles: string[] = []
  for (let i = 0; i < count; i++) {
    const title = await stories.nth(i).getAttribute('data-story-title')
    if (title) titles.push(title)
  }
  return titles
}

export async function dragElement(
  page: Page,
  source: Locator,
  target: Locator,
  options?: { steps?: number; offsetX?: number; offsetY?: number },
): Promise<void> {
  const steps = options?.steps ?? DRAG_STEPS
  const offsetX = options?.offsetX ?? 0
  const offsetY = options?.offsetY ?? 0

  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) {
    throw new Error('Could not get bounding box for source or target element')
  }

  const sx = sourceBox.x + sourceBox.width / 2
  const sy = sourceBox.y + sourceBox.height / 2
  const tx = targetBox.x + targetBox.width / 2 + offsetX
  const ty = targetBox.y + targetBox.height / 2 + offsetY

  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(tx, ty, { steps })
  await page.mouse.move(tx + 2, ty + 2, { steps: 2 })
  await page.mouse.move(tx, ty, { steps: 2 })
  await page.waitForTimeout(200)
  await page.mouse.up()
  await page.waitForTimeout(500)
}

export async function dragStoryOntoStory(
  page: Page,
  sourceTitle: string,
  targetTitle: string,
): Promise<void> {
  await getStoryRowByTitle(page, sourceTitle).scrollIntoViewIfNeeded()
  await targetRowSection(page, targetTitle)?.evaluate((element) => element.scrollIntoView({ block: 'start' }))
  const sourceHandle = getStoryRowByTitle(page, sourceTitle)
  const targetRow = getStoryRowByTitle(page, targetTitle)
  await dragElement(page, sourceHandle, targetRow)
}

export async function dragStoryToTopOfSection(
  page: Page,
  sourceTitle: string,
  location: 'backlog' | 'planbox' | 'board',
): Promise<void> {
  await getSection(page, location).evaluate((element) => element.scrollIntoView({ block: 'start' }))
  const sourceHandle = getStoryRowByTitle(page, sourceTitle)
  const target = getSectionTopDropZone(page, location)
  await dragElement(page, sourceHandle, target, { steps: 30 })
}

export async function dragStoryToLinkedBoard(
  page: Page,
  sourceTitle: string,
  teamId: string,
): Promise<void> {
  const target = getLinkedBoardDropTarget(page, teamId)
  await getStoryRowByTitle(page, sourceTitle).scrollIntoViewIfNeeded()
  const sourceHandle = getStoryRowByTitle(page, sourceTitle)
  await dragElement(page, sourceHandle, target, { steps: 30 })
}

function targetRowSection(page: Page, title: string): Locator | null {
  const row = getStoryRowByTitle(page, title)
  return row.locator('xpath=ancestor::*[@data-testid][starts-with(@data-testid, "backlog-section-")]').first()
}

export async function waitForBacklogLoaded(page: Page): Promise<void> {
  await getSection(page, 'backlog').waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(1000)
}
