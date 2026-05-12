import { expect, test } from '@playwright/test'
import { createEventType, pickFirstAvailableSlot, selectEventTypeByName } from './helpers'

test.describe('Admin flows', () => {
  test('admin can create and edit event type', async ({ page }) => {
    const createdName = `E2E Admin Create ${Date.now()}`
    const updatedDescription = 'Updated from Playwright e2e test'

    await createEventType(page, {
      name: createdName,
      description: 'Created by admin in e2e',
      durationMinutes: '45',
      slotStepLabel: '15 minutes',
    })

    const eventTypeCard = page
      .locator('[data-testid^="admin-event-type-"]')
      .filter({ has: page.getByText(createdName, { exact: true }) })
      .first()

    await expect(eventTypeCard).toBeVisible()
    await eventTypeCard.locator('[data-testid^="admin-edit-event-type-"]').click()
    await page.getByLabel('Description').fill(updatedDescription)
    await page.getByTestId('admin-submit-event-type').click()

    await expect(page.getByText('Event type updated')).toBeVisible()
    await expect(eventTypeCard.getByText(updatedDescription, { exact: true })).toBeVisible()
  })

  test('admin sees upcoming booking created by guest', async ({ page }) => {
    const eventTypeName = `E2E Admin Upcoming ${Date.now()}`

    await createEventType(page, {
      name: eventTypeName,
      description: 'Event type for upcoming bookings check',
      durationMinutes: '30',
      slotStepLabel: '30 minutes',
    })

    await page.goto('/')
    await selectEventTypeByName(page, eventTypeName)
    const selectedSlotLabel = await pickFirstAvailableSlot(page)
    await page.getByLabel('Guest name').fill('Upcoming Guest')
    await page.getByLabel('Guest email').fill(`upcoming.${Date.now()}@example.com`)
    await page.getByTestId('guest-create-booking').click()
    await expect(page.getByText('Booking created')).toBeVisible()

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Upcoming bookings' })).toBeVisible()
    await expect(page.getByRole('table')).toContainText('Upcoming Guest')
    await expect(page.getByRole('table')).toContainText(selectedSlotLabel.split(', ')[1])
  })
})
