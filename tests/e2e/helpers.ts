import { expect, Page } from '@playwright/test'

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.com'
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'password'

export const loginWithEmail = async (page: Page, email: string, password: string) => {
  await page.goto('/login')
  await page.getByText('Admin login with email').click()
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

export const logout = async (page: Page) => {
  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/login$/)
}

export const createMatchViaUi = async (
  page: Page,
  { opponentName, scheduledAt }: { opponentName: string; scheduledAt: string }
) => {
  await page.goto('/matches/new')
  await page.selectOption('#matchType', 'scrim')
  await page.locator('#opponentName').fill(opponentName)
  await page.locator('#scheduledAt').evaluate((node, value) => {
    const input = node as {
      value: string
      dispatchEvent: (event: Event) => boolean
    }

    input.value = String(value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, scheduledAt)

  await page.getByRole('button', { name: 'Schedule Match' }).click()
  await expect(page).toHaveURL(/\/matches$/)

  const row = page.locator('div[id^="match-"]').filter({ hasText: opponentName }).first()
  await expect(row).toBeVisible()

  const rowId = await row.getAttribute('id')
  if (!rowId) {
    throw new Error(`Missing row id for match "${opponentName}"`)
  }

  const matchId = Number.parseInt(rowId.replace('match-', ''), 10)
  if (Number.isNaN(matchId)) {
    throw new Error(`Unable to parse match id from "${rowId}"`)
  }

  return { rowId, matchId }
}

export const createPlayerViaUi = async (
  page: Page,
  {
    fullName,
    email,
    password,
  }: {
    fullName: string
    email: string
    password: string
  }
) => {
  await page.goto('/players/new')
  await page.locator('#fullName').fill(fullName)
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Create Player' }).click()
  await expect(page).toHaveURL(/\/players$/)
}
