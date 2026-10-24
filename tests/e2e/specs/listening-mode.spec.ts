import { test, expect } from '../fixtures/electronApp'

test.describe('Listening Mode', () => {
  test('starts and stops listening session', async ({ mainPage }) => {
    await mainPage.click('[data-testid="listening-mode-tab"]')

    await mainPage.click('[data-testid="start-listening"]')
    await expect(mainPage.locator('[data-testid="listening-indicator"]')).toBeVisible()

    await mainPage.click('[data-testid="stop-listening"]')
    await expect(mainPage.locator('[data-testid="listening-indicator"]')).not.toBeVisible()
  })

  test('displays real-time transcript', async ({ mainPage }) => {
    await mainPage.click('[data-testid="listening-mode-tab"]')
    await mainPage.click('[data-testid="start-listening"]')

    await expect(mainPage.locator('[data-testid="transcript"]')).toContainText(/.+/)
  })

  test('shows coach response with streaming', async ({ mainPage }) => {
    await mainPage.click('[data-testid="listening-mode-tab"]')
    await mainPage.click('[data-testid="start-listening"]')

    await expect(mainPage.locator('[data-testid="coach-response"]')).toBeVisible()
  })
})
