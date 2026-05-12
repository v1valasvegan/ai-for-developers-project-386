import { expect, test } from '@playwright/test'

test('user can navigate between guest and admin routes', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Book a meeting' })).toBeVisible()

  await page.getByRole('link', { name: 'Admin' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Admin panel' })).toBeVisible()

  await page.getByRole('link', { name: 'Guest' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Book a meeting' })).toBeVisible()
})
