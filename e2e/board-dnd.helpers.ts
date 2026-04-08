import { type Page, type Locator, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Activation distance for PointerSensor is 5px — we need more than that */
const DRAG_STEPS = 15

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Get a board column by its display name (e.g. "Teendo", "Folyamatban") */
export function getColumn(page: Page, columnName: string): Locator {
  return page.locator(`[data-column-name="${columnName}"]`)
}

/** Get the droppable body area of a column */
export function getColumnBody(page: Page, columnName: string): Locator {
  return getColumn(page, columnName).locator('.space-y-2').first()
}

/** Get the explicit top drop zone of a column */
export function getColumnTopDropZone(page: Page, columnName: string): Locator {
  return getColumn(page, columnName).locator('[data-testid^="column-top-drop-"]').first()
}

/** Get all story cards within a column, in DOM order */
export function getColumnCards(page: Page, columnName: string): Locator {
  return getColumn(page, columnName).locator('[data-testid^="story-card-"]')
}

/** Get a specific story card by its title text */
export function getCardByTitle(page: Page, title: string): Locator {
  return page.locator(`[data-story-title="${title}"]`)
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

/** Returns the ordered array of story card titles within a column */
export async function getCardTitlesInColumn(page: Page, columnName: string): Promise<string[]> {
  const cards = getColumnCards(page, columnName)
  const count = await cards.count()
  const titles: string[] = []
  for (let i = 0; i < count; i++) {
    const title = await cards.nth(i).getAttribute('data-story-title')
    if (title) titles.push(title)
  }
  return titles
}

/** Count cards in a column */
export async function countCardsInColumn(page: Page, columnName: string): Promise<number> {
  return getColumnCards(page, columnName).count()
}

// ---------------------------------------------------------------------------
// Drag helpers
// ---------------------------------------------------------------------------

/**
 * Low-level drag from one element to another using the mouse API.
 * Uses multiple steps to satisfy PointerSensor's activation distance.
 */
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
  // Nudge inside the target so dnd-kit reliably receives the final drag-over
  // event even for empty droppable columns.
  await page.mouse.move(tx + 2, ty + 2, { steps: 2 })
  await page.mouse.move(tx, ty, { steps: 2 })
  await page.waitForTimeout(200)
  await page.mouse.up()
  // Wait for any Firestore write + re-render
  await page.waitForTimeout(500)
}

/**
 * Drag a story card (by title) to a target column (by name).
 * Drops roughly in the center of the column body.
 */
export async function dragCardToColumn(
  page: Page,
  cardTitle: string,
  targetColumnName: string,
): Promise<void> {
  const card = getCardByTitle(page, cardTitle)
  const targetCards = getColumnCards(page, targetColumnName)
  const targetCount = await targetCards.count()

  if (targetCount > 0) {
    const lastCard = targetCards.nth(targetCount - 1)
    const lastCardBox = await lastCard.boundingBox()
    const offsetY = (lastCardBox?.height ?? 40) / 3
    await dragElement(page, card, lastCard, { offsetY })
    return
  }

  const emptyDropZone = getColumn(page, targetColumnName).getByText('Húzz ide story-t')
  await dragElement(page, card, emptyDropZone, { steps: 30 })
}

/** Drag a story card to the explicit top position of a target column. */
export async function dragCardToTopOfColumn(
  page: Page,
  cardTitle: string,
  targetColumnName: string,
): Promise<void> {
  const card = getCardByTitle(page, cardTitle)
  const topDropZone = getColumnTopDropZone(page, targetColumnName)
  await dragElement(page, card, topDropZone, { steps: 30 })
}

/**
 * Drag a story card onto another story card.
 * offsetY > 0 means below center (insert after), < 0 means above center (insert before).
 */
export async function dragCardOntoCard(
  page: Page,
  sourceTitle: string,
  targetTitle: string,
  position: 'above' | 'below' = 'below',
): Promise<void> {
  const source = getCardByTitle(page, sourceTitle)
  const target = getCardByTitle(page, targetTitle)
  const targetBox = await target.boundingBox()
  const offsetY = position === 'above'
    ? -Math.max((targetBox?.height ?? 40) / 2, 24)
    : (targetBox?.height ?? 40) / 3
  await dragElement(page, source, target, { offsetY })
}

// ---------------------------------------------------------------------------
// Wait helpers
// ---------------------------------------------------------------------------

/** Wait for the board to fully load (columns visible) */
export async function waitForBoardLoaded(page: Page): Promise<void> {
  // Wait for at least one column to appear
  await page.locator('[data-testid^="board-column-"]').first().waitFor({ state: 'visible', timeout: 15_000 })
  // Extra settle time for Firestore subscriptions
  await page.waitForTimeout(1000)
}

/** Assert no console errors during an action */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })
  return errors
}
