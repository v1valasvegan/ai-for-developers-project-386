import { expect, type Page } from '@playwright/test'

async function openSlotsDropdown(page: Page) {
  const combobox = page.getByRole('combobox', { name: 'Available slots' })
  await expect(combobox).toBeEnabled()
  await combobox.click()
  await expect(page.getByRole('option').first()).toBeVisible()
  return combobox
}

export async function createEventType(
  page: Page,
  payload: {
    name: string
    description: string
    durationMinutes?: string
    slotStepLabel?: '15 minutes' | '30 minutes'
  },
) {
  await page.goto('/admin')
  await page.getByLabel('Name').fill(payload.name)
  await page.getByLabel('Description').fill(payload.description)

  if (payload.durationMinutes) {
    await page.getByLabel('Duration (minutes)').fill(payload.durationMinutes)
  }

  if (payload.slotStepLabel) {
    await page.getByRole('radio', { name: payload.slotStepLabel }).check()
  }

  await page.getByTestId('admin-submit-event-type').click()
  await expect(page.getByText('Event type created')).toBeVisible()
}

export async function pickFirstAvailableSlot(page: Page): Promise<string> {
  const combobox = await openSlotsDropdown(page)
  await page.getByRole('option').first().click()
  await expect(combobox).toHaveValue(/\S+/)
  return (await combobox.inputValue()).trim()
}

export async function pickSlotByLabel(page: Page, slotLabel: string): Promise<void> {
  const combobox = await openSlotsDropdown(page)
  await page.getByRole('option', { name: slotLabel, exact: true }).click()
  await expect(combobox).toHaveValue(slotLabel)
}

export async function selectEventTypeByName(page: Page, eventTypeName: string) {
  const twoDaysAhead = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const startDateInput = page.getByLabel('Start date')
  await startDateInput.fill(twoDaysAhead)
  await expect(startDateInput).toHaveValue(twoDaysAhead)

  const card = page
    .locator('[data-testid^="guest-event-type-card-"]')
    .filter({ has: page.getByRole('heading', { name: eventTypeName, exact: true }) })
    .first()
  await expect(card).toBeVisible()
  const selectButton = card.locator('[data-testid^="guest-select-event-type-"]')
  const eventTypeTestId = await selectButton.getAttribute('data-testid')
  const eventTypeId = eventTypeTestId?.replace('guest-select-event-type-', '')

  const slotsResponsePromise = eventTypeId
    ? page.waitForResponse(
        (response) =>
          response.url().includes(`/event-types/${eventTypeId}/slots`) &&
          response.request().method() === 'GET' &&
          response.status() === 200,
      )
    : null

  await selectButton.click()

  if (slotsResponsePromise) {
    await slotsResponsePromise
  }

  await expect(selectButton).toContainText('Selected')
}
