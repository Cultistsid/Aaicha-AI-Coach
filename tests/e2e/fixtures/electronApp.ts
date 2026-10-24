import { test as base, ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'path'

type Fixtures = {
  electronApp: ElectronApplication
  mainPage: Page
}

export const test = base.extend<Fixtures>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.join(__dirname, '../../../dist-electron/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ANTHROPIC_API_KEY: process.env.TEST_ANTHROPIC_KEY || 'test-key',
        GOOGLE_APPLICATION_CREDENTIALS: process.env.TEST_GOOGLE_CREDS || ''
      }
    })
    await use(app)
    await app.close()
  },

  mainPage: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  }
})

export { expect } from '@playwright/test'
