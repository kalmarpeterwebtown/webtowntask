import { test, expect } from '@playwright/test'
import {
  waitForBoardLoaded,
  getColumnCards,
  getCardTitlesInColumn,
  countCardsInColumn,
  dragCardToColumn,
  dragCardToTopOfColumn,
  dragCardOntoCard,
  getCardByTitle,
  getColumn,
  collectConsoleErrors,
} from './board-dnd.helpers'

// ---------------------------------------------------------------------------
// Config — set your team ID here or via TEAM_ID env var
// ---------------------------------------------------------------------------

const LOGIN_EMAIL = process.env.E2E_EMAIL ?? 'kalmar@webtown.hu'
const LOGIN_PASSWORD = process.env.E2E_PASSWORD ?? 'test2test'
const E2E_TEAM_NAME = 'E2E Board Tests'

const SEED_TODO_A = 'E2E TODO A'
const SEED_TODO_B = 'E2E TODO B'
const SEED_TODO_C = 'E2E TODO C'
const SEED_IN_PROGRESS = 'E2E IN PROGRESS'

// Column names (Hungarian defaults)
const COL_TODO = 'Teendő'
const COL_IN_PROGRESS = 'Folyamatban'
const COL_REVIEW = 'Review'
const COL_DONE = 'Kész'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function ensureE2ETeam(page: Parameters<typeof test.beforeEach>[0]['page']): Promise<string> {
  return page.evaluate(async ({ e2eTeamName }) => {
    const seedModule = await import('/src/e2e/boardTestSeed.ts')
    return seedModule.ensureBoardTestTeam(e2eTeamName)
  }, { e2eTeamName: E2E_TEAM_NAME })
}

async function seedBoardTestData(page: Parameters<typeof test.beforeEach>[0]['page'], teamId: string): Promise<void> {
  await page.evaluate(async ({ teamId, seed }) => {
    const seedModule = await import('/src/e2e/boardTestSeed.ts')
    await seedModule.seedBoardTestData(teamId, seed)
  }, {
    teamId,
    seed: {
      todoA: SEED_TODO_A,
      todoB: SEED_TODO_B,
      todoC: SEED_TODO_C,
      inProgress: SEED_IN_PROGRESS,
    },
  })
}

async function openBoard(page: Parameters<typeof test.beforeEach>[0]['page'], teamId: string) {
  await page.goto(`/#/teams/${teamId}/board`)
}

async function signInIfNeeded(page: Parameters<typeof test.beforeEach>[0]['page']) {
  await page.goto('/#/teams')

  const loginHeading = page.getByRole('heading', { name: 'Bejelentkezés' })
  const teamsHeading = page.getByRole('heading', { name: 'Csapatok' })

  await Promise.race([
    loginHeading.waitFor({ state: 'visible', timeout: 15_000 }),
    teamsHeading.waitFor({ state: 'visible', timeout: 15_000 }),
  ])

  if (!(await loginHeading.isVisible())) {
    return
  }

  await page.getByLabel('Email cím').fill(LOGIN_EMAIL)
  await page.getByLabel('Jelszó').fill(LOGIN_PASSWORD)
  await page.getByRole('button', { name: 'Bejelentkezés' }).click()
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15_000 })
  await page.getByRole('button', { name: 'Kijelentkezés' }).waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(1500)
}

