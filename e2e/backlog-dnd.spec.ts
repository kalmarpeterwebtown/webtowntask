import { expect, test } from '@playwright/test'
import {
  dragStoryToLinkedBoard,
  dragStoryToTopOfSection,
  dragStoryOntoStory,
  getStoryRowByTitle,
  getStoryTitlesInSection,
  waitForBacklogLoaded,
} from './backlog-dnd.helpers'

const LOGIN_EMAIL = process.env.E2E_EMAIL ?? 'kalmar@webtown.hu'
const LOGIN_PASSWORD = process.env.E2E_PASSWORD ?? 'test2test'

const SEED_BACKLOG_A = 'E2E BL BACKLOG A'
const SEED_BACKLOG_B = 'E2E BL BACKLOG B'
const SEED_BACKLOG_C = 'E2E BL BACKLOG C'
const SEED_PLANBOX_A = 'E2E BL PLANBOX A'
const SEED_PLANBOX_B = 'E2E BL PLANBOX B'
const SEED_ON_BOARD_A = 'E2E BL ON BOARD A'
const E2E_TEAM_NAME = 'Playwright Backlog Board Target'

async function ensureBacklogTestProject(page: Parameters<typeof test.beforeEach>[0]['page']): Promise<string> {
  return page.evaluate(async () => {
    const seedModule = await import('/src/e2e/backlogTestSeed.ts')
    return seedModule.ensureBacklogTestProject()
  })
}

async function seedBacklogTestData(page: Parameters<typeof test.beforeEach>[0]['page'], projectId: string): Promise<void> {
  await page.evaluate(async ({ projectId, seed }) => {
    const seedModule = await import('/src/e2e/backlogTestSeed.ts')
    await seedModule.seedBacklogTestData(projectId, seed)
  }, {
    projectId,
    seed: {
      backlogA: SEED_BACKLOG_A,
      backlogB: SEED_BACKLOG_B,
      backlogC: SEED_BACKLOG_C,
      planboxA: SEED_PLANBOX_A,
      planboxB: SEED_PLANBOX_B,
    },
  })
}

async function ensureLinkedBoardTeam(page: Parameters<typeof test.beforeEach>[0]['page']): Promise<string> {
  return page.evaluate(async (teamName) => {
    const seedModule = await import('/src/e2e/boardTestSeed.ts')
    return seedModule.ensureBoardTestTeam(teamName)
  }, E2E_TEAM_NAME)
}

async function seedOnBoardStory(page: Parameters<typeof test.beforeEach>[0]['page'], teamId: string): Promise<void> {
  await page.evaluate(async ({ teamId, storyTitle }) => {
    const seedModule = await import('/src/e2e/boardTestSeed.ts')
    await seedModule.seedSingleBoardStory(teamId, storyTitle, 'Teendő')
  }, {
    teamId,
    storyTitle: SEED_ON_BOARD_A,
  })
}

async function signInIfNeeded(page: Parameters<typeof test.beforeEach>[0]['page']) {
  await page.goto('/#/projects')

  const loginHeading = page.getByRole('heading', { name: 'Bejelentkezés' })
  const projectsHeading = page.getByRole('heading', { name: 'Projektek' })

  await Promise.race([
    loginHeading.waitFor({ state: 'visible', timeout: 15_000 }),
    projectsHeading.waitFor({ state: 'visible', timeout: 15_000 }),
  ])

  if (!(await loginHeading.isVisible())) return

  await page.getByLabel('Email cím').fill(LOGIN_EMAIL)
  await page.getByLabel('Jelszó').fill(LOGIN_PASSWORD)
  await page.getByRole('button', { name: 'Bejelentkezés' }).click()
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15_000 })
  await page.getByRole('button', { name: 'Kijelentkezés' }).waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(1500)
}

async function openBacklog(page: Parameters<typeof test.beforeEach>[0]['page'], projectId: string) {
  await page.goto(`/#/projects/${projectId}/backlog`)
}

async function getSeedTitlesInSection(
  page: Parameters<typeof test.beforeEach>[0]['page'],
  location: 'backlog' | 'planbox' | 'board',
) {
  return (await getStoryTitlesInSection(page, location)).filter((title) => title.startsWith('E2E BL '))
}

