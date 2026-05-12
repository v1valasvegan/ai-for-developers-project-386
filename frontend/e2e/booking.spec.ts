import { expect, test } from '@playwright/test'
import { createEventType, pickFirstAvailableSlot, pickSlotByLabel, selectEventTypeByName } from './helpers'

test.describe('Booking flows', () => {
  test('guest can create booking from homepage', async ({ page }) => {
    const eventTypeName = `E2E Intro Call ${Date.now()}`
    await createEventType(page, {
      name: eventTypeName,
      description: 'Initial discovery call',
      durationMinutes: '30',
      slotStepLabel: '30 minutes',
    })

    await page.goto('/')
    await selectEventTypeByName(page, eventTypeName)

    await pickFirstAvailableSlot(page)

    await page.getByLabel('Guest name').fill('Ivan E2E')
    await page.getByLabel('Guest email').fill(`ivan.${Date.now()}@example.com`)
    await page.getByTestId('guest-create-booking').click()

    await expect(page.getByText('Booking created')).toBeVisible()
  })

  test('shows conflict for duplicate slot booking across two sessions', async ({ browser, page }) => {
    const eventTypeName = `E2E Conflict ${Date.now()}`
    await createEventType(page, {
      name: eventTypeName,
      description: 'Conflict scenario type',
      durationMinutes: '30',
      slotStepLabel: '30 minutes',
    })

    await page.goto('/')
    await selectEventTypeByName(page, eventTypeName)
    const slotLabel = await pickFirstAvailableSlot(page)

    const baseURL = new URL(page.url()).origin
    const contextB = await browser.newContext({ baseURL })
    const pageB = await contextB.newPage()
    await pageB.goto('/')
    await selectEventTypeByName(pageB, eventTypeName)
    await pickSlotByLabel(pageB, slotLabel)

    await page.getByLabel('Guest name').fill('First Booker')
    await page.getByLabel('Guest email').fill(`first.${Date.now()}@example.com`)

    await pageB.getByLabel('Guest name').fill('Second Booker')
    await pageB.getByLabel('Guest email').fill(`second.${Date.now()}@example.com`)

    await page.getByTestId('guest-create-booking').click()
    await expect(page.getByText('Booking created')).toBeVisible()

    await pageB.getByTestId('guest-create-booking').click()

    await expect(pageB.getByText('Booking failed')).toBeVisible()
    await expect(pageB.getByText('This slot is already occupied. Please choose another one.')).toBeVisible()
    await contextB.close()
  })

  test('booking button is disabled until required fields are filled', async ({ page }) => {
    const eventTypeName = `E2E Required ${Date.now()}`
    await createEventType(page, {
      name: eventTypeName,
      description: 'Required fields scenario',
    })

    await page.goto('/')
    await selectEventTypeByName(page, eventTypeName)
    await pickFirstAvailableSlot(page)

    const submitButton = page.getByTestId('guest-create-booking')
    await expect(submitButton).toBeDisabled()

    await page.getByLabel('Guest name').fill('Filled Name')
    await expect(submitButton).toBeDisabled()

    await page.getByLabel('Guest email').fill(`required.${Date.now()}@example.com`)
    await expect(submitButton).toBeEnabled()
  })
})
