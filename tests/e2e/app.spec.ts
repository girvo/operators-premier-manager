import { expect, test } from '@playwright/test'
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  createMatchViaUi,
  createPlayerViaUi,
  loginWithEmail,
  logout,
} from './helpers.js'

test('login and logout happy path', async ({ page }) => {
  await loginWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await logout(page)
  await expect(page.getByText('Admin login with email')).toBeVisible()
})

test('admin deletes a match and HTMX removes the row', async ({ page }) => {
  await loginWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  const opponentName = `Delete Target ${Date.now()}`
  const { rowId } = await createMatchViaUi(page, {
    opponentName,
    scheduledAt: '2099-01-01 12:00',
  })

  const row = page.locator(`#${rowId}`)
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Delete' }).click()

  await expect(page.locator(`#${rowId}`)).toHaveCount(0)
})

test('admin edits a match via UI', async ({ page }) => {
  await loginWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  const suffix = Date.now()
  const originalOpponent = `Edit Source ${suffix}`
  const updatedOpponent = `Edit Target ${suffix}`
  const { matchId } = await createMatchViaUi(page, {
    opponentName: originalOpponent,
    scheduledAt: '2099-01-03 12:00',
  })

  await page.goto(`/matches/${matchId}/edit`)
  await page.selectOption('#matchType', 'scrim')
  await page.locator('#opponentName').fill(updatedOpponent)
  await page.locator('#scheduledAt').evaluate((node, value) => {
    const input = node as {
      value: string
      dispatchEvent: (event: Event) => boolean
    }

    input.value = String(value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, '2099-01-04 16:00')
  await page.getByRole('button', { name: 'Update Match' }).click()

  await expect(page).toHaveURL(/\/matches$/)
  await expect(page.getByText(updatedOpponent)).toBeVisible()
})

test('availability toggle updates dashboard target region', async ({ page }) => {
  await loginWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  const opponentName = `Availability Target ${Date.now()}`
  await createMatchViaUi(page, {
    opponentName,
    scheduledAt: '2027-01-01 10:00',
  })

  await page.goto('/dashboard')
  await expect(page.locator('a', { hasText: opponentName })).toBeVisible()
  await expect(page.locator('#dashboard-team-availability')).toContainText('Yes (0)')

  const availabilityControls = page.locator('#my-availability')
  await availabilityControls.getByRole('button', { name: 'Yes' }).click()

  await expect(page.locator('#my-availability button.bg-green-600')).toContainText('Yes')
  await expect(page.locator('#dashboard-team-availability')).toContainText('Yes (1)')
})

test('profile file upload reflects in UI', async ({ page }) => {
  await loginWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  await page.goto('/settings/profile')
  await page.locator('[data-agent-grid] label').first().click()
  await page.setInputFiles('#logo', 'tests/fixtures/logo.png')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await expect(page).toHaveURL(/\/settings\/profile$/)
  await expect(page.getByText('Profile updated successfully')).toBeVisible()
  await expect(
    page.locator('#user-profile-pic-display img[src^="/uploads/players/"]')
  ).toBeVisible()
})

test('player cannot see admin mutate controls', async ({ page }) => {
  await loginWithEmail(page, ADMIN_EMAIL, ADMIN_PASSWORD)

  const suffix = Date.now()
  const opponentName = `Player View ${suffix}`
  await createMatchViaUi(page, {
    opponentName,
    scheduledAt: '2099-01-02 14:00',
  })

  const playerEmail = `player_${suffix}@example.com`
  const playerPassword = 'password123'
  await createPlayerViaUi(page, {
    fullName: `E2E Player ${suffix}`,
    email: playerEmail,
    password: playerPassword,
  })

  await logout(page)
  await loginWithEmail(page, playerEmail, playerPassword)

  await page.goto('/matches')
  await expect(page.getByText(opponentName)).toBeVisible()
  await expect(page.locator('a[href="/matches/new"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
})