test.describe('Backlog Drag & Drop', () => {
  test.beforeEach(async ({ page }) => {
    await signInIfNeeded(page)
    const projectId = await ensureBacklogTestProject(page)
    const teamId = await ensureLinkedBoardTeam(page)
    await seedBacklogTestData(page, projectId)
    await seedOnBoardStory(page, teamId)
    await openBacklog(page, projectId)
    await waitForBacklogLoaded(page)
  })

  test('On Board stories show current board phase', async ({ page }) => {
    await page.getByRole('button', { name: /On Board/i }).click()

    const storyRow = getStoryRowByTitle(page, SEED_ON_BOARD_A)
    await expect(storyRow).toContainText('Fázis: Teendő')
  })

  test('move last backlog story to top', async ({ page }) => {
    expect(await getSeedTitlesInSection(page, 'backlog')).toEqual([SEED_BACKLOG_A, SEED_BACKLOG_B, SEED_BACKLOG_C])

    await dragStoryToTopOfSection(page, SEED_BACKLOG_C, 'backlog')

    await expect.poll(async () => getSeedTitlesInSection(page, 'backlog')).toEqual([SEED_BACKLOG_C, SEED_BACKLOG_A, SEED_BACKLOG_B])
  })

  test('move first backlog story to bottom', async ({ page }) => {
    expect(await getSeedTitlesInSection(page, 'backlog')).toEqual([SEED_BACKLOG_A, SEED_BACKLOG_B, SEED_BACKLOG_C])

    await dragStoryOntoStory(page, SEED_BACKLOG_A, SEED_BACKLOG_C)

    await expect.poll(async () => getSeedTitlesInSection(page, 'backlog')).toEqual([SEED_BACKLOG_B, SEED_BACKLOG_C, SEED_BACKLOG_A])
  })

  test('move last planbox story to top', async ({ page }) => {
    expect(await getSeedTitlesInSection(page, 'planbox')).toEqual([SEED_PLANBOX_A, SEED_PLANBOX_B])

    await dragStoryToTopOfSection(page, SEED_PLANBOX_B, 'planbox')

    await expect.poll(async () => getSeedTitlesInSection(page, 'planbox')).toEqual([SEED_PLANBOX_B, SEED_PLANBOX_A])
  })

  test('backlog reorder persists after reload', async ({ page }) => {
    await dragStoryToTopOfSection(page, SEED_BACKLOG_C, 'backlog')

    await page.reload()
    await waitForBacklogLoaded(page)

    await expect.poll(async () => getSeedTitlesInSection(page, 'backlog')).toEqual([SEED_BACKLOG_C, SEED_BACKLOG_A, SEED_BACKLOG_B])
  })

  test('planbox reorder persists after reload', async ({ page }) => {
    await dragStoryToTopOfSection(page, SEED_PLANBOX_B, 'planbox')

    await page.reload()
    await waitForBacklogLoaded(page)

    await expect.poll(async () => getSeedTitlesInSection(page, 'planbox')).toEqual([SEED_PLANBOX_B, SEED_PLANBOX_A])
  })

  test('move backlog story onto planbox story', async ({ page }) => {
    await dragStoryOntoStory(page, SEED_BACKLOG_A, SEED_PLANBOX_A)

    await expect.poll(async () => getSeedTitlesInSection(page, 'planbox')).toEqual([SEED_BACKLOG_A, SEED_PLANBOX_A, SEED_PLANBOX_B])
    await expect.poll(async () => getSeedTitlesInSection(page, 'backlog')).toEqual([SEED_BACKLOG_B, SEED_BACKLOG_C])
  })

  test('move backlog story to linked board shows phase under On Board', async ({ page }) => {
    const teamId = await ensureLinkedBoardTeam(page)

    await page.getByRole('button', { name: /On Board/i }).click()
    await dragStoryToLinkedBoard(page, SEED_BACKLOG_A, teamId)

    await expect.poll(async () => getSeedTitlesInSection(page, 'backlog')).toEqual([SEED_BACKLOG_B, SEED_BACKLOG_C])
    await expect.poll(async () => (await getSeedTitlesInSection(page, 'board')).includes(SEED_BACKLOG_A)).toBe(true)

    const storyRow = getStoryRowByTitle(page, SEED_BACKLOG_A)
    await expect(storyRow).toContainText('Fázis: Teendő')
  })
})