test.describe('Board Drag & Drop', () => {
  test.beforeEach(async ({ page }) => {
    await signInIfNeeded(page)
    const teamId = await ensureE2ETeam(page)
    await seedBoardTestData(page, teamId)
    await openBoard(page, teamId)
    await waitForBoardLoaded(page)
  })

  // =========================================================================
  // 1. Same-column reorder
  // =========================================================================

  test.describe('Same-column reorder', () => {
    test('swap first two cards in a column', async ({ page }) => {
      const titlesBefore = await getCardTitlesInColumn(page, COL_TODO)
      expect(titlesBefore.slice(0, 3)).toEqual([SEED_TODO_A, SEED_TODO_B, SEED_TODO_C])

      // Drag first card below second
      await dragCardOntoCard(page, SEED_TODO_A, SEED_TODO_B, 'below')

      const titlesAfter = await getCardTitlesInColumn(page, COL_TODO)
      expect(titlesAfter.indexOf(SEED_TODO_B)).toBeLessThan(titlesAfter.indexOf(SEED_TODO_A))
      expect(titlesAfter.indexOf(SEED_TODO_A)).toBeLessThan(titlesAfter.indexOf(SEED_TODO_C))
    })

    test('move last card to top of column', async ({ page }) => {
      const titlesBefore = await getCardTitlesInColumn(page, COL_TODO)
      expect(titlesBefore.slice(0, 3)).toEqual([SEED_TODO_A, SEED_TODO_B, SEED_TODO_C])

      await dragCardToTopOfColumn(page, SEED_TODO_C, COL_TODO)

      await expect.poll(async () => getCardTitlesInColumn(page, COL_TODO)).toEqual([SEED_TODO_C, SEED_TODO_A, SEED_TODO_B])
    })

    test('move middle card to top of column', async ({ page }) => {
      const titlesBefore = await getCardTitlesInColumn(page, COL_TODO)
      expect(titlesBefore.slice(0, 3)).toEqual([SEED_TODO_A, SEED_TODO_B, SEED_TODO_C])

      await dragCardToTopOfColumn(page, SEED_TODO_B, COL_TODO)

      await expect.poll(async () => getCardTitlesInColumn(page, COL_TODO)).toEqual([SEED_TODO_B, SEED_TODO_A, SEED_TODO_C])
    })

    test('move first card to bottom of column', async ({ page }) => {
      const titlesBefore = await getCardTitlesInColumn(page, COL_TODO)
      expect(titlesBefore.slice(0, 3)).toEqual([SEED_TODO_A, SEED_TODO_B, SEED_TODO_C])

      await dragCardOntoCard(page, SEED_TODO_A, SEED_TODO_C, 'below')

      await expect.poll(async () => getCardTitlesInColumn(page, COL_TODO)).toEqual([SEED_TODO_B, SEED_TODO_C, SEED_TODO_A])
    })

    test('reorder preserves after page reload', async ({ page }) => {
      await dragCardToTopOfColumn(page, SEED_TODO_C, COL_TODO)

      // Reload and verify
      await page.reload()
      await waitForBoardLoaded(page)

      await expect.poll(async () => getCardTitlesInColumn(page, COL_TODO)).toEqual([SEED_TODO_C, SEED_TODO_A, SEED_TODO_B])
    })
  })

  // =========================================================================
  // 2. Cross-column move
  // =========================================================================

  test.describe('Cross-column move', () => {
    test('move card from Teendo to Folyamatban', async ({ page }) => {
      const todoBefore = await countCardsInColumn(page, COL_TODO)
      const inProgressBefore = await countCardsInColumn(page, COL_IN_PROGRESS)

      await dragCardToColumn(page, SEED_TODO_A, COL_IN_PROGRESS)

      await expect.poll(async () => getCardTitlesInColumn(page, COL_IN_PROGRESS)).toContain(SEED_TODO_A)
      await expect.poll(async () => countCardsInColumn(page, COL_TODO)).toBe(todoBefore - 1)
      await expect.poll(async () => countCardsInColumn(page, COL_IN_PROGRESS)).toBe(inProgressBefore + 1)
    })

    test('move card to empty column', async ({ page }) => {
      const emptyColumns: string[] = []
      for (const column of [COL_REVIEW, COL_DONE]) {
        if (await countCardsInColumn(page, column) === 0) {
          emptyColumns.push(column)
        }
      }
      expect(emptyColumns.length).toBeGreaterThan(0)

      await dragCardToColumn(page, SEED_TODO_A, emptyColumns[0])

      await expect.poll(async () => {
        for (const column of emptyColumns) {
          const titles = await getCardTitlesInColumn(page, column)
          if (titles.includes(SEED_TODO_A)) return column
        }
        return null
      }).not.toBeNull()
      await expect.poll(async () => getCardTitlesInColumn(page, COL_TODO)).not.toContain(SEED_TODO_A)
    })

    test('cross-column move preserves after reload', async ({ page }) => {
      await dragCardToColumn(page, SEED_TODO_A, COL_IN_PROGRESS)

      await page.reload()
      await waitForBoardLoaded(page)

      const inProgressCards = await getCardTitlesInColumn(page, COL_IN_PROGRESS)
      expect(inProgressCards).toContain(SEED_TODO_A)
    })

    test('move card back to original column', async ({ page }) => {
      // Move to Folyamatban
      await dragCardToColumn(page, SEED_TODO_A, COL_IN_PROGRESS)
      let ipCards = await getCardTitlesInColumn(page, COL_IN_PROGRESS)
      expect(ipCards).toContain(SEED_TODO_A)

      // Move back to Teendo
      await dragCardToColumn(page, SEED_TODO_A, COL_TODO)
      const todoAfter = await getCardTitlesInColumn(page, COL_TODO)
      expect(todoAfter).toContain(SEED_TODO_A)
    })
  })

  // =========================================================================
  // 3. Cross-column move onto a specific card
  // =========================================================================

  test.describe('Cross-column onto specific card', () => {
    test('move card from Teendo onto a card in Folyamatban', async ({ page }) => {
      await dragCardOntoCard(page, SEED_TODO_A, SEED_IN_PROGRESS, 'below')

      const ipAfter = await getCardTitlesInColumn(page, COL_IN_PROGRESS)
      expect(ipAfter).toContain(SEED_TODO_A)

      const todoAfter = await getCardTitlesInColumn(page, COL_TODO)
      expect(todoAfter).not.toContain(SEED_TODO_A)
    })
  })

  // =========================================================================
  // 4. Edge cases
  // =========================================================================

  test.describe('Edge cases', () => {
    test('drop in same position (no-op)', async ({ page }) => {
      const todoCards = await getCardTitlesInColumn(page, COL_TODO)
      const card = getCardByTitle(page, SEED_TODO_A)
      const box = await card.boundingBox()
      expect(box).not.toBeNull()

      // Use the non-link top-left portion of the card and stay below the
      // PointerSensor activation distance so the gesture remains a true no-op.
      const safeX = box!.x + 12
      const safeY = box!.y + 12
      await page.mouse.move(safeX, safeY)
      await page.mouse.down()
      await page.mouse.move(safeX + 2, safeY + 2, { steps: 2 })
      await page.mouse.up()
      await page.waitForTimeout(200)

      await expect(page).toHaveURL(/\/teams\/.*\/board/)
      const todoAfter = await getCardTitlesInColumn(page, COL_TODO)
      expect(todoAfter).toEqual(todoCards)
    })

    test('rapid consecutive drags do not crash', async ({ page }) => {
      const errors = collectConsoleErrors(page)

      // Do 3 rapid swaps
      for (let i = 0; i < 3; i++) {
        const todoOrder = await getCardTitlesInColumn(page, COL_TODO)
        const firstSeed = todoOrder.find((title) => title === SEED_TODO_A || title === SEED_TODO_B)
        const secondSeed = todoOrder.find((title, index) =>
          index > todoOrder.indexOf(firstSeed ?? '') && (title === SEED_TODO_A || title === SEED_TODO_B),
        )
        expect(firstSeed).toBeTruthy()
        expect(secondSeed).toBeTruthy()
        await dragCardOntoCard(page, firstSeed as string, secondSeed as string, 'below')
      }

      // Page should not crash (white screen)
      await expect(page.locator('[data-testid^="board-column-"]').first()).toBeVisible()

      // Filter out non-critical errors (Firebase, etc.)
      const criticalErrors = errors.filter(
        (e) => e.includes('Maximum update depth') || e.includes('TypeError') || e.includes('white screen'),
      )
      expect(criticalErrors).toHaveLength(0)
    })

    test('single card in column can be moved out', async ({ page }) => {
      expect((await getCardTitlesInColumn(page, COL_IN_PROGRESS)).filter((title) => title === SEED_IN_PROGRESS)).toHaveLength(1)

      const emptyColumns: string[] = []
      for (const column of [COL_REVIEW, COL_DONE]) {
        if (await countCardsInColumn(page, column) === 0) {
          emptyColumns.push(column)
        }
      }
      expect(emptyColumns.length).toBeGreaterThan(0)

      await dragCardToColumn(page, SEED_IN_PROGRESS, emptyColumns[0])

      await expect.poll(async () => getCardTitlesInColumn(page, COL_IN_PROGRESS)).not.toContain(SEED_IN_PROGRESS)
      await expect.poll(async () => {
        for (const column of emptyColumns) {
          const titles = await getCardTitlesInColumn(page, column)
          if (titles.includes(SEED_IN_PROGRESS)) return column
        }
        return null
      }).not.toBeNull()
    })
  })

  // =========================================================================
  // 5. Visual feedback
  // =========================================================================

  test.describe('Visual feedback', () => {
    test('DragOverlay appears during drag', async ({ page }) => {
      const card = getCardByTitle(page, SEED_TODO_A)
      const box = await card.boundingBox()
      if (!box) return

      // Start dragging but don't release
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 10 })

      // DragOverlay should be visible (it renders inside a [data-dnd-overlay] or with specific classes)
      // dnd-kit renders the overlay in a fixed-position container
      const overlay = page.locator('[style*="position: fixed"]').filter({ hasText: SEED_TODO_A })
      await expect(overlay).toBeVisible({ timeout: 3000 })

      // Source card should have reduced opacity
      await expect(card).toHaveCSS('opacity', '0.5')

      await page.mouse.up()
    })

    test('source card gets opacity during drag', async ({ page }) => {
      const card = getCardByTitle(page, SEED_TODO_A)
      const box = await card.boundingBox()
      if (!box) return

      // Start drag
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30, { steps: 10 })

      await expect(card).toHaveCSS('opacity', '0.5')

      await page.mouse.up()
    })

    test('target column highlights on hover', async ({ page }) => {
      const card = getCardByTitle(page, SEED_TODO_A)
      const targetColBody = getColumn(page, COL_IN_PROGRESS).locator('.rounded-b-xl').first()
      const sourceBox = await card.boundingBox()
      const targetBox = await targetColBody.boundingBox()
      if (!sourceBox || !targetBox) return

      // Start drag and hover over target column
      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2,
        { steps: 15 },
      )

      // Wait for CSS transition
      await page.waitForTimeout(300)

      // The column body should have the highlight class
      const classes = await targetColBody.getAttribute('class')
      expect(classes).toContain('shadow-inner')

      await page.mouse.up()
    })
  })

  // =========================================================================
  // 6. No console errors (stability)
  // =========================================================================

  test.describe('Stability', () => {
    test('no critical console errors during drag operations', async ({ page }) => {
      const errors = collectConsoleErrors(page)

      // Do some drag operations
      await dragCardOntoCard(page, SEED_TODO_A, SEED_TODO_B, 'below')
      await page.waitForTimeout(300)
      await dragCardToColumn(page, SEED_TODO_A, COL_IN_PROGRESS)
      await page.waitForTimeout(300)

      // Check for critical errors
      const criticalErrors = errors.filter(
        (e) =>
          e.includes('Maximum update depth exceeded') ||
          e.includes('TypeError') ||
          e.includes('generateKeyBetween') ||
          e.includes('Uncaught'),
      )
      expect(criticalErrors).toHaveLength(0)
    })

    test('board does not white-screen after multiple drags', async ({ page }) => {
      // Perform several drag operations
      for (let i = 0; i < 5; i++) {
        const todoCards = await getCardTitlesInColumn(page, COL_TODO)

        if (todoCards.includes(SEED_TODO_A)) {
          await dragCardToColumn(page, SEED_TODO_A, COL_IN_PROGRESS)
        } else {
          await dragCardToColumn(page, SEED_TODO_A, COL_TODO)
        }
      }

      // Board should still be visible (not white screen)
      await expect(page.locator('[data-testid^="board-column-"]').first()).toBeVisible()

      // Should see column headers
      await expect(page.locator('[data-testid="column-name"]').first()).toBeVisible()
    })
  })
})
